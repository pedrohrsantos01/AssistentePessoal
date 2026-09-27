package dev.ritmo.identity;
import dev.ritmo.shared.*;
import java.time.Instant;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Base64;
import java.security.SecureRandom;
import java.text.Normalizer;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class Identity {
    private final Sql identity;
    private final Sql domain;
    private final TransactionTemplate transactions;
    private final JwtEncoder encoder;
    private final Argon2PasswordEncoder passwords=Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    private final SecureRandom random=new SecureRandom();
    public Identity(@Qualifier("identitySql") Sql identity,@Qualifier("domainSql") Sql domain,
        @Qualifier("identityTransactions") TransactionTemplate transactions,JwtEncoder encoder) {
        this.identity=identity;this.domain=domain;this.transactions=transactions;this.encoder=encoder;
    }
    public JsonNode register(String email,String password,String displayName,String device) {
        String key=email.strip().toLowerCase(Locale.ROOT);
        String name=Normalizer.normalize(displayName.strip(),Normalizer.Form.NFC);
        if(name.isBlank()||name.codePointCount(0,name.length())>80) throw new BusinessFailure("validation_failed");
        validatePassword(password);
        return transactions.execute(status->{
            String user=Json.id();
            identity.execute("""
                insert into users(id,email,email_key,password_hash,display_name,timezone,created_at,updated_at)
                values(?::uuid,?,?,?,?, 'UTC',now(),now())
                """,user,key,key,passwords.encode(password),name);
            return session(user,device);
        });
    }
    public JsonNode login(String email,String password,String device) {
        return transactions.execute(status->{
            var rows=identity.rows("select jsonb_build_object('id',id,'hash',password_hash) from users where email_key=? and deleted_at is null",
                email.strip().toLowerCase(Locale.ROOT));
            if(rows.isEmpty()||!passwords.matches(password,rows.getFirst().path("hash").asString())) throw new BusinessFailure("invalid_credentials");
            return session(rows.getFirst().path("id").asString(),device);
        });
    }
    public JsonNode refresh(String token) {
        return transactions.execute(status->{
            // Refresh and revoke serialize on the family, including parallel use of the same token.
            var families=identity.rows("""
                select jsonb_build_object('user',s.user_id,'id',s.id) from identity_sessions s
                join identity_refresh_tokens t on t.user_id=s.user_id and t.session_id=s.id
                join users u on u.id=s.user_id and u.deleted_at is null
                where t.token_hash=decode(?,'hex') for update of s
                """,Json.digest(token));
            if(families.isEmpty()) throw new HttpFailure(401,"session_invalid");
            var family=families.getFirst();String user=family.path("user").asString(),session=family.path("id").asString();
            var usable=identity.rows("""
                select jsonb_build_object('id',t.id) from identity_refresh_tokens t
                join identity_sessions s on s.user_id=t.user_id and s.id=t.session_id
                where t.user_id=?::uuid and t.session_id=?::uuid and t.token_hash=decode(?,'hex')
                and t.used_at is null and t.revoked_at is null and t.expires_at>clock_timestamp()
                and s.revoked_at is null and s.expires_at>clock_timestamp()
                """,user,session,Json.digest(token));
            if(usable.isEmpty()) throw new HttpFailure(401,"session_invalid");
            Instant now=Instant.now(),expires=now.plus(Duration.ofDays(30));String next=secret(),nextId=Json.id();
            identity.execute("""
                insert into identity_refresh_tokens(user_id,id,session_id,token_hash,expires_at)
                values(?::uuid,?::uuid,?::uuid,decode(?,'hex'),?::timestamptz)
                """,user,nextId,session,Json.digest(next),expires.toString());
            identity.execute("update identity_refresh_tokens set used_at=?::timestamptz,replacement_id=?::uuid where user_id=?::uuid and id=?::uuid",
                now.toString(),nextId,user,usable.getFirst().path("id").asString());
            identity.execute("update identity_sessions set expires_at=?::timestamptz where user_id=?::uuid and id=?::uuid",expires.toString(),user,session);
            var accountProfile=profile(identity,user);
            var response=Json.object().put("accountId",user).put("sessionId",session)
                .put("accessToken",Security.issue(encoder,user,accountProfile.path("plan").asString(),accountProfile.at("/timeContext/timezone").asString(),now)).put("accessExpiresAt",now.plusSeconds(900).toString())
                .put("refreshToken",next).put("refreshExpiresAt",expires.toString());
            response.set("profile",accountProfile);return response;
        });
    }
    public void revoke(String token) {
        transactions.executeWithoutResult(status->{
            var sessions=identity.rows("select jsonb_build_object('user',user_id,'id',id) from identity_sessions where revoke_secret_hash=decode(?,'hex') for update",Json.digest(token));
            if(sessions.isEmpty()) return;
            var session=sessions.getFirst();String user=session.path("user").asString(),id=session.path("id").asString();
            identity.execute("update identity_sessions set revoked_at=coalesce(revoked_at,now()) where user_id=?::uuid and id=?::uuid",user,id);
            identity.execute("update identity_refresh_tokens set revoked_at=coalesce(revoked_at,now()) where user_id=?::uuid and session_id=?::uuid",user,id);
        });
    }
    private String secret() {byte[] bytes=new byte[32];random.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    private JsonNode session(String user,String device) {
        Instant now=Instant.now();String session=Json.id(),refresh=secret(),revoke=secret();
        identity.execute("""
            insert into identity_sessions(user_id,id,device_id,revoke_secret_hash,expires_at,created_at)
            values(?::uuid,?::uuid,?::uuid,decode(?,'hex'),?::timestamptz,?::timestamptz)
            """,user,session,device,Json.digest(revoke),now.plus(Duration.ofDays(30)).toString(),now.toString());
        identity.execute("""
            insert into identity_refresh_tokens(user_id,id,session_id,token_hash,expires_at)
            values(?::uuid,?::uuid,?::uuid,decode(?,'hex'),?::timestamptz)
            """,user,Json.id(),session,Json.digest(refresh),now.plus(Duration.ofDays(30)).toString());
        var accountProfile=profile(identity,user);
        ObjectNode response=Json.object().put("accountId",user).put("sessionId",session)
            .put("accessToken",Security.issue(encoder,user,accountProfile.path("plan").asString(),accountProfile.at("/timeContext/timezone").asString(),now)).put("accessExpiresAt",now.plusSeconds(900).toString())
            .put("refreshToken",refresh).put("refreshExpiresAt",now.plus(Duration.ofDays(30)).toString()).put("revokeToken",revoke);
        response.set("profile",accountProfile);return response;
    }
    private static void validatePassword(String value) {
        int count=value.codePointCount(0,value.length());
        if(count<8||count>128) throw new BusinessFailure("validation_failed");
    }
    private JsonNode profile(Sql db,String user) {
        return db.one("""
            select jsonb_build_object('accountId',id,'displayName',display_name,
            'timeContext',jsonb_build_object('timezone',timezone,'dayStartHour',day_start_hour),
            'plan',plan,'onboardedAt',case when onboarded_at is null then null else to_char(onboarded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
            'analyticsConsentAt',case when analytics_consent_at is null then null else to_char(analytics_consent_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
            'revision',revision::text) from users where id=?::uuid and deleted_at is null
            """,user);
    }
    public void onboard(String user,JsonNode command,String revision) {
        java.time.ZoneId.of(command.at("/timeContext/timezone").asString());
        domain.execute("update users set timezone=?,day_start_hour=?::int,onboarded_at=case when ?::boolean then coalesce(onboarded_at,now()) else onboarded_at end,analytics_consent_at=case when ?::boolean then coalesce(analytics_consent_at,now()) else null end,updated_at=now(),revision=?::bigint where id=?::uuid and deleted_at is null",
            command.at("/timeContext/timezone").asString(),command.at("/timeContext/dayStartHour").asString(),command.path("completed").asString(),command.path("analyticsConsent").asString(),revision,user);
    }
    public List<Entity> projections(String user) { return List.of(new Entity("profile",profile(domain,user))); }
}
