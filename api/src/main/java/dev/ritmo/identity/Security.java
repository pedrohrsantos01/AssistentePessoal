package dev.ritmo.identity;
import java.time.Instant;
import java.time.Duration;
import java.util.Base64;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

@Configuration
public class Security {
    @Bean SecretKeySpec key(@Value("${ritmo.signing-key}") String encoded) {
        byte[] key=Base64.getDecoder().decode(encoded);
        if(key.length<32) throw new IllegalArgumentException("signing_key_too_short");
        return new SecretKeySpec(key,"HmacSHA256");
    }
    @Bean JwtDecoder decoder(SecretKeySpec key) {
        var decoder=NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(Duration.ZERO),new JwtIssuerValidator("ritmo")));
        return decoder;
    }
    @Bean JwtEncoder encoder(SecretKeySpec key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean SecurityFilterChain filterChain(HttpSecurity http,dev.ritmo.shared.RateLimits limits) throws Exception {
        // Constructed only here: registering it as a servlet bean would charge requests twice.
        var accountQuota=new org.springframework.web.filter.OncePerRequestFilter() {
            @Override protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request,
                jakarta.servlet.http.HttpServletResponse response,jakarta.servlet.FilterChain chain)
                throws java.io.IOException,jakarta.servlet.ServletException {
                var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if(request.getServletPath().startsWith("/api/v1/")&&auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwt) {
                    try {limits.checkAccount(jwt.getToken().getSubject());}
                    catch(dev.ritmo.shared.HttpFailure failure) {dev.ritmo.shared.HttpErrors.write(response,failure);return;}
                }
                chain.doFilter(request,response);
            }
        };
        return http.addFilterAfter(accountQuota,org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter.class).csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a->a.requestMatchers("/api/v1/auth/**").permitAll().anyRequest().authenticated())
            .oauth2ResourceServer(o->o.jwt(j->{}).authenticationEntryPoint((request,response,error)->{
                response.setStatus(401);response.setContentType("application/json");response.getWriter().write(dev.ritmo.shared.HttpErrors.body("session_invalid").toString());
            })).build();
    }
    public static String issue(JwtEncoder encoder,String user,String plan,String timezone,Instant now) {
        var claims=JwtClaimsSet.builder().issuer("ritmo").subject(user).claim("plan",plan).claim("tz",timezone).issuedAt(now).expiresAt(now.plus(Duration.ofMinutes(15))).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
    }
}
