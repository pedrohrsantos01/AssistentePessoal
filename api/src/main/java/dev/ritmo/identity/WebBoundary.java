package dev.ritmo.identity;

import dev.ritmo.shared.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/** Runs even for compatibility/quota/quarantine errors before Security. */
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
class WebBoundary extends OncePerRequestFilter {
    private final String origin;
    private final boolean quarantined;
    private final RateLimits limits;
    private final ClientOrigins origins;
    WebBoundary(@Value("${ritmo.web.origin:}") String origin,@Value("${ritmo.operations.quarantined}") boolean quarantined,RateLimits limits,ClientOrigins origins) {
        if(!origin.isEmpty()) {
            var uri=URI.create(origin);
            if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getRawUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||!uri.getRawPath().isEmpty()) throw new IllegalArgumentException("invalid_web_origin");
        }
        this.origin=origin;this.quarantined=quarantined;this.limits=limits;this.origins=origins;
    }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {return !request.getServletPath().startsWith("/api/v1/web/");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        response.setHeader("Cache-Control","no-store");
        if(quarantined) {HttpErrors.write(response,new HttpFailure(503,"temporarily_unavailable"));return;}
        int bytes=0;var cookies=request.getHeaders("Cookie");
        while(cookies.hasMoreElements()) bytes+=cookies.nextElement().getBytes(StandardCharsets.UTF_8).length;
        if(bytes>8192) {HttpErrors.write(response,new HttpFailure(431,"headers_too_large"));return;}
        // Charge the shared IP bucket once, even for CSRF failures, then reject
        // CSRF before parsing/compatibility reads or any identity/domain effect.
        try {
            limits.checkIp(origins.identity(request),request.getServletPath(),request.getMethod());
            request.setAttribute("ritmo.web.ip-limited",Boolean.TRUE);
            guard(request);
        }
        catch(HttpFailure failure) {HttpErrors.write(response,failure);return;}
        chain.doFilter(request,response);
    }
    void guard(HttpServletRequest request) {
        if(origin.isEmpty()) throw new HttpFailure(503,"temporarily_unavailable");
        if(!request.getMethod().equals("POST")||!single(request,"Origin",origin)||!single(request,"X-Ritmo-Web","1")) throw new HttpFailure(403,"csrf_rejected");
        try {
            String type=request.getContentType();
            if(type==null) throw new IllegalArgumentException();
            var parsed=MediaType.parseMediaType(type);
            if(!parsed.getType().equalsIgnoreCase("application")||!parsed.getSubtype().equalsIgnoreCase("json")) throw new IllegalArgumentException();
        } catch(IllegalArgumentException e) {throw new HttpFailure(403,"csrf_rejected");}
        if(request.getHeader("Authorization")!=null) throw new HttpFailure(401,"session_invalid");
    }
    private boolean single(HttpServletRequest request,String name,String value) {
        var headers=Collections.list(request.getHeaders(name));return headers.size()==1&&headers.getFirst().equals(value);
    }
    static String cookie(HttpServletRequest request,String name) {
        var found=new HashMap<String,String>();var headers=request.getHeaders("Cookie");
        while(headers.hasMoreElements()) for(String part:headers.nextElement().split(";")) {
            var pair=part.strip().split("=",2);
            if(pair.length==2&&(pair[0].equals("__Secure-ritmo-auth")||pair[0].equals("__Secure-ritmo-close"))) {
                if(found.putIfAbsent(pair[0],pair[1])!=null) throw new HttpFailure(401,"cookie_ambiguous");
            }
        }
        String value=found.get(name);
        if(value==null||!value.matches("[A-Za-z0-9_-]{43}")) throw new HttpFailure(401,"session_invalid");return value;
    }
}
