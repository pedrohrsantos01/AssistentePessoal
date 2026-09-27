package dev.ritmo.identity;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
class RecoveryConfiguration {
    @Bean Clock recoveryClock() {return Clock.systemUTC();}
}
