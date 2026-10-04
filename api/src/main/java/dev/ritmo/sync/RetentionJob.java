package dev.ritmo.sync;

import dev.ritmo.identity.AccountInventory;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="ritmo.sync-retention.enabled",havingValue="true",matchIfMissing=true)
class RetentionJob {
    private static final Logger LOG=LoggerFactory.getLogger(RetentionJob.class);
    private final AccountInventory inventory;private final SyncRetention retention;
    private final int accounts;private final long budgetNanos;private final boolean quarantined;
    private final AtomicBoolean running=new AtomicBoolean();private String after;
    RetentionJob(AccountInventory inventory,SyncRetention retention,@Value("${ritmo.sync-retention.accounts:20}") int accounts,
        @Value("${ritmo.sync-retention.budget-ms:20000}") long budget,@Value("${ritmo.sync-retention.poll-ms:60000}") long poll,
        @Value("${ritmo.operations.quarantined:false}") boolean quarantined) {
        if(accounts<1||accounts>1000||budget<100||budget>60000||poll<100||poll>3600000)
            throw new IllegalArgumentException("Invalid retention executor bounds");
        this.inventory=inventory;this.retention=retention;this.accounts=accounts;this.budgetNanos=budget*1000000;this.quarantined=quarantined;
    }
    @Scheduled(scheduler="retentionTaskScheduler",fixedDelayString="${ritmo.sync-retention.poll-ms:60000}",
        initialDelayString="${ritmo.sync-retention.poll-ms:60000}")
    void tick() {
        if(quarantined||!running.compareAndSet(false,true)) return;
        long started=System.nanoTime();int processed=0;
        try {
            var page=inventory.page(after,accounts);
            for(String user:page) {
                if(System.nanoTime()-started>=budgetNanos) break;
                try {
                    var result=retention.expire(user);String status=result.path("status").asString();
                    if(status.equals("pending")||status.equals("complete")) LOG.info(
                        "Sync retention status={} envelopes={} items={} snapshots={}",status,
                        result.path("removedEnvelopes").asInt(),result.path("removedItems").asInt(),result.path("removedSnapshots").asInt());
                } catch(RuntimeException failure) { LOG.warn("Sync retention failed type={}",failure.getClass().getSimpleName()); }
                after=user;processed++;
            }
            if(processed==page.size()&&page.size()<accounts) after=null;
        } catch(RuntimeException failure) { LOG.warn("Sync retention inventory failed type={}",failure.getClass().getSimpleName()); }
        finally { running.set(false); }
    }
}
