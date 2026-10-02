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
    public static JsonNode body(HttpFailure failure) {
        var body=body(failure.code);
        // The m1.1 optional body field is capped at 300; the header carries the full wait.
        if(failure.retryAfterSeconds>0&&failure.retryAfterSeconds<=300)
            ((tools.jackson.databind.node.ObjectNode)body.path("error")).put("retryAfterSeconds",failure.retryAfterSeconds);
        return body;
    }
    public static void write(jakarta.servlet.http.HttpServletResponse response,HttpFailure failure) throws java.io.IOException {
        response.setStatus(failure.status);response.setContentType("application/json");
        if(failure.retryAfterSeconds>0) response.setHeader("Retry-After",Long.toString(failure.retryAfterSeconds));
        response.getWriter().write(body(failure).toString());
    }
    @ExceptionHandler(HttpFailure.class) ResponseEntity<JsonNode> http(HttpFailure e) {
        var response=ResponseEntity.status(e.status);
        if(e.retryAfterSeconds>0) response.header("Retry-After",Long.toString(e.retryAfterSeconds));
        return response.body(body(e));
    }
    @ExceptionHandler(BusinessFailure.class) ResponseEntity<JsonNode> business(BusinessFailure e) {
        return ResponseEntity.status(e.code.equals("invalid_credentials")?401:400).body(body(e.code.equals("invalid_credentials")?e.code:"invalid_request"));
    }
    @ExceptionHandler(DuplicateKeyException.class) ResponseEntity<JsonNode> duplicate() {return ResponseEntity.status(409).body(body("email_unavailable"));}
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,IllegalArgumentException.class})
    ResponseEntity<JsonNode> invalid() {return ResponseEntity.badRequest().body(body("invalid_request"));}
    @ExceptionHandler({DataAccessException.class,org.springframework.transaction.TransactionSystemException.class,
        org.springframework.transaction.CannotCreateTransactionException.class}) ResponseEntity<JsonNode> storage() {return ResponseEntity.status(503).body(body("temporarily_unavailable"));}
}
