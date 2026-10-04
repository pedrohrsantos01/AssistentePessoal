package dev.ritmo.identity;

import dev.ritmo.shared.Sql;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class AccountInventory {
    private final Sql db;
    public AccountInventory(@Qualifier("retentionInventorySql") Sql db) { this.db=db; }
    public List<String> page(String after,int limit) {
        if(limit<1||limit>1000) throw new IllegalArgumentException("Invalid account page bound");
        // Identity's operational, pre-authentication path: identifiers only, never domain projections.
        return db.rows("""
            select to_jsonb(id) from users where deleted_at is null and (?::uuid is null or id>?::uuid)
            order by id limit ?::int
            """,after,after,Integer.toString(limit)).stream().map(row->row.asString()).toList();
    }
}
