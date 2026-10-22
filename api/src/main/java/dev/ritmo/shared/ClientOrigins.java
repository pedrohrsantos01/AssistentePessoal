package dev.ritmo.shared;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HashSet;
import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Resolves only the quota identity; never changes request scheme, host or socket peer. */
@Component
public final class ClientOrigins {
    private final Set<String> trusted;
    ClientOrigins(@Value("${ritmo.proxy.trusted-peers}") String peers,
                  @Value("${server.forward-headers-strategy:none}") String strategy,
                  @Value("${server.tomcat.remoteip.remote-ip-header:}") String nativeIp,
                  @Value("${server.tomcat.remoteip.protocol-header:}") String nativeProtocol) {
        // Explicit Tomcat headers can install RemoteIpValve even when the generic strategy is NONE.
        if(!strategy.equalsIgnoreCase("none")||!nativeIp.isBlank()||!nativeProtocol.isBlank())
            throw new IllegalArgumentException("generic_forwarding_forbidden");
        var parsed=new HashSet<String>();
        if(!peers.isBlank()) for(var peer:peers.split(",",-1)) {
            var ip=literal(peer.strip());
            if(ip==null) throw new IllegalArgumentException("invalid_trusted_proxy_peer");
            parsed.add(ip);
        }
        trusted=Set.copyOf(parsed);
    }
    public String identity(HttpServletRequest request) {
        String raw=request.getRemoteAddr();String peer=literal(raw);
        if(peer==null) return raw;
        if(!trusted.contains(peer)) return peer;
        var headers=request.getHeaders("X-Forwarded-For");
        if(!headers.hasMoreElements()) return peer;
        String value=headers.nextElement();
        if(headers.hasMoreElements()) return peer;
        var client=literal(value.strip());
        return client==null?peer:client;
    }
    private static String literal(String value) {
        if(value==null||value.isEmpty()||value.length()>45) return null;
        try {
            if(value.indexOf(':')>=0) {
                // The colon and character restriction guarantee literal parsing, without DNS or zones.
                if(!value.matches("[0-9a-fA-F:.]+")) return null;
                return InetAddress.getByName(value).getHostAddress();
            }
            if(!value.matches("(0|[1-9][0-9]{0,2})([.](0|[1-9][0-9]{0,2})){3}")) return null;
            var parts=value.split("[.]");var bytes=new byte[4];
            for(int i=0;i<4;i++) {
                int octet=Integer.parseInt(parts[i]);if(octet>255) return null;bytes[i]=(byte)octet;
            }
            return InetAddress.getByAddress(bytes).getHostAddress();
        } catch(UnknownHostException e) {return null;}
    }
}
