package dev.ritmo.shared;
import java.util.List;
import tools.jackson.databind.JsonNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
public final class Sql {
    private final JdbcTemplate jdbc;
    public Sql(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    private PreparedStatementSetter bindings(String[] args) {
        return statement->{for(int index=0;index<args.length;index++) statement.setString(index+1,args[index]);};
    }
    public void execute(String statement,String... args) { jdbc.update(statement,bindings(args)); }
    public List<JsonNode> rows(String statement,String... args) {
        return jdbc.query(statement,bindings(args),(rs,n)->Json.read(rs.getString(1)));
    }
    public JsonNode one(String statement,String... args) {
        var values=rows(statement,args);
        if(values.size()!=1) throw new BusinessFailure("resource_inaccessible");
        return values.getFirst();
    }
}
