package dev.ritmo.shared;
import java.io.*;
import java.util.zip.GZIPInputStream;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;

@Component @Order(Ordered.HIGHEST_PRECEDENCE)
class ProtocolFilter extends OncePerRequestFilter {
    private final Sql db; private final RateLimits limits;
    ProtocolFilter(@Qualifier("domainSql") Sql db,RateLimits limits) {this.db=db;this.limits=limits;}
    private static final String NUMBER="(0|[1-9][0-9]{0,5})";
    private static final Pattern VERSION=Pattern.compile(NUMBER+"[.]"+NUMBER+"[.]"+NUMBER+
        "(?:-([0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*))?(?:[+][0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?");
    // The policy stores a stable release, so only the candidate's prerelease flag affects equal-core precedence.
    private record Version(int major,int minor,int patch,boolean prerelease) {
        static Version parse(String text) {
            if(text==null||text.length()>64) return null;
            var match=VERSION.matcher(text);
            if(!match.matches()) return null;
            String prerelease=match.group(4);
            if(prerelease!=null) for(String part:prerelease.split("[.]")) if(part.matches("0[0-9]+")) return null;
            return new Version(Integer.parseInt(match.group(1)),Integer.parseInt(match.group(2)),Integer.parseInt(match.group(3)),prerelease!=null);
        }
        boolean supports(Version minimum) {
            if(major!=minimum.major) return major>minimum.major;
            if(minor!=minimum.minor) return minor>minimum.minor;
            if(patch!=minimum.patch) return patch>minimum.patch;
            return !prerelease;
        }
    }
    private void fail(HttpServletResponse response,int status,String code) throws IOException {
        response.setStatus(status);response.setContentType("application/json");response.getWriter().write(HttpErrors.body(code).toString());
    }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {return !request.getServletPath().startsWith("/api/v1/");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        try {limits.checkIp(request.getRemoteAddr(),request.getServletPath(),request.getMethod());}
        catch(HttpFailure failure) {HttpErrors.write(response,failure);return;}
        var version=Version.parse(request.getHeader("X-App-Version"));
        if(!"m1.1".equals(request.getHeader("X-Ritmo-Protocol"))||version==null) {
            fail(response,426,"unsupported_version");return;
        }
        try {
            // Installation-wide policy is intentionally not tenant-scoped and the runtime role can only read it.
            var minimum=Version.parse(db.one("select jsonb_build_object('minimum',min_supported_version) from app_compatibility where singleton").path("minimum").asString());
            if(minimum==null||minimum.prerelease()) {fail(response,503,"temporarily_unavailable");return;}
            if(!version.supports(minimum)) {fail(response,426,"unsupported_version");return;}
        } catch(DataAccessException|BusinessFailure e) {fail(response,503,"temporarily_unavailable");return;}
        if(!request.getMethod().equals("POST")) {chain.doFilter(request,response);return;}
        String encoding=request.getHeader("Content-Encoding");
        if(encoding!=null&&!encoding.equals("gzip")&&!encoding.equals("identity")) {fail(response,400,"invalid_request");return;}
        try {
            InputStream input="gzip".equals(encoding)?new GZIPInputStream(request.getInputStream()):request.getInputStream();
            byte[] body=input.readNBytes(2*1024*1024+1);
            if(body.length>2*1024*1024) {fail(response,413,"payload_too_large");return;}
            // Parse once before Spring binding, so duplicate JSON keys cannot change the hashed intent.
            Json.read(new String(body,java.nio.charset.StandardCharsets.UTF_8));
            chain.doFilter(new HttpServletRequestWrapper(request) {
                @Override public ServletInputStream getInputStream() {
                    var stream=new ByteArrayInputStream(body);
                    return new ServletInputStream() {
                        @Override public int read() {return stream.read();}
                        @Override public boolean isFinished() {return stream.available()==0;}
                        @Override public boolean isReady() {return true;}
                        @Override public void setReadListener(ReadListener listener) {throw new UnsupportedOperationException();}
                    };
                }
                @Override public int getContentLength() {return body.length;}
                @Override public long getContentLengthLong() {return body.length;}
            },response);
        } catch(tools.jackson.core.JacksonException|java.util.zip.ZipException e) {fail(response,400,"invalid_request");}
    }
}
