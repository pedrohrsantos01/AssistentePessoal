package dev.ritmo;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
class ModularityTests {
    @Test void modulesRespectTheirPublicInterfaces() {
        ApplicationModules.of(RitmoApplication.class).verify();
    }
}
