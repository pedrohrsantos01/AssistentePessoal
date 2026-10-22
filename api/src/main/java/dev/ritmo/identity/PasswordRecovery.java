package dev.ritmo.identity;
import dev.ritmo.shared.*;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Base64;
import java.security.SecureRandom;
import java.util.concurrent.*;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
class PasswordRecovery implements DisposableBean {
    private final Sql db;
    private final TransactionTemplate transactions;
    private final ResetMail mail;
    private final Clock clock;
    private final SecureRandom random=new SecureRandom();
    private final ThreadPoolExecutor deliveries=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(32),Thread.ofPlatform().daemon().name("ritmo-reset-mail-",0).factory());
    PasswordRecovery(@Qualifier("identitySql") Sql db,@Qualifier("identityTransactions") TransactionTemplate transactions,
        ResetMail mail,Clock clock) {this.db=db;this.transactions=transactions;this.mail=mail;this.clock=clock;}
    void request(String email) {
        if(!mail.available()) throw new HttpFailure(503,"temporarily_unavailable");
        String key=email.strip().toLowerCase(Locale.ROOT);
        try {
            // Existence lookup and SMTP both run outside the public response path.
            deliveries.execute(()->{
                try {deliver(key);}
                catch(RuntimeException failure) {
                    org.slf4j.LoggerFactory.getLogger(PasswordRecovery.class).warn("password_reset_delivery_failed");
                }
            });
        } catch(RejectedExecutionException full) {throw new HttpFailure(503,"temporarily_unavailable");}
    }
    void confirm(String token,String newPassword) {
        int length=newPassword.codePointCount(0,newPassword.length());
        if(length<8||length>128||newPassword.codePoints().anyMatch(cp->cp>=0xD800&&cp<=0xDFFF)) throw new HttpFailure(400,"invalid_request");
        transactions.executeWithoutResult(status->{
            var owners=db.rows("select jsonb_build_object('user',user_id) from identity_password_resets where token_hash=decode(?,'hex')",Json.digest(token));
            if(owners.isEmpty()) throw new HttpFailure(401,"reset_invalid");
            String user=owners.getFirst().path("user").asString();
            // Login, token issuance and reset serialize on the account before touching session families.
            var users=db.rows("select jsonb_build_object('id',id) from users where id=?::uuid and deleted_at is null for update",user);
            if(users.isEmpty()) throw new HttpFailure(401,"reset_invalid");
            String now=clock.instant().toString();
            var resets=db.rows("""
                select jsonb_build_object('id',id) from identity_password_resets
                where user_id=?::uuid and token_hash=decode(?,'hex') and used_at is null and expires_at>?::timestamptz
                """,user,Json.digest(token),now);
            if(resets.isEmpty()) throw new HttpFailure(401,"reset_invalid");
            String encoded=org.springframework.security.crypto.argon2.Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8().encode(newPassword);
            db.execute("update users set password_hash=?,updated_at=?::timestamptz where id=?::uuid",encoded,now,user);
            db.execute("update identity_password_resets set used_at=?::timestamptz where user_id=?::uuid and used_at is null",now,user);
            db.execute("update identity_web_contexts set state='closed',closed_at=coalesce(closed_at,?::timestamptz),close_reason='reset' where user_id=?::uuid and state in ('reserved','authenticated')",now,user);
            db.execute("update identity_sessions set revoked_at=coalesce(revoked_at,?::timestamptz) where user_id=?::uuid",now,user);
            db.execute("update identity_refresh_tokens set revoked_at=coalesce(revoked_at,?::timestamptz) where user_id=?::uuid",now,user);
        });
    }
    private void deliver(String email) {
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        boolean created=Boolean.TRUE.equals(transactions.execute(status->{
            var users=db.rows("select jsonb_build_object('id',id) from users where email_key=? and deleted_at is null for update",email);
            if(users.isEmpty()) return false;
            String user=users.getFirst().path("id").asString();
            db.execute("""
                insert into identity_password_resets(user_id,id,token_hash,expires_at)
                values(?::uuid,?::uuid,decode(?,'hex'),?::timestamptz)
                """,user,Json.id(),Json.digest(token),clock.instant().plus(Duration.ofHours(1)).toString());
            return true;
        }));
        // A usable token is committed before the external side effect. SMTP failure never changes a password.
        if(created) mail.send(email,token);
    }
    @Override public void destroy() throws InterruptedException {
        deliveries.shutdown();
        if(!deliveries.awaitTermination(5,TimeUnit.SECONDS)) deliveries.shutdownNow();
    }
}
