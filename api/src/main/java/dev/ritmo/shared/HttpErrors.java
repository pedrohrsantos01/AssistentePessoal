package dev.ritmo.shared;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import tools.jackson.databind.JsonNode;

@RestControllerAdvice
public class HttpErrors {
    public static JsonNode body(String code) {
        var error=Json.object().put("code",code).put("requestId",Json.id());
        error.set("fields",Json.array());error.putNull("retryAfterSeconds");
        var body=Json.object();body.set("error",error);return body;
    }
    @ExceptionHandler(HttpFailure.class) ResponseEntity<JsonNode> http(HttpFailure e) {return ResponseEntity.status(e.status).body(body(e.code));}
    @ExceptionHandler(BusinessFailure.class) ResponseEntity<JsonNode> business(BusinessFailure e) {
        return ResponseEntity.status(e.code.equals("invalid_credentials")?401:400).body(body(e.code.equals("invalid_credentials")?e.code:"invalid_request"));
    }
    @ExceptionHandler(DuplicateKeyException.class) ResponseEntity<JsonNode> duplicate() {return ResponseEntity.status(409).body(body("email_unavailable"));}
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,IllegalArgumentException.class})
    ResponseEntity<JsonNode> invalid() {return ResponseEntity.badRequest().body(body("invalid_request"));}
    @ExceptionHandler(DataAccessException.class) ResponseEntity<JsonNode> storage() {return ResponseEntity.status(503).body(body("temporarily_unavailable"));}
}
