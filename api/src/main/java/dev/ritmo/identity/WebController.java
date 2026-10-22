package dev.ritmo.identity;

import dev.ritmo.shared.*;
import jakarta.servlet.http.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController @RequestMapping("/api/v1/web")
class WebController {
    private final WebSessions sessions;
    private final WebContract contract;
    private final PasswordRecovery recovery;
    private static final DateTimeFormatter EXPIRES=DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss 'GMT'",Locale.US).withZone(ZoneOffset.UTC);
    WebController(WebSessions sessions,WebContract contract,PasswordRecovery recovery) {this.sessions=sessions;this.contract=contract;this.recovery=recovery;}
    private void validate(String schema,JsonNode body) {contract.validate(schema,body);}
    private String id(String id) {contract.validate("Id",Json.MAPPER.valueToTree(id));return id;}
    private String epoch(HttpServletRequest request) {String value=request.getHeader("X-Ritmo-Owner-Epoch");WebSessions.epoch(value);return value;}
    private String tab(HttpServletRequest request) {return id(request.getHeader("X-Ritmo-Owner-Tab"));}
    private void cookie(HttpServletResponse response,String name,String value,String id,Instant expiry) {
        response.addHeader("Set-Cookie",name+"="+value+"; Path=/api/v1/web/contexts/"+id+"/; Expires="+EXPIRES.format(expiry)+"; Secure; HttpOnly; SameSite=Strict");
    }
    private void clear(HttpServletResponse response,String id) {
        for(String name:new String[]{"__Secure-ritmo-auth","__Secure-ritmo-close"}) cookie(response,name,"",id,Instant.EPOCH);
    }
    @PostMapping("/auth/challenge") JsonNode challenge(@RequestBody JsonNode body) {validate("ChallengeRequest",body);return sessions.challenge(body);}
    @PostMapping("/auth/prepare") JsonNode prepare(@RequestBody JsonNode body,HttpServletResponse response) {
        validate("PrepareRequest",body);var issued=sessions.prepare(body.path("preparationTicket").asString());
        if(issued.closeSecret()!=null) cookie(response,"__Secure-ritmo-close",issued.closeSecret(),issued.body().path("contextId").asString(),issued.expires());return issued.body();
    }
    @PostMapping("/contexts/{contextId}/reservation-status") JsonNode status(@PathVariable String contextId,@RequestBody JsonNode body) {
        validate("Empty",body);return sessions.reservationStatus(id(contextId));
    }
    @PostMapping("/contexts/{contextId}/confirm-reservation") JsonNode confirm(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request) {
        validate("Empty",body);return sessions.confirm(id(contextId),WebBoundary.cookie(request,"__Secure-ritmo-close"));
    }
    @PostMapping("/contexts/{contextId}/login") JsonNode login(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request,HttpServletResponse response) {
        return authenticate(contextId,body,request,response,false);
    }
    @PostMapping("/contexts/{contextId}/register") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    JsonNode register(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request,HttpServletResponse response) {return authenticate(contextId,body,request,response,true);}
    private JsonNode authenticate(String contextId,JsonNode body,HttpServletRequest request,HttpServletResponse response,boolean register) {
        validate(register?"WebRegisterRequest":"WebLoginRequest",body);id(contextId);
        var issued=sessions.authenticate(contextId,WebBoundary.cookie(request,"__Secure-ritmo-close"),body,epoch(request),tab(request),register);
        cookie(response,"__Secure-ritmo-auth",issued.authSecret(),contextId,issued.expires());return issued.body();
    }
    @PostMapping("/contexts/{contextId}/inspect") JsonNode inspect(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request) {
        validate("Empty",body);return sessions.inspect(id(contextId),WebBoundary.cookie(request,"__Secure-ritmo-auth"),epoch(request),tab(request));
    }
    @PostMapping("/contexts/{contextId}/claim-owner") JsonNode claim(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request) {
        validate("OwnerClaim",body);id(body.path("tabId").asString());return sessions.claim(id(contextId),WebBoundary.cookie(request,"__Secure-ritmo-auth"),body.path("epoch").asString(),body.path("tabId").asString());
    }
    @PostMapping("/contexts/{contextId}/close") JsonNode close(@PathVariable String contextId,@RequestBody JsonNode body,HttpServletRequest request,HttpServletResponse response) {
        validate("Empty",body);var result=sessions.close(id(contextId),WebBoundary.cookie(request,"__Secure-ritmo-close"));clear(response,contextId);return result;
    }
    @PostMapping("/auth/recovery-close") JsonNode recoveryClose(@RequestBody JsonNode body,HttpServletResponse response) {
        validate("RecoveryCloseRequest",body);String context=body.path("contextId").asString();
        var result=sessions.recoveryClose(context,body.path("email").asString(),body.path("password").asString());clear(response,context);return result;
    }
    @PostMapping("/auth/password-reset/request") @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    JsonNode resetRequest(@RequestBody JsonNode body) {validate("ResetRequest",body);recovery.request(body.path("email").asString());return Json.object();}
    @PostMapping("/auth/password-reset/confirm") JsonNode resetConfirm(@RequestBody JsonNode body) {
        validate("ResetConfirmRequest",body);recovery.confirm(body.path("resetToken").asString(),body.path("newPassword").asString());return Json.object();
    }
}
