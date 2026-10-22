package dev.ritmo.identity;

import dev.ritmo.shared.*;
import java.time.*;
import java.util.*;
import java.security.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import tools.jackson.databind.JsonNode;

/** Opaque web capabilities. Native JWT/refresh families do not participate. */
@Service
public class WebSessions {
    public record Credential(String contextId,String secret,String expectedAccount,String epoch,String tabId) {}
    record Issued(JsonNode body,String closeSecret,String authSecret,Instant expires) {}
    private final Sql db,domain;
    private final TransactionTemplate transactions;
    private final Database.TenantTransactions tenants;
    private final RateLimits limits;
    private final Clock clock;
    private final WebContract contract;
    private final byte[] ticketKey;
    private final Argon2PasswordEncoder passwords=Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    private final SecureRandom random=new SecureRandom();
    private static final Duration IDLE=Duration.ofDays(30), ABSOLUTE=Duration.ofDays(90);
    public WebSessions(@Qualifier("identitySql") Sql db,@Qualifier("domainSql") Sql domain,
        @Qualifier("identityTransactions") TransactionTemplate transactions,Database.TenantTransactions tenants,
        RateLimits limits,Clock clock,WebContract contract,@Value("${ritmo.web.preparation-key:}") String encoded) {
        this.db=db;this.domain=domain;this.transactions=transactions;this.tenants=tenants;this.limits=limits;this.clock=clock;this.contract=contract;
        ticketKey=encoded.isEmpty()?new byte[0]:Base64.getDecoder().decode(encoded);
        if(ticketKey.length!=0&&ticketKey.length<32) throw new IllegalArgumentException("web_preparation_key_too_short");
    }
    public static String authCookie(jakarta.servlet.http.HttpServletRequest request) {return WebBoundary.cookie(request,"__Secure-ritmo-auth");}
    public void validateWeb(String schema,JsonNode body) {contract.validate(schema,body);}
    private void available() {if(ticketKey.length<32) throw new HttpFailure(503,"temporarily_unavailable");}
    private String secret() {byte[] bytes=new byte[32];random.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    private byte[] mac(String text) {
        try {var hmac=Mac.getInstance("HmacSHA256");hmac.init(new SecretKeySpec(ticketKey,"HmacSHA256"));return hmac.doFinal(text.getBytes(StandardCharsets.US_ASCII));}
        catch(GeneralSecurityException e) {throw new IllegalStateException(e);}
    }
    private String seal(JsonNode value) {
        String payload=Base64.getUrlEncoder().withoutPadding().encodeToString(value.toString().getBytes(StandardCharsets.UTF_8));
        return payload+"."+Base64.getUrlEncoder().withoutPadding().encodeToString(mac(payload));
    }
    private JsonNode open(String ticket) {
        available();
        try {
            var parts=ticket.split("[.]",-1);
            if(parts.length!=2||!MessageDigest.isEqual(mac(parts[0]),Base64.getUrlDecoder().decode(parts[1]))) throw new IllegalArgumentException();
            var body=Json.read(new String(Base64.getUrlDecoder().decode(parts[0]),StandardCharsets.UTF_8));
            if(body.path("version").asInt()!=1) throw new IllegalArgumentException();
            if(!clock.instant().isBefore(Instant.parse(body.path("ticketExpiresAt").asString()))) throw new HttpFailure(409,"preparation_expired");
            return body;
        } catch(IllegalArgumentException|tools.jackson.core.JacksonException e) {throw new HttpFailure(400,"invalid_request");}
    }
    JsonNode challenge(JsonNode body) {
        available();
        return transactions.execute(status->{
            Instant now=clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);String install=body.path("installationId").asString(),attempt=body.path("attemptId").asString();
            db.execute("insert into identity_web_installations(installation_id,created_at) values(?::uuid,?::timestamptz) on conflict do nothing",install,now.toString());
            db.one("select to_jsonb(installation_id) from identity_web_installations where installation_id=?::uuid for update",install);
            if(!db.rows("select to_jsonb(context_id) from identity_web_contexts where installation_id=?::uuid and attempt_id=?::uuid",install,attempt).isEmpty()) throw new HttpFailure(409,"context_conflict");
            var count=db.one("""
                select to_jsonb(count(*)) from identity_web_contexts where installation_id=?::uuid
                and ((state='reserved' and reservation_expires_at>?::timestamptz) or
                (state='authenticated' and absolute_expires_at>?::timestamptz and last_seen_at+interval '720 hours'>?::timestamptz))
                """,install,now.toString(),now.toString(),now.toString()).asInt();
            if(count>=4) throw new HttpFailure(409,"auth_context_limit");
            String expected=body.path("expectedAccountId").isNull()?null:body.path("expectedAccountId").asString();
            if(expected!=null&&db.rows("select to_jsonb(id) from users where id=?::uuid and deleted_at is null",expected).isEmpty()) throw new HttpFailure(400,"invalid_request");
            String context=Json.id();
            var ticket=Json.object().put("version",1).put("attemptId",attempt).put("contextId",context).put("installationId",install)
                .put("issuedAt",now.toString()).put("ticketExpiresAt",now.plusSeconds(300).toString())
                .put("reservationExpiresAt",now.plusSeconds(600).toString()).put("closeCookieExpiresAt",now.plus(Duration.ofDays(91)).toString());
            ticket.set("expectedAccountId",body.path("expectedAccountId"));
            db.execute("""
                insert into identity_web_contexts(context_id,installation_id,attempt_id,expected_account_id,state,ticket_issued_at,reservation_expires_at,close_expires_at)
                values(?::uuid,?::uuid,?::uuid,?::uuid,'reserved',?::timestamptz,?::timestamptz,?::timestamptz)
                """,context,install,attempt,expected,now.toString(),ticket.path("reservationExpiresAt").asString(),ticket.path("closeCookieExpiresAt").asString());
            var response=ticket.deepCopy();response.remove("version");response.remove("expectedAccountId");
            response.put("preparationTicket",seal(ticket));return response;
        });
    }
    private JsonNode context(String id,boolean lock) {
        var rows=db.rows("select to_jsonb(c) from identity_web_contexts c where context_id=?::uuid"+(lock?" for update":""),id);
        if(rows.isEmpty()) throw new HttpFailure(404,"context_unavailable");return rows.getFirst();
    }
    private JsonNode unboundContext(String id) {
        var rows=db.rows("select to_jsonb(c) from identity_web_contexts c where context_id=?::uuid and user_id is null for update",id);
        if(rows.isEmpty()) throw new HttpFailure(409,"context_conflict");return rows.getFirst();
    }
    private JsonNode accountContext(String id,String user,boolean lock) {
        var rows=db.rows("select to_jsonb(c) from identity_web_contexts c where context_id=?::uuid and user_id=?::uuid"+(lock?" for update":""),id,user);
        if(rows.isEmpty()) throw new HttpFailure(401,"session_invalid");return rows.getFirst();
    }
    private Instant instant(JsonNode context,String field) {return OffsetDateTime.parse(context.path(field).asString()).toInstant();}
    private String state(JsonNode c) {
        String state=c.path("state").asString();
        if(state.equals("reserved")&&!clock.instant().isBefore(instant(c,"reservation_expires_at"))) return "expired";
        if(state.equals("authenticated")&&(!clock.instant().isBefore(instant(c,"absolute_expires_at"))||!clock.instant().isBefore(instant(c,"last_seen_at").plus(IDLE)))) return "expired";
        return state;
    }
    private JsonNode reservation(JsonNode c) {
        return Json.object().put("contextId",c.path("context_id").asString()).put("installationId",c.path("installation_id").asString())
            .put("reservationExpiresAt",instant(c,"reservation_expires_at").toString()).put("closeCookieExpiresAt",instant(c,"close_expires_at").toString());
    }
    private void reserved(JsonNode c) {
        String state=state(c);
        if(state.equals("expired")) throw new HttpFailure(409,"preparation_expired");
        if(state.equals("closed")) throw new HttpFailure(409,"context_closed");
        if(!state.equals("reserved")) throw new HttpFailure(409,"context_conflict");
    }
    private boolean matches(JsonNode c,String field,String secret) {
        String hash=c.path(field).asString("");
        // PostgreSQL bytea JSON uses a backslash-x prefix, never returned to HTTP.
        if(hash.length()!=66||secret==null||!secret.matches("[A-Za-z0-9_-]{43}")) return false;
        return MessageDigest.isEqual(HexFormat.of().parseHex(hash.substring(2)),HexFormat.of().parseHex(Json.digest(secret)));
    }
    private void closeCapability(JsonNode c,String secret) {
        if(!clock.instant().isBefore(instant(c,"close_expires_at"))||!matches(c,"close_secret_hash",secret)) throw new HttpFailure(401,"session_invalid");
    }
    Issued prepare(String ticket) {
        var permission=open(ticket);
        return transactions.execute(status->{
            var c=context(permission.path("contextId").asString(),true);reserved(c);
            if(!bindingMatches(c,permission)) throw new HttpFailure(409,"context_conflict");
            String close=null;
            if(c.path("close_secret_hash").isNull()) {
                close=secret();db.execute("update identity_web_contexts set close_secret_hash=decode(?,'hex') where context_id=?::uuid and state='reserved' and user_id is null",Json.digest(close),c.path("context_id").asString());
            }
            return new Issued(reservation(c),close,null,instant(c,"close_expires_at"));
        });
    }
    private boolean bindingMatches(JsonNode c,JsonNode ticket) {
        return c.path("installation_id").asString().equals(ticket.path("installationId").asString())&&c.path("attempt_id").asString().equals(ticket.path("attemptId").asString())&&
            Objects.equals(c.path("expected_account_id").isNull()?null:c.path("expected_account_id").asString(),ticket.path("expectedAccountId").isNull()?null:ticket.path("expectedAccountId").asString())&&
            instant(c,"ticket_issued_at").equals(Instant.parse(ticket.path("issuedAt").asString()));
    }
    JsonNode reservationStatus(String id) {
        var c=context(id,false);String result;
        if(!c.path("user_id").isNull()) result="proof_required";
        else result=switch(state(c)) {case "reserved"->"reserved";case "closed"->"closed_unbound";default->"expired_unbound";};
        return Json.object().put("contextId",id).put("state",result).put("reservationExpiresAt",instant(c,"reservation_expires_at").toString());
    }
    JsonNode confirm(String id,String close) {
        return transactions.execute(status->{var c=context(id,true);closeCapability(c,close);reserved(c);return reservation(c);});
    }
    private JsonNode passwordAccount(String email,String password) {
        var rows=db.rows("select to_jsonb(u) from users u where email_key=? and deleted_at is null for update",email.strip().toLowerCase(Locale.ROOT));
        if(rows.isEmpty()||!passwords.matches(password,rows.getFirst().path("password_hash").asString())) throw new HttpFailure(401,"invalid_credentials");
        return rows.getFirst();
    }
    Issued authenticate(String id,String close,JsonNode body,String epoch,String tab,boolean register) {
        return transactions.execute(status->{
            var before=context(id,false);closeCapability(before,close);reserved(before);
            String user;JsonNode c;
            if(register) {
                // No account exists yet: lock the reservation before creating its new user.
                // This also makes register replay return context_conflict before email uniqueness.
                c=unboundContext(id);closeCapability(c,close);reserved(c);
                if(!c.path("expected_account_id").isNull()) throw new HttpFailure(409,"account_mismatch");
                String name=Normalizer.normalize(body.path("displayName").asString().strip(),Normalizer.Form.NFC),email=body.path("email").asString().strip().toLowerCase(Locale.ROOT);
                if(name.isBlank()||name.codePointCount(0,name.length())>80) throw new HttpFailure(400,"invalid_request");
                user=Json.id();
                db.execute("""
                    insert into users(id,email,email_key,password_hash,display_name,timezone,created_at,updated_at)
                    values(?::uuid,?,?,?,?,'UTC',now(),now())
                    """,user,email,email,passwords.encode(body.path("password").asString()),name);
            } else {
                // Existing account is locked before context; reset cannot split verification/binding.
                user=passwordAccount(body.path("email").asString(),body.path("password").asString()).path("id").asString();
                c=unboundContext(id);
            }
            closeCapability(c,close);reserved(c);
            if(!c.path("installation_id").asString().equals(body.path("deviceId").asString())) throw new HttpFailure(409,"context_conflict");
            if(!c.path("expected_account_id").isNull()&&!c.path("expected_account_id").asString().equals(user)) throw new HttpFailure(409,"account_mismatch");
            long owner=epoch(epoch);if(owner==0) throw new HttpFailure(400,"invalid_request");
            Instant now=clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);String auth=secret();
            db.execute("""
                update identity_web_contexts set user_id=?::uuid,state='authenticated',auth_secret_hash=decode(?,'hex'),authenticated_at=?::timestamptz,
                last_seen_at=?::timestamptz,absolute_expires_at=?::timestamptz,owner_epoch=?::bigint,owner_tab_id=?::uuid
                where context_id=?::uuid and state='reserved' and user_id is null
                """,user,Json.digest(auth),now.toString(),now.toString(),now.plus(ABSOLUTE).toString(),epoch,tab,id);
            return new Issued(session(accountContext(id,user,false)),null,auth,now.plus(ABSOLUTE));
        });
    }
    public static long epoch(String value) {
        try {if(value==null||!value.matches("(0|[1-9][0-9]{0,18})")) throw new NumberFormatException();return Long.parseLong(value);}
        catch(NumberFormatException e) {throw new HttpFailure(400,"invalid_request");}
    }
    private JsonNode lockedAuthenticated(String id,String secret) {
        var before=context(id,false);
        if(before.path("user_id").isNull()) throw new HttpFailure(401,"session_invalid");
        String user=before.path("user_id").asString();
        if(db.rows("select to_jsonb(id) from users where id=?::uuid and deleted_at is null for update",user).isEmpty()) throw new HttpFailure(401,"session_invalid");
        var c=accountContext(id,user,true);
        if(!state(c).equals("authenticated")||!matches(c,"auth_secret_hash",secret)) throw new HttpFailure(401,"session_invalid");
        return c;
    }
    private JsonNode session(JsonNode c) {
        Instant idle=instant(c,"last_seen_at").plus(IDLE),absolute=instant(c,"absolute_expires_at");
        var response=Json.object().put("contextId",c.path("context_id").asString()).put("installationId",c.path("installation_id").asString()).put("accountId",c.path("user_id").asString())
            .put("authenticatedAt",instant(c,"authenticated_at").toString()).put("idleExpiresAt",(idle.isBefore(absolute)?idle:absolute).toString()).put("absoluteExpiresAt",absolute.toString())
            .put("ownerEpoch",c.path("owner_epoch").asString()).put("ownerTabId",c.path("owner_tab_id").asString());
        response.set("profile",Identity.profile(db,c.path("user_id").asString()));return response;
    }
    JsonNode inspect(String id,String secret,String epoch,String tab) {
        return transactions.execute(status->{
            var c=lockedAuthenticated(id,secret);
            if(epoch(epoch)!=c.path("owner_epoch").asLong()||!tab.equals(c.path("owner_tab_id").asString())) throw new HttpFailure(409,"owner_lost");
            limits.checkAccount(c.path("user_id").asString());touch(c);return session(accountContext(id,c.path("user_id").asString(),false));
        });
    }
    JsonNode claim(String id,String secret,String epoch,String tab) {
        return transactions.execute(status->{
            var c=lockedAuthenticated(id,secret);long next=epoch(epoch),current=c.path("owner_epoch").asLong();
            if(next<current||(next==current&&!tab.equals(c.path("owner_tab_id").asString()))) throw new HttpFailure(409,"owner_lost");
            limits.checkAccount(c.path("user_id").asString());
            db.execute("update identity_web_contexts set owner_epoch=?::bigint,owner_tab_id=?::uuid where context_id=?::uuid and user_id=?::uuid",epoch,tab,id,c.path("user_id").asString());touch(c);
            return Json.object().put("contextId",id).put("epoch",epoch).put("tabId",tab);
        });
    }
    private void touch(JsonNode c) {
        db.execute("update identity_web_contexts set last_seen_at=greatest(last_seen_at,?::timestamptz) where context_id=?::uuid and user_id=?::uuid",clock.instant().toString(),c.path("context_id").asString(),c.path("user_id").asString());
    }
    JsonNode close(String id,String secret) {
        JsonNode result;
        do {
            result=transactions.execute(status->{
                var before=context(id,false);String user=before.path("user_id").isNull()?null:before.path("user_id").asString();
                JsonNode c;
                if(user!=null) {
                    db.one("select to_jsonb(id) from users where id=?::uuid for update",user);
                    c=accountContext(id,user,true);
                } else {
                    c=context(id,true);
                    // Binding can occur between the preliminary lookup and lock. Release
                    // this transaction and retry in account -> context order; never invert it.
                    if(!c.path("user_id").isNull()) return null;
                }
                closeCapability(c,secret);return end(c,"logout");
            });
        } while(result==null);
        return result;
    }
    JsonNode recoveryClose(String id,String email,String password) {
        return transactions.execute(status->{
            String user=passwordAccount(email,password).path("id").asString();
            var rows=db.rows("select to_jsonb(c) from identity_web_contexts c where context_id=?::uuid and user_id=?::uuid for update",id,user);
            if(rows.isEmpty()) throw new HttpFailure(404,"context_unavailable");return end(rows.getFirst(),"recovery");
        });
    }
    private JsonNode end(JsonNode c,String reason) {
        String terminal=state(c).equals("expired")?"expired":"closed";
        db.execute("""
            update identity_web_contexts set state=?,closed_at=coalesce(closed_at,?::timestamptz),close_reason=coalesce(close_reason,?),
            auth_secret_hash=case when close_expires_at<=?::timestamptz then null else auth_secret_hash end,
            close_secret_hash=case when close_expires_at<=?::timestamptz then null else close_secret_hash end where context_id=?::uuid and user_id is not distinct from ?::uuid
            """,terminal,clock.instant().toString(),reason,clock.instant().toString(),clock.instant().toString(),c.path("context_id").asString(),c.path("user_id").isNull()?null:c.path("user_id").asString());
        return Json.object().put("contextId",c.path("context_id").asString()).put("state",terminal);
    }
    /** Validate/lock with the domain role, then use its very same connection for the command. */
    public <T> T authorized(Credential credential,Function<String,T> command) {
        return tenants.authorized(()->{
            String user=authorize(credential,false);limits.checkAccount(user);authorize(credential,true);return user;
        },command);
    }
    private String authorize(Credential c,boolean touch) {
        var result=domain.one("select public.identity_authorize_web_context(?::uuid,decode(?,'hex'),?::uuid,?::bigint,?::uuid,?::boolean)",
            c.contextId(),Json.digest(c.secret()),c.expectedAccount(),c.epoch(),c.tabId(),Boolean.toString(touch));
        if(result.has("error")) {String error=result.path("error").asString();throw new HttpFailure(error.equals("session_invalid")?401:409,error);}
        return result.path("userId").asString();
    }
    /** Bounded cleanup never deletes minimum recovery records. */
    public int cleanup() {
        return transactions.execute(status->{
            var rows=db.rows("""
                select to_jsonb(c) from identity_web_contexts c where
                (state='reserved' and reservation_expires_at<=?::timestamptz) or
                (state='authenticated' and (absolute_expires_at<=?::timestamptz or last_seen_at+interval '720 hours'<=?::timestamptz)) or
                (close_expires_at<=?::timestamptz and (auth_secret_hash is not null or close_secret_hash is not null))
                order by close_expires_at limit 500 for update skip locked
                """,clock.instant().toString(),clock.instant().toString(),clock.instant().toString(),clock.instant().toString());
            for(var c:rows) end(c,"expiry");return rows.size();
        });
    }
}
