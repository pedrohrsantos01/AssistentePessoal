package dev.ritmo.gamification;
import dev.ritmo.shared.*;
import dev.ritmo.habits.HabitChanged;
import java.util.List;
import java.util.ArrayList;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.event.EventListener;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class Gamification {
    private final Sql db;
    public Gamification(@Qualifier("domainSql") Sql db) {this.db=db;}
    @EventListener public void onHabitChanged(HabitChanged event) {
        if(!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("xp_requires_domain_transaction");
        String user=event.userId(),source=event.habitDayId(),revision=event.revision();
        var decisions=db.rows("select jsonb_build_object('outcome',outcome,'grant',xp_event_id) from xp_award_decisions where user_id=?::uuid and source_type='habit_log' and source_id=?::uuid",user,source);
        if(decisions.isEmpty()&&!event.done()) return;
        int cost=0;String grant=null,transition=null;
        if(decisions.isEmpty()) {
            int consumed=db.rows("select to_jsonb(consumed) from xp_daily_budgets where user_id=?::uuid and day_key=?::date and module='habits'",user,event.dayKey()).stream().mapToInt(v->v.asInt()).findFirst().orElse(0);
            // The valid M1 path always has room. Keep an explicit defensive no-award decision.
            boolean awarded=consumed+10<=Math.max(150,15*event.dueHabits());
            if(awarded) {
                grant=Json.id();cost=10;transition="grant";
                db.execute("""
                    insert into xp_events(user_id,id,source_type,source_id,amount,day_key,module,budget_cost,active,revision)
                    values(?::uuid,?::uuid,'habit_log',?::uuid,10,?::date,'habits',10,true,?::bigint)
                    """,user,grant,source,event.dayKey(),revision);
            }
            db.execute("insert into xp_award_decisions(user_id,source_type,source_id,outcome,xp_event_id,revision) values(?::uuid,'habit_log',?::uuid,?,?::uuid,?::bigint)",user,source,awarded?"granted":"limit_reached",grant,revision);
        } else {
            var decision=decisions.getFirst();
            if(decision.path("outcome").asString().equals("granted")) {
                grant=decision.path("grant").asString();
                boolean active=db.one("select to_jsonb(active) from xp_events where user_id=?::uuid and id=?::uuid",user,grant).asBoolean();
                if(active!=event.done()) transition=event.done()?"restore":"reverse";
                db.execute("update xp_events set active=?::boolean,revision=?::bigint where user_id=?::uuid and id=?::uuid",Boolean.toString(event.done()),revision,user,grant);
            }
            db.execute("update xp_award_decisions set revision=?::bigint where user_id=?::uuid and source_type='habit_log' and source_id=?::uuid",revision,user,source);
        }
        if(transition!=null) db.execute("""
            insert into xp_transitions(user_id,operation_id,xp_event_id,kind,accepted_at,revision)
            values(?::uuid,?::uuid,?::uuid,?,?::timestamptz,?::bigint)
            """,user,event.operationId(),grant,transition,event.acceptedAt(),revision);
        db.execute("""
            insert into xp_daily_budgets(user_id,day_key,module,consumed,due_habit_count,revision)
            values(?::uuid,?::date,'habits',?::int,?::int,?::bigint)
            on conflict(user_id,day_key,module) do update set consumed=xp_daily_budgets.consumed+excluded.consumed,
            due_habit_count=excluded.due_habit_count,revision=excluded.revision
            """,user,event.dayKey(),Integer.toString(cost),Integer.toString(event.dueHabits()),revision);
    }
    public List<Entity> projections(String user) {
        var result=new ArrayList<Entity>();
        db.rows("""
            select jsonb_build_object('grantId',id,'habitDayId',source_id,'amount',amount,'dayKey',day_key,'module',module,
            'budgetCost',budget_cost,'active',active,'revision',revision::text) from xp_events where user_id=?::uuid
            """,user).forEach(v->result.add(new Entity("xpGrant",v)));
        db.rows("""
            select jsonb_build_object('habitDayId',source_id,'outcome',outcome,'grantId',xp_event_id,'revision',revision::text)
            from xp_award_decisions where user_id=?::uuid
            """,user).forEach(v->result.add(new Entity("xpDecision",v)));
        db.rows("""
            select jsonb_build_object('dayKey',day_key,'module',module,'consumed',consumed,'dueHabitCount',due_habit_count,
            'limit',greatest(150,15*due_habit_count),'revision',revision::text) from xp_daily_budgets where user_id=?::uuid
            """,user).forEach(v->result.add(new Entity("xpBudget",v)));
        db.rows("""
            select jsonb_build_object('operationId',operation_id,'grantId',xp_event_id,'kind',kind,
            'acceptedAt',to_char(accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'revision',revision::text)
            from xp_transitions where user_id=?::uuid
            """,user).forEach(v->result.add(new Entity("xpTransition",v)));
        return result;
    }
}
