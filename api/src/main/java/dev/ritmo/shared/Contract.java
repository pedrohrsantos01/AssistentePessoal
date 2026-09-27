package dev.ritmo.shared;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.dialect.Dialects;
import com.networknt.schema.InputFormat;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class Contract {
    private final SchemaRegistry registry=SchemaRegistry.withDialect(Dialects.getDraft202012());
    private final JsonNode document;
    private final ConcurrentHashMap<String,Schema> schemas=new ConcurrentHashMap<>();
    public Contract() throws java.io.IOException {
        try(var input=getClass().getResourceAsStream("/contracts/openapi.json")) {
            if(input==null) throw new IllegalStateException("contract_missing");
            document=Json.read(new String(input.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
        }
    }
    public void validate(String name,JsonNode value) {
        Schema schema=schemas.computeIfAbsent(name,key->{
            var root=Json.object().put("$schema","https://json-schema.org/draft/2020-12/schema")
                .put("$ref","#/components/schemas/"+key);
            root.set("components",document.path("components"));
            return registry.getSchema(root.toString());
        });
        if(!schema.validate(value.toString(),InputFormat.JSON,c->c.executionConfig(config->config.formatAssertionsEnabled(true))).isEmpty())
            throw new HttpFailure(400,"invalid_request");
    }
}
