package dev.ritmo.shared;
import tools.jackson.databind.JsonNode;
public record Entity(String kind, JsonNode value) {
    public String key() {
        return kind+":"+switch(kind) {
            case "profile" -> value.path("accountId").asString();
            case "habit" -> value.path("habitId").asString();
            case "habitDay","xpDecision" -> value.path("habitDayId").asString();
            case "xpGrant" -> value.path("grantId").asString();
            case "xpBudget" -> value.path("dayKey").asString();
            case "xpTransition" -> value.path("operationId").asString()+":"+value.path("grantId").asString();
            case "tombstone" -> value.path("entityId").asString();
            default -> throw new IllegalArgumentException("unknown_entity");
        };
    }
}
