package dev.ritmo.habits;
import dev.ritmo.shared.*;
import com.ibm.icu.lang.UCharacter;
import java.text.Normalizer;
import java.time.*;
import java.util.List;
import java.util.ArrayList;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.JsonNode;

@Service
public class Habits {
    private final Sql db; private final ApplicationEventPublisher events; private final Clock clock;
    public Habits(@Qualifier("domainSql") Sql db,ApplicationEventPublisher events,Clock clock) {this.db=db;this.events=events;this.clock=clock;}
    public void execute(String user,JsonNode operation,String revision,JsonNode profileTimeContext) {
        var command=operation.path("command");
        String type=command.path("type").asString(),habit=command.path("habitId").asString();
        Instant acceptedAt=clock.instant();
        String now=acceptedAt.toString(),occurred=operation.path("occurredAt").asString();
        if(Instant.parse(occurred).isAfter(acceptedAt.plusSeconds(86400))) throw new BusinessFailure("day_invalid");
        if(type.equals("habit.create")||type.equals("habit.mark")||type.equals("habit.unmark")) {
            String target=command.path(type.equals("habit.create")?"startDayKey":"dayKey").asString();
            if(LocalDate.parse(target).isAfter(logicalDay(acceptedAt,profileTimeContext).plusDays(1))) throw new BusinessFailure("day_invalid");
        }
        if(type.equals("habit.create")) {
            if(!db.rows("select to_jsonb(entity_id) from sync_deleted_ids where user_id=?::uuid and entity_kind='habit' and entity_id=?::uuid",user,habit).isEmpty()) throw new BusinessFailure("id_content_conflict");
            String title=title(command.path("title").asString());
            ensureTitle(user,title,habit);
            if(!db.rows("select to_jsonb(id) from habits where user_id=?::uuid and id=?::uuid",user,habit).isEmpty()) throw new BusinessFailure("id_content_conflict");
            String day=command.path("startDayKey").asString();
            if(!day.equals(logicalDay(Instant.parse(occurred),command.path("timeContext")).toString())) throw new BusinessFailure("day_invalid");
            db.execute("""
                insert into habits(user_id,id,title,title_key,type,schedule_kind,start_day_key,creation_time_context,icon,color,sort_order,created_at,updated_at,revision)
                values(?::uuid,?::uuid,?,?,'binary','daily',?::date,?::jsonb,?,?,?::int,?::timestamptz,?::timestamptz,?::bigint)
                """,user,habit,title,key(title),day,command.path("timeContext").toString(),nullable(command,"iconKey"),nullable(command,"colorToken"),
                command.path("sortOrder").asString(),now,now,revision);
            return;
        }
        JsonNode existing=db.one("select jsonb_build_object('start',start_day_key,'title',title) from habits where user_id=?::uuid and id=?::uuid and deleted_at is null",user,habit);
        if(type.equals("habit.delete")) {
            var sources=db.rows("select to_jsonb(id) from habit_day_states where user_id=?::uuid and habit_id=?::uuid",user,habit).stream().map(v->v.asString()).toList();
            db.execute("update habits set deleted_at=?::timestamptz,updated_at=?::timestamptz,revision=?::bigint where user_id=?::uuid and id=?::uuid",now,now,revision,user,habit);
            db.execute("insert into sync_deleted_ids(user_id,entity_kind,entity_id,deleted_revision) values(?::uuid,'habit',?::uuid,?::bigint)",user,habit,revision);
            db.execute("update habit_day_states set done=false,revision=?::bigint where user_id=?::uuid and habit_id=?::uuid",revision,user,habit);
            events.publishEvent(new HabitDeleted(user,sources,existing.path("start").asString(),revision,operation.path("operationId").asString(),now));
            return;
        }
        if(type.equals("habit.patchMetadata")) {
            var patch=command.path("patch");
            if(patch.has("title")) {
                String title=title(patch.path("title").asString());ensureTitle(user,title,habit);
                db.execute("update habits set title=?,title_key=? where user_id=?::uuid and id=?::uuid",title,key(title),user,habit);
            }
            if(patch.has("iconKey")) db.execute("update habits set icon=? where user_id=?::uuid and id=?::uuid",nullable(patch,"iconKey"),user,habit);
            if(patch.has("colorToken")) db.execute("update habits set color=? where user_id=?::uuid and id=?::uuid",nullable(patch,"colorToken"),user,habit);
            if(patch.has("sortOrder")) db.execute("update habits set sort_order=?::int where user_id=?::uuid and id=?::uuid",patch.path("sortOrder").asString(),user,habit);
            db.execute("update habits set revision=?::bigint,updated_at=?::timestamptz where user_id=?::uuid and id=?::uuid",revision,now,user,habit);
            return;
        }
        String day=command.path("dayKey").asString(),op=operation.path("operationId").asString();
        LocalDate logical=logicalDay(Instant.parse(occurred),command.path("timeContext")),requested=LocalDate.parse(day);
        if(requested.isBefore(logical.minusDays(7))||requested.isAfter(logical)||requested.isBefore(LocalDate.parse(existing.path("start").asString()))) throw new BusinessFailure("day_invalid");
        var found=db.rows("select to_jsonb(id) from habit_day_states where user_id=?::uuid and habit_id=?::uuid and day_key=?::date",user,habit,day);
        String source=found.isEmpty()?Json.id():found.getFirst().asString();
        if(found.isEmpty()) db.execute("insert into habit_day_states(user_id,id,habit_id,day_key,done,revision) values(?::uuid,?::uuid,?::uuid,?::date,false,?::bigint)",user,source,habit,day,revision);
        if(type.equals("habit.mark")) {
            for(var undo:command.path("observedUndoIds")) {
                var known=db.rows("select to_jsonb(operation_id) from habit_binary_facts where user_id=?::uuid and habit_day_id=?::uuid and operation_id=?::uuid and kind='unmark'",user,source,undo.asString());
                if(known.isEmpty()) throw new BusinessFailure("resource_inaccessible");
            }
        }
        String kind=type.equals("habit.mark")?"mark":"unmark";
        if(!kind.equals("mark")&&db.one("select to_jsonb(count(*)) from habit_binary_facts where user_id=?::uuid and habit_day_id=?::uuid and kind='unmark'",user,source).asInt()>=4096) throw new BusinessFailure("context_limit_reached");
        db.execute("""
            insert into habit_binary_facts(user_id,operation_id,habit_day_id,kind,occurred_at,time_context,accepted_revision)
            values(?::uuid,?::uuid,?::uuid,?,?::timestamptz,?::jsonb,?::bigint)
            """,user,op,source,kind,occurred,command.path("timeContext").toString(),revision);
        if(kind.equals("mark")) for(var undo:command.path("observedUndoIds")) db.execute(
            "insert into habit_mark_context(user_id,habit_day_id,mark_operation_id,undo_operation_id) values(?::uuid,?::uuid,?::uuid,?::uuid)",user,source,op,undo.asString());
        boolean done=db.one("""
            select to_jsonb(exists(select 1 from habit_binary_facts m where m.user_id=?::uuid and m.habit_day_id=?::uuid and m.kind='mark'
            and not exists(select 1 from habit_binary_facts u where u.user_id=m.user_id and u.habit_day_id=m.habit_day_id and u.kind='unmark'
            and not exists(select 1 from habit_mark_context c where c.user_id=m.user_id and c.habit_day_id=m.habit_day_id
            and c.mark_operation_id=m.operation_id and c.undo_operation_id=u.operation_id))))
            """,user,source).asBoolean();
        db.execute("update habit_day_states set done=?::boolean,revision=?::bigint where user_id=?::uuid and id=?::uuid",Boolean.toString(done),revision,user,source);
        int due=dueCount(user,day);
        events.publishEvent(new HabitChanged(user,source,day,done,due,revision,op,now));
    }
    public int dueCount(String user,String day) {
        return db.one("select to_jsonb(count(*)) from habits where user_id=?::uuid and deleted_at is null and start_day_key<=?::date",user,day).asInt();
    }
    public static LocalDate logicalDay(Instant instant,JsonNode context) {
        try {
            if(!ZoneId.getAvailableZoneIds().contains(context.path("timezone").asString())) throw new IllegalArgumentException();
            ZoneId zone=ZoneId.of(context.path("timezone").asString());int hour=context.path("dayStartHour").asInt();
            if(hour<0||hour>23) throw new IllegalArgumentException();
            LocalDate date=instant.atZone(zone).toLocalDate();
            LocalDateTime wall=date.atTime(hour,0);
            var offsets=zone.getRules().getValidOffsets(wall);
            Instant boundary=offsets.isEmpty()?zone.getRules().getTransition(wall).getInstant():wall.toInstant(offsets.getFirst());
            return instant.isBefore(boundary)?date.minusDays(1):date;
        } catch(DateTimeException|IllegalArgumentException e) {throw new BusinessFailure("day_invalid");}
    }
    public static String key(String title) {
        return UCharacter.foldCase(Normalizer.normalize(title,Normalizer.Form.NFKC),true).replaceAll("(?U)\\s+"," ").strip();
    }
    private static String title(String title) {
        String normalized=Normalizer.normalize(title,Normalizer.Form.NFC).strip();
        if(normalized.isBlank()||normalized.codePointCount(0,normalized.length())>120) throw new BusinessFailure("validation_failed");
        return normalized;
    }
    private void ensureTitle(String user,String title,String except) {
        if(!db.rows("select to_jsonb(id) from habits where user_id=?::uuid and title_key=? and id<>?::uuid and deleted_at is null",user,key(title),except).isEmpty())
            throw new BusinessFailure("title_unavailable");
    }
    private static String nullable(JsonNode node,String field) {return node.path(field).isNull()?null:node.path(field).asString();}
    public List<Entity> projections(String user) {
        var result=new ArrayList<Entity>();
        db.rows("""
            select jsonb_build_object('habitId',id,'title',title,'habitType',type,'scheduleKind',schedule_kind,'startDayKey',start_day_key,
            'creationTimeContext',creation_time_context,'iconKey',icon,'colorToken',color,'sortOrder',sort_order,
            'createdAt',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'updatedAt',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'deletedAt',null,'revision',revision::text)
            from habits where user_id=?::uuid and deleted_at is null
            """,user).forEach(v->result.add(new Entity("habit",v)));
        db.rows("""
            select jsonb_build_object('habitDayId',d.id,'habitId',d.habit_id,'dayKey',d.day_key,'done',d.done,'revision',d.revision::text,
            'knownUndoIds',coalesce((select jsonb_agg(f.operation_id order by f.operation_id) from habit_binary_facts f
            where f.user_id=d.user_id and f.habit_day_id=d.id and f.kind='unmark'),'[]'::jsonb))
            from habit_day_states d where d.user_id=?::uuid
            """,user).forEach(v->result.add(new Entity("habitDay",v)));
        db.rows("""
            select jsonb_build_object('entityKind','habit','entityId',h.id,
            'deletedAt',to_char(h.deleted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'revision',d.deleted_revision::text)
            from sync_deleted_ids d join habits h on h.user_id=d.user_id and h.id=d.entity_id
            where d.user_id=?::uuid and d.entity_kind='habit' and h.deleted_at is not null
            """,user).forEach(v->result.add(new Entity("tombstone",v)));
        return result;
    }
}
