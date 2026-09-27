package dev.ritmo.shared;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.security.SecureRandom;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.core.StreamReadFeature;
import org.erdtman.jcs.JsonCanonicalizer;

public final class Json {
    private Json() {}
    public static final JsonMapper MAPPER=JsonMapper.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build();
    private static final SecureRandom RANDOM=new SecureRandom();
    public static JsonNode read(String text) { return MAPPER.readTree(text); }
    public static ObjectNode object() { return MAPPER.createObjectNode(); }
    public static ArrayNode array() { return MAPPER.createArrayNode(); }
    public static String id() {
        long ms=System.currentTimeMillis();
        return new UUID((ms<<16)|0x7000|(RANDOM.nextLong()&0xfff), (RANDOM.nextLong()&0x3fffffffffffffffL)|0x8000000000000000L).toString();
    }
    public static String digest(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public static String canonicalHash(JsonNode value) {
        try { return digest(new JsonCanonicalizer(value.toString()).getEncodedString()); }
        catch(java.io.IOException e) { throw new IllegalArgumentException("invalid_json",e); }
    }
    public static ArrayNode entities(List<Entity> values) {
        var result=array(); values.forEach(e->{var n=object().put("kind",e.kind());n.set("value",e.value());result.add(n);}); return result;
    }
}
