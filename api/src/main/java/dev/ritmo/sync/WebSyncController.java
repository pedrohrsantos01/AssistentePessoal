package dev.ritmo.sync;

import dev.ritmo.identity.WebSessions;
import dev.ritmo.shared.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** HTTP adapter only; Identity's authorization remains inside the domain transaction. */
@RestController @RequestMapping("/api/v1/web/contexts/{contextId}/sync")
class WebSyncController {
    private final Sync sync;private final Contract contract;private final WebSessions sessions;
    WebSyncController(Sync sync,Contract contract,WebSessions sessions) {this.sync=sync;this.contract=contract;this.sessions=sessions;}
    private String id(String id) {contract.validate("Id",Json.MAPPER.valueToTree(id));return id;}
    private WebSessions.Credential credential(String context,HttpServletRequest request) {
        String epoch=request.getHeader("X-Ritmo-Owner-Epoch");WebSessions.epoch(epoch);
        return new WebSessions.Credential(id(context),WebSessions.authCookie(request),id(request.getHeader("X-Ritmo-Expected-Account")),epoch,id(request.getHeader("X-Ritmo-Owner-Tab")));
    }
    @PostMapping("/push") JsonNode push(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request,@RequestHeader("Idempotency-Key") String batch) {
        contract.validate("PushRequest",body);id(batch);return sessions.authorized(credential(contextId,request),user->sync.push(user,batch,body));
    }
    @PostMapping("/pull") JsonNode pull(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request) {
        sessions.validateWeb("PullRequest",body);
        return sessions.authorized(credential(contextId,request),user->sync.pull(user,body.path("cursor").isNull()?null:body.path("cursor").asString(),body.path("limit").asInt()));
    }
    @PostMapping("/snapshots") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    JsonNode snapshot(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request) {
        contract.validate("EmptyRequest",body);return sessions.authorized(credential(contextId,request),sync::snapshot);
    }
    @PostMapping("/snapshots/{snapshotId}") JsonNode page(@PathVariable String contextId,@PathVariable String snapshotId,@RequestBody JsonNode body,HttpServletRequest request) {
        sessions.validateWeb("SnapshotPageRequest",body);id(snapshotId);
        return sessions.authorized(credential(contextId,request),user->sync.snapshotPage(user,snapshotId,body.path("pageCursor").isNull()?null:body.path("pageCursor").asString()));
    }
    @PostMapping("/receipts") JsonNode receipts(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request) {
        contract.validate("ReceiptsRequest",body);return sessions.authorized(credential(contextId,request),user->sync.receipts(user,body));
    }
}
