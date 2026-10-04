package dev.ritmo.sync;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration(proxyBeanMethods=false)
@EnableScheduling
class RetentionScheduling {
    RetentionScheduling(@Value("${ritmo.sync-retention.enabled:true}") String enabled) {
        if(!enabled.equalsIgnoreCase("true")&&!enabled.equalsIgnoreCase("false"))
            throw new IllegalArgumentException("Invalid retention enabled flag");
    }
    @Bean(name="retentionTaskScheduler") ThreadPoolTaskScheduler retentionTaskScheduler() {
        var scheduler=new ThreadPoolTaskScheduler();scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ritmo-sync-retention-");scheduler.setRemoveOnCancelPolicy(true);return scheduler;
    }
}
