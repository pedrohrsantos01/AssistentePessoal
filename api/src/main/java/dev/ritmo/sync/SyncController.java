package dev.ritmo.sync;
import dev.ritmo.shared.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/sync")
class SyncController {
    private final Sync sync; private final Contract contract;
    SyncController(Sync sync,Contract contract) {this.sync=sync;this.contract=contract;}
    @PostMapping("/push") JsonNode push(@AuthenticationPrincipal Jwt jwt,@RequestHeader("Idempotency-Key") String batch,@RequestBody String raw) {
        JsonNode body=Json.read(raw);contract.validate("PushRequest",body);contract.validate("Id",Json.MAPPER.valueToTree(batch));
        return sync.push(jwt.getSubject(),batch,body);
    }

    @GetMapping("/pull") JsonNode pull(@AuthenticationPrincipal Jwt jwt,@RequestParam(required=false) String cursor) {
        return sync.pull(jwt.getSubject(),cursor);
    }
    @PostMapping("/snapshots") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    JsonNode snapshot(@AuthenticationPrincipal Jwt jwt,@RequestBody String raw) {
        contract.validate("EmptyRequest",Json.read(raw));return sync.snapshot(jwt.getSubject());
    }
    @GetMapping("/snapshots/{snapshotId}") JsonNode page(@AuthenticationPrincipal Jwt jwt,@PathVariable String snapshotId,@RequestParam String cursor) {
        contract.validate("Id",Json.MAPPER.valueToTree(snapshotId));return sync.snapshotPage(jwt.getSubject(),snapshotId,cursor);
    }
    @PostMapping("/receipts") JsonNode receipts(@AuthenticationPrincipal Jwt jwt,@RequestBody String raw) {
        var body=Json.read(raw);contract.validate("ReceiptsRequest",body);return sync.receipts(jwt.getSubject(),body);
    }
}
