package dev.ritmo.sync;

import dev.ritmo.shared.Database.TenantTransactions;
import dev.ritmo.shared.Json;
import dev.ritmo.shared.Sql;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class SyncRetention {
    private final Sql db;private final TenantTransactions transactions;private final Clock clock;
    private final int batch;private final long period;private final boolean quarantined;
    public SyncRetention(@Qualifier("retentionSql") Sql db,@Qualifier("retentionTransactions") TenantTransactions transactions,
        Clock clock,@Value("${ritmo.sync-retention.batch-records:500}") int batch,
        @Value("${ritmo.sync-retention.period-seconds:86400}") long period,
        @Value("${ritmo.operations.quarantined:false}") boolean quarantined) {
        if(batch<1||batch>5000||period<1||period>604800) throw new IllegalArgumentException("Invalid retention bounds");
        this.db=db;this.transactions=transactions;this.clock=clock;this.batch=batch;this.period=period;this.quarantined=quarantined;
    }
    public JsonNode expire(String user) {
        if(quarantined) return Json.object().put("status","quarantined").put("removedEnvelopes",0);
        return transactions.run(user,()->{
            db.one("select jsonb_build_array(set_config('statement_timeout','2000',true),set_config('lock_timeout','500',true))");
            var now=clock.instant();
            return db.one("select public.ritmo_expire_sync(?::uuid,?::timestamptz,?::timestamptz,?::int)",
                user,now.toString(),now.plusSeconds(period).toString(),Integer.toString(batch));
        });
    }
}
