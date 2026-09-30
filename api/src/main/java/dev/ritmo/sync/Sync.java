package dev.ritmo.sync;
import dev.ritmo.shared.*;
import dev.ritmo.shared.Database.TenantTransactions;
import dev.ritmo.identity.Identity;
import dev.ritmo.habits.Habits;
import dev.ritmo.gamification.Gamification;
import java.time.Instant;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class Sync {
    private final Sql db; private final TenantTransactions transactions; private final TransactionTemplate nested;
    private final Clock clock; private final Cursors cursors; private final Identity identity; private final Habits habits; private final Gamification xp;
    public Sync(@Qualifier("domainSql") Sql db,TenantTransactions transactions,PlatformTransactionManager manager,Identity identity,Habits habits,Gamification xp,Cursors cursors,Clock clock) {
        this.clock=clock;this.cursors=cursors;this.db=db;this.transactions=transactions;this.identity=identity;this.habits=habits;this.xp=xp;
        nested=new TransactionTemplate(manager);nested.setPropagationBehavior(TransactionDefinition.PROPAGATION_NESTED);
    }
    private List<Entity> projections(String user) {
        var all=new ArrayList<Entity>();all.addAll(identity.projections(user));all.addAll(habits.projections(user));all.addAll(xp.projections(user));return all;
    }
    private void lock(String user) {
        identity.projections(user);
        db.execute("insert into sync_account_state(user_id,feed_epoch) values(?::uuid,?::uuid) on conflict do nothing",user,Json.id());
        db.one("select to_jsonb(last_revision) from sync_account_state where user_id=?::uuid for update",user);
    }
    public JsonNode push(String user,String batch,JsonNode body) {
        var ids=new HashSet<String>();
        for(var op:body.path("operations")) if(!ids.add(op.path("operationId").asString())) throw new HttpFailure(400,"invalid_request");
        return transactions.run(user,()->{
            lock(user);
            String hash=Json.canonicalHash(body);
            var previous=db.rows("select to_jsonb(encode(payload_hash,'hex')) from sync_batches where user_id=?::uuid and batch_id=?::uuid",user,batch);
            if(!previous.isEmpty()&&!previous.getFirst().asString().equals(hash)) throw new HttpFailure(409,"idempotency_key_conflict");
            if(previous.isEmpty()) db.execute("insert into sync_batches(user_id,batch_id,payload_hash,created_at) values(?::uuid,?::uuid,decode(?,'hex'),now())",user,batch,hash);
            var pending=new LinkedHashMap<String,JsonNode>();
            var completed=new HashMap<String,JsonNode>();
            for(var operation:body.path("operations")) {
                String id=operation.path("operationId").asString();
                if(db.rows("select to_jsonb(operation_id) from sync_operation_receipts where user_id=?::uuid and operation_id=?::uuid",user,id).isEmpty()) pending.put(id,operation);
                else completed.put(id,process(user,operation,Set.of()));
            }
            var ordered=new ArrayList<JsonNode>();var cycles=new HashSet<String>();var visited=new HashSet<String>();
            // At most 50 operations: reachability from each node identifies every member of overlapping cycles.
            for(String id:pending.keySet()) if(reaches(id,id,pending,new HashSet<>())) cycles.add(id);
            for(String id:pending.keySet()) visitDependencies(id,pending,visited,ordered);
            for(var operation:ordered) completed.put(operation.path("operationId").asString(),process(user,operation,cycles));
            var results=Json.array();
            for(var operation:body.path("operations")) results.add(completed.get(operation.path("operationId").asString()));
            var result=Json.object().put("serverTime",clock.instant().toString());result.set("results",results);return result;
        });
    }
    private boolean reaches(String target,String id,Map<String,JsonNode> operations,Set<String> visited) {
        if(!operations.containsKey(id)||!visited.add(id)) return false;
        for(var dependency:operations.get(id).path("dependsOn"))
            if(dependency.asString().equals(target)||reaches(target,dependency.asString(),operations,visited)) return true;
        return false;
    }
    private void visitDependencies(String id,Map<String,JsonNode> operations,Set<String> visited,List<JsonNode> ordered) {
        if(!operations.containsKey(id)||!visited.add(id)) return;
        for(var dependency:operations.get(id).path("dependsOn")) visitDependencies(dependency.asString(),operations,visited,ordered);
        ordered.add(operations.get(id));
    }
    private JsonNode process(String user,JsonNode operation,Set<String> cycles) {
        String id=operation.path("operationId").asString(),hash=Json.canonicalHash(operation);
        var previous=db.rows("""
            select jsonb_build_object('hash',encode(payload_hash,'hex'),'receipt',result,'keys',affected_keys)
            from sync_operation_receipts where user_id=?::uuid and operation_id=?::uuid
            """,user,id);
        if(!previous.isEmpty()) {
            var stored=previous.getFirst();
            if(!stored.path("hash").asString().equals(hash)) return result(rejection(id,"id_content_conflict"),false,List.of());
            var keys=new HashSet<String>();stored.path("keys").forEach(k->keys.add(k.asString()));
            return result(stored.path("receipt"),true,projections(user).stream().filter(e->keys.contains(e.key())).toList());
        }
        var sequence=db.rows("select to_jsonb(operation_id) from sync_operation_receipts where user_id=?::uuid and device_id=?::uuid and client_sequence=?::bigint",user,operation.path("deviceId").asString(),operation.path("clientSequence").asString());
        if(!sequence.isEmpty()) return result(rejection(id,"id_content_conflict"),false,List.of());
        if(cycles.contains(id)) {
            var references=new ArrayList<String>();
            for(var dependency:operation.path("dependsOn")) if(cycles.contains(dependency.asString())) references.add(dependency.asString());
            return reject(user,operation,hash,"dependency_cycle",references);
        }
        var missing=Json.array();var rejected=new ArrayList<String>();
        for(var dependency:operation.path("dependsOn")) {
            var parents=db.rows("select to_jsonb(outcome) from sync_operation_receipts where user_id=?::uuid and operation_id=?::uuid",user,dependency.asString());
            if(parents.isEmpty()) missing.add(dependency);
            else if(parents.getFirst().asString().equals("rejected")) rejected.add(dependency.asString());
        }
        if(!rejected.isEmpty()) return reject(user,operation,hash,"dependency_rejected",rejected);
        if(!missing.isEmpty()) {var deferred=Json.object().put("operationId",id).put("status","deferred");deferred.set("missingDependencyIds",missing);return deferred;}
        try {
            return nested.execute(status->{
                long current=db.one("select to_jsonb(last_revision) from sync_account_state where user_id=?::uuid",user).asLong();
                String revision=Long.toString(Math.addExact(current,1));
                if(operation.at("/command/type").asString().equals("profile.setOnboarding")) identity.onboard(user,operation.path("command"),revision);
                else habits.execute(user,operation,revision,identity.projections(user).getFirst().value().path("timeContext"));
                var affected=projections(user).stream().filter(e->e.value().path("revision").asString().equals(revision)).toList();
                var receipt=Json.object().put("operationId",id).put("status","accepted").put("acceptedRevision",revision);
                saveReceipt(user,operation,hash,receipt,affected);
                var change=Json.object().put("revision",revision);
                change.set("operationResults",Json.array().add(receipt));change.set("entities",Json.entities(affected));
                db.execute("insert into sync_changes(user_id,revision,committed_at,envelope) values(?::uuid,?::bigint,?::timestamptz,?::jsonb)",user,revision,clock.instant().toString(),change.toString());
                db.execute("update sync_account_state set last_revision=?::bigint where user_id=?::uuid",revision,user);
                return result(receipt,false,affected);
            });
        } catch(BusinessFailure failure) {return reject(user,operation,hash,failure.code);}
    }
    private JsonNode reject(String user,JsonNode operation,String hash,String code) {
        return reject(user,operation,hash,code,List.of());
    }
    private JsonNode reject(String user,JsonNode operation,String hash,String code,List<String> dependencies) {
        var receipt=rejection(operation.path("operationId").asString(),code);
        var ids=Json.array();dependencies.forEach(ids::add);((ObjectNode)receipt.path("error")).set("dependencyIds",ids);
        saveReceipt(user,operation,hash,receipt,List.of());return result(receipt,false,List.of());
    }
    private ObjectNode rejection(String id,String code) {
        var error=Json.object().put("code",code);error.set("fields",Json.array());error.set("dependencyIds",Json.array());
        var receipt=Json.object().put("operationId",id).put("status","rejected");receipt.set("error",error);return receipt;
    }
    private void saveReceipt(String user,JsonNode operation,String hash,JsonNode receipt,List<Entity> affected) {
        var keys=Json.array();affected.forEach(e->keys.add(e.key()));
        db.execute("""
            insert into sync_operation_receipts(user_id,operation_id,device_id,client_sequence,payload_hash,outcome,accepted_revision,result,affected_keys,processed_at)
            values(?::uuid,?::uuid,?::uuid,?::bigint,decode(?,'hex'),?,?::bigint,?::jsonb,?::jsonb,now())
            """,user,operation.path("operationId").asString(),operation.path("deviceId").asString(),operation.path("clientSequence").asString(),
            hash,receipt.path("status").asString(),receipt.has("acceptedRevision")?receipt.path("acceptedRevision").asString():null,receipt.toString(),keys.toString());
    }
    private JsonNode result(JsonNode receipt,boolean replayed,List<Entity> affected) {
        var result=Json.object().put("replayed",replayed);result.set("receipt",receipt);
        // The complete transaction remains in the feed. Large deletion histories use the existing snapshot path.
        var visible=affected.size()>32?affected.stream().filter(e->e.kind().equals("tombstone")).toList():affected;
        if(!receipt.path("status").asString().equals("rejected")) result.set("projections",Json.entities(visible));
        return result;
    }

    private JsonNode state(String user) {
        return db.one("select jsonb_build_object('revision',last_revision::text,'epoch',feed_epoch) from sync_account_state where user_id=?::uuid",user);
    }
    private String pullCursor(String user,String epoch,long after,long high) {
        return cursors.seal(Json.object().put("kind","pull").put("user",user).put("epoch",epoch)
            .put("after",Long.toString(after)).put("high",Long.toString(high)).put("issued",clock.instant().toString()));
    }
    public JsonNode pull(String user,String cursor) {
        if(cursor==null) throw new HttpFailure(409,"resync_required");
        var token=cursors.open(cursor,user,"pull");
        return transactions.run(user,()->{
            lock(user);var state=state(user);
            if(!state.path("epoch").asString().equals(token.path("epoch").asString())||
                Instant.parse(token.path("issued").asString()).isBefore(clock.instant().minusSeconds(90L*86400))) throw new HttpFailure(409,"resync_required");
            long after=Long.parseLong(token.path("after").asString()),high=Long.parseLong(token.path("high").asString());
            if(after==high) high=Long.parseLong(state.path("revision").asString());
            var rows=db.rows("select envelope from sync_changes where user_id=?::uuid and revision>?::bigint and revision<=?::bigint order by revision limit 500",user,Long.toString(after),Long.toString(high));
            if(rows.stream().anyMatch(change->change.path("entities").size()>32)) throw new HttpFailure(409,"resync_required");
            long next=rows.isEmpty()?after:Long.parseLong(rows.getLast().path("revision").asString());
            var response=Json.object().put("nextCursor",pullCursor(user,state.path("epoch").asString(),next,high)).put("hasMore",next<high)
                .put("highWaterRevision",Long.toString(high)).put("serverTime",clock.instant().toString());
            var changes=Json.array();rows.forEach(changes::add);response.set("changes",changes);return response;
        });
    }
    public JsonNode snapshot(String user) {
        return transactions.run(user,()->{
            lock(user);var state=state(user);String id=Json.id(),expires=clock.instant().plusSeconds(900).toString();
            var all=projections(user).stream().sorted(java.util.Comparator.comparing(Entity::key)).toList();
            db.execute("insert into sync_snapshots(user_id,id,high_water_revision,feed_epoch,expires_at,entity_count) values(?::uuid,?::uuid,?::bigint,?::uuid,?::timestamptz,?::int)",
                user,id,state.path("revision").asString(),state.path("epoch").asString(),expires,Integer.toString(all.size()));
            int position=0;
            for(var entity:all) db.execute("insert into sync_snapshot_items(user_id,snapshot_id,position,entity) values(?::uuid,?::uuid,?::int,?::jsonb)",
                user,id,Integer.toString(position++),Json.entities(List.of(entity)).get(0).toString());
            return Json.object().put("snapshotId",id).put("highWaterRevision",state.path("revision").asString())
                .put("expiresAt",expires).put("entityCount",all.size()).put("firstPageCursor",pageCursor(user,id,0));
        });
    }
    private String pageCursor(String user,String id,int position) {
        return cursors.seal(Json.object().put("kind","snapshot").put("user",user).put("snapshot",id).put("position",position));
    }
    private JsonNode snapshotState(String user,String id) {
        var rows=db.rows("select jsonb_build_object('revision',high_water_revision::text,'epoch',feed_epoch,'expired',expires_at<=?::timestamptz,'count',entity_count) from sync_snapshots where user_id=?::uuid and id=?::uuid",clock.instant().toString(),user,id);
        if(rows.isEmpty()) throw new HttpFailure(404,"resource_inaccessible");
        if(rows.getFirst().path("expired").asBoolean()) throw new HttpFailure(410,"snapshot_expired");
        return rows.getFirst();
    }
    public JsonNode snapshotPage(String user,String id,String cursor) {
        var token=cursors.open(cursor,user,"snapshot");
        if(!token.path("snapshot").asString().equals(id)) throw new HttpFailure(404,"resource_inaccessible");
        return transactions.run(user,()->{
            var state=snapshotState(user,id);int position=token.path("position").asInt();
            var rows=db.rows("select entity from sync_snapshot_items where user_id=?::uuid and snapshot_id=?::uuid and position>=?::int order by position limit 500",user,id,Integer.toString(position));
            boolean complete=position+rows.size()==state.path("count").asInt();
            var response=Json.object().put("snapshotId",id).put("highWaterRevision",state.path("revision").asString()).put("complete",complete);
            var entities=Json.array();rows.forEach(entities::add);response.set("entities",entities);
            if(complete) {
                response.putNull("nextPageCursor");
                long high=Long.parseLong(state.path("revision").asString());response.put("pullCursor",pullCursor(user,state.path("epoch").asString(),high,high));
            } else {response.put("nextPageCursor",pageCursor(user,id,position+rows.size()));response.putNull("pullCursor");}
            return response;
        });
    }
    public JsonNode receipts(String user,JsonNode request) {
        return transactions.run(user,()->{
            String snapshot=request.path("snapshotId").asString();var state=snapshotState(user,snapshot);
            var results=Json.array();long high=Long.parseLong(state.path("revision").asString());
            for(var id:request.path("operationIds")) {
                var rows=db.rows("select result from sync_operation_receipts where user_id=?::uuid and operation_id=?::uuid and (outcome='rejected' or accepted_revision<=?::bigint)",user,id.asString(),Long.toString(high));
                results.add(rows.isEmpty()?Json.object().put("operationId",id.asString()).put("status","notProcessedAtH"):rows.getFirst());
            }
            var response=Json.object().put("snapshotId",snapshot).put("highWaterRevision",Long.toString(high));response.set("results",results);return response;
        });
    }
}
