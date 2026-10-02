package dev.ritmo.shared;

import java.io.IOException;
import java.time.Duration;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Component @Order(Ordered.HIGHEST_PRECEDENCE+1)
class WalDurabilityFilter extends OncePerRequestFilter {
    private final Sql db;
    private final boolean enabled;
    private final long waitNanos;
    WalDurabilityFilter(@Qualifier("domainSql") Sql db,
        @Value("${ritmo.operations.require-wal}") boolean enabled,
        @Value("${ritmo.operations.wal-wait-ms}") long waitMs) {
        if(waitMs<1||waitMs>10000) throw new IllegalArgumentException("invalid_wal_wait_ms");
        this.db=db;this.enabled=enabled;this.waitNanos=Duration.ofMillis(waitMs).toNanos();
    }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled||!request.getServletPath().startsWith("/api/v1/");
    }
    private void requireFlush() {
        long started=System.nanoTime();String position=null;
        do {
            var status=db.one("select public.ritmo_wal_status(?::pg_lsn)",position);
            position=status.path("position").asString();
            if(status.path("durable").asBoolean()) return;
            if(System.nanoTime()-started>=waitNanos) break;
            try {Thread.sleep(10);}
            catch(InterruptedException e) {Thread.currentThread().interrupt();break;}
        } while(true);
        throw new HttpFailure(503,"temporarily_unavailable");
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        try {
            requireFlush();
            // No body is published even if a downstream writer flushes or reports a servlet error.
            var buffered=new ContentCachingResponseWrapper(response) {
                @Override public void sendError(int status) {resetBuffer();setStatus(status);}
                @Override public void sendError(int status,String message) {sendError(status);}
            };
            chain.doFilter(request,buffered);
            requireFlush();
            buffered.copyBodyToResponse();
        } catch(DataAccessException|BusinessFailure|HttpFailure failure) {
            response.reset();
            HttpErrors.write(response,new HttpFailure(503,"temporarily_unavailable"));
        }
    }
}
