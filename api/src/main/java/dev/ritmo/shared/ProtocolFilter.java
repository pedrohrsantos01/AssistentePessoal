package dev.ritmo.shared;
import java.io.*;
import java.util.zip.GZIPInputStream;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;

@Component @Order(Ordered.HIGHEST_PRECEDENCE)
class ProtocolFilter extends OncePerRequestFilter {
    private void fail(HttpServletResponse response,int status,String code) throws IOException {
        response.setStatus(status);response.setContentType("application/json");response.getWriter().write(HttpErrors.body(code).toString());
    }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {return !request.getRequestURI().startsWith("/api/v1/");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        String version=request.getHeader("X-App-Version");
        if(!"m1.1".equals(request.getHeader("X-Ritmo-Protocol"))||version==null||!version.matches("[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}(?:[-+][A-Za-z0-9.-]+)?")||version.startsWith("0.0.")) {
            fail(response,426,"unsupported_version");return;
        }
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
