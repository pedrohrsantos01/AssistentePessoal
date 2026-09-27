package dev.ritmo.habits;
public record HabitChanged(String userId,String habitDayId,String dayKey,boolean done,int dueHabits,
    String revision,String operationId,String acceptedAt) {}
