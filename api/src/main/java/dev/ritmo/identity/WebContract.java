package dev.ritmo.identity;

import dev.ritmo.shared.Contract;
import tools.jackson.databind.JsonNode;
import java.io.IOException;
import org.springframework.stereotype.Component;

/** Separate wire schemas; the native m1.1 contract remains untouched. */
@Component
class WebContract {
    private final Contract delegate=new ResourceContract();
    WebContract() throws IOException {}
    void validate(String name,JsonNode value) {delegate.validate(name,value);}
    private static final class ResourceContract extends Contract {
        ResourceContract() throws IOException {super("/contracts/web/openapi.json");}
    }
}
