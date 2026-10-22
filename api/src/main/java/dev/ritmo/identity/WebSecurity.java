package dev.ritmo.identity;

import dev.ritmo.shared.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
class WebSecurity {
    @Bean @Order(1)
    SecurityFilterChain webFilterChain(HttpSecurity http,WebBoundary boundary) throws Exception {
        var guard=new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
                try {boundary.guard(request);}
                catch(HttpFailure failure) {HttpErrors.write(response,failure);return;}
                chain.doFilter(request,response);
            }
        };
        // Replaces session-token CSRF with the specified strict origin + non-simple JSON header guard.
        // No bearer provider, HttpSession, login form, CORS grant or CSRF cookie on this chain.
        return http.securityMatcher("/api/v1/web/**").addFilterBefore(guard,CsrfFilter.class)
            .csrf(c->c.disable()).requestCache(c->c.disable()).logout(c->c.disable())
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a->a.anyRequest().permitAll()).build();
    }
}
