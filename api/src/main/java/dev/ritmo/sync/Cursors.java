package dev.ritmo.sync;
import dev.ritmo.shared.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import tools.jackson.databind.JsonNode;

@Component
class Cursors {
    private final SecretKeySpec key;
    Cursors(@Value("${ritmo.signing-key}") String secret) {key=new SecretKeySpec(Base64.getDecoder().decode(secret),"HmacSHA256");}
    private byte[] sign(String value) {
        try {var mac=Mac.getInstance("HmacSHA256");mac.init(key);return mac.doFinal(("ritmo-sync:"+value).getBytes(StandardCharsets.UTF_8));}
        catch(java.security.GeneralSecurityException e) {throw new IllegalStateException(e);}
    }
    String seal(JsonNode value) {
        String body=Base64.getUrlEncoder().withoutPadding().encodeToString(value.toString().getBytes(StandardCharsets.UTF_8));
        return body+"."+Base64.getUrlEncoder().withoutPadding().encodeToString(sign(body));
    }
    JsonNode open(String token,String user,String kind) {
        try {
            String[] parts=token.split("\\.",-1);
            if(parts.length!=2||!MessageDigest.isEqual(sign(parts[0]),Base64.getUrlDecoder().decode(parts[1]))) throw new IllegalArgumentException();
            var value=Json.read(new String(Base64.getUrlDecoder().decode(parts[0]),StandardCharsets.UTF_8));
            if(!value.path("user").asString().equals(user)||!value.path("kind").asString().equals(kind)) throw new IllegalArgumentException();
            return value;
        } catch(RuntimeException e) {throw new HttpFailure(409,"resync_required");}
    }
}
