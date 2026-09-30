package dev.ritmo.habits;
import java.util.List;

/** Terminal invalidation; the grants keep their original identities and budget costs. */
public record HabitDeleted(String userId,List<String> habitDayIds,String startDayKey,String revision,String operationId,String acceptedAt) {}
