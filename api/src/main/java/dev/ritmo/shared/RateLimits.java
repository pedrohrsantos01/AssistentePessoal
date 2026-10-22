package dev.ritmo.shared;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.TimeMeter;
import org.springframework.stereotype.Component;

/** Local single-instance quotas. Keys live only in bounded process memory. */
@Component
public final class RateLimits {
    private record Key(String scope,String identity) {}
    private static final class Entry {
        final Bucket bucket;
        final long idleNanos;
        long lastSeen;
        Entry(RateLimitProperties.Limit limit,TimeMeter time,long now) {
            idleNanos=Duration.ofSeconds(limit.periodSeconds()).toNanos();lastSeen=now;
            bucket=Bucket.builder().withCustomTimePrecision(time)
                .addLimit(b->b.capacity(limit.capacity()).refillGreedy(limit.capacity(),Duration.ofSeconds(limit.periodSeconds()))).build();
        }
    }
    private final Map<Key,Entry> buckets=new HashMap<>();
    private final RateLimitProperties policy;
    private final TimeMeter time;
    RateLimits(RateLimitProperties policy,TimeMeter time) {this.policy=policy;this.time=time;}

    public void checkIp(String peer,String path,String method) {
        consume(new Key("api-ip",peer),policy.apiIp());
        if(!method.equals("POST")) return;
        if(path.startsWith("/api/v1/web/")) {
            if(path.equals("/api/v1/web/auth/recovery-close")) {
                consume(new Key("/api/v1/auth/login",peer),policy.login());
                consume(new Key("/api/v1/auth/revoke",peer),policy.revoke());return;
            }
            if(path.contains("/sync/")) return;
            if(path.endsWith("/password-reset/request")) path="/api/v1/auth/password-reset/request";
            else if(path.endsWith("/password-reset/confirm")) path="/api/v1/auth/password-reset/confirm";
            else if(path.endsWith("/login")) path="/api/v1/auth/login";
            else if(path.endsWith("/register")) path="/api/v1/auth/register";
            else if(path.endsWith("/close")) path="/api/v1/auth/revoke";
            else path="/api/v1/auth/refresh";
        }
        var endpoint=switch(path) {
            case "/api/v1/auth/login" -> policy.login();
            case "/api/v1/auth/register" -> policy.register();
            case "/api/v1/auth/password-reset/request" -> policy.resetRequest();
            case "/api/v1/auth/password-reset/confirm" -> policy.resetConfirm();
            case "/api/v1/auth/refresh" -> policy.refresh();
            case "/api/v1/auth/revoke" -> policy.revoke();
            default -> null;
        };
        if(endpoint!=null) consume(new Key(path,peer),endpoint);
    }
    public void checkAccount(String userId) {consume(new Key("account",userId),policy.account());}
    // One lock also makes capacity reservation and safe eviction atomic under concurrent arrivals.
    private synchronized void consume(Key key,RateLimitProperties.Limit limit) {
        long now=time.currentTimeNanos();
        var entry=buckets.get(key);
        if(entry==null) {
            if(buckets.size()>=policy.maxBuckets()) {
                // A whole refill period with no request guarantees no token debt remains.
                buckets.entrySet().removeIf(e->now-e.getValue().lastSeen>=e.getValue().idleNanos);
                if(buckets.size()>=policy.maxBuckets()) {
                    long wait=buckets.values().stream().mapToLong(e->e.idleNanos-(now-e.lastSeen)).min().orElse(1000000000L);
                    throw new HttpFailure(503,"temporarily_unavailable",seconds(wait));
                }
            }
            entry=new Entry(limit,time,now);buckets.put(key,entry);
        }
        entry.lastSeen=now;
        var result=entry.bucket.tryConsumeAndReturnRemaining(1);
        if(!result.isConsumed()) throw new HttpFailure(429,"rate_limited",seconds(result.getNanosToWaitForRefill()));
    }
    private static long seconds(long nanos) {return Math.max(1,1+(nanos-1)/1000000000L);}
}
