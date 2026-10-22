package dev.ritmo.identity;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
@Component @ConditionalOnProperty(name="ritmo.web.maintenance-enabled",havingValue="true",matchIfMissing=true)
class WebMaintenance {
    private final WebSessions sessions;
    private final boolean quarantined;
    WebMaintenance(WebSessions sessions,@Value("${ritmo.operations.quarantined}") boolean quarantined) {this.sessions=sessions;this.quarantined=quarantined;}
    @Scheduled(fixedDelayString="${ritmo.web.cleanup-ms:60000}",initialDelayString="${ritmo.web.cleanup-ms:60000}")
    void clean() {
        if(quarantined) return;
        try {sessions.cleanup();}
        catch(RuntimeException error) {org.slf4j.LoggerFactory.getLogger(WebMaintenance.class).warn("web_context_cleanup_failed");}
    }
}
