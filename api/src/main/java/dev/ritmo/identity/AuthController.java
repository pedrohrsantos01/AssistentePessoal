package dev.ritmo.identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import dev.ritmo.shared.BusinessFailure;
import tools.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {
    private final Identity identity;
    private final dev.ritmo.shared.Contract contract;
    AuthController(Identity identity,dev.ritmo.shared.Contract contract) {this.identity=identity;this.contract=contract;}
    record Register(@NotBlank @Email @Size(max=254) String email,@NotNull String password,
        @NotBlank String displayName,@Pattern(regexp="^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$") @NotNull String deviceId) {}
    record Login(@NotBlank @Email String email,@NotNull String password,@NotNull String deviceId) {}
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    JsonNode register(@Valid @RequestBody Register body) {
        if(!body.email().chars().allMatch(c->c<128)) throw new BusinessFailure("validation_failed");
        return identity.register(body.email(),body.password(),body.displayName(),body.deviceId());
    }
    @PostMapping("/login") JsonNode login(@Valid @RequestBody Login body) {
        return identity.login(body.email(),body.password(),body.deviceId());
    }
    @PostMapping("/refresh")
    JsonNode refresh(@RequestBody JsonNode body) {
        contract.validate("RefreshRequest",body);
        return identity.refresh(body.path("refreshToken").asString());
    }
    @PostMapping("/revoke") @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(@RequestBody JsonNode body) {
        contract.validate("RevokeRequest",body);
        identity.revoke(body.path("revokeToken").asString());
    }
}
