package dev.ritmo.shared;

import io.github.bucket4j.TimeMeter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.validation.annotation.Validated;

@Configuration(proxyBeanMethods=false)
@EnableConfigurationProperties(RateLimitProperties.class)
class RateLimitConfiguration {
    @Bean TimeMeter rateLimitTime() {return TimeMeter.SYSTEM_NANOTIME;}
}

@Validated
@ConfigurationProperties("ritmo.rate-limits")
record RateLimitProperties(@Min(1) @Max(100000) int maxBuckets,
    @NotNull @Valid Limit apiIp,@NotNull @Valid Limit account,
    @NotNull @Valid Limit login,@NotNull @Valid Limit register,
    @NotNull @Valid Limit resetRequest,@NotNull @Valid Limit resetConfirm,
    @NotNull @Valid Limit refresh,@NotNull @Valid Limit revoke) {
    record Limit(@Min(1) @Max(1000000) long capacity,@Min(1) @Max(86400) long periodSeconds) {}
}
