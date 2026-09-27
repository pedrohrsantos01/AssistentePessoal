package dev.ritmo.shared;
import javax.sql.DataSource;
import java.util.function.Supplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class Database {
    private final DataSource identitySource;
    public Database(@Value("${ritmo.identity.url}") String url,@Value("${ritmo.identity.username}") String user,
        @Value("${ritmo.identity.password}") String password) { identitySource=new DriverManagerDataSource(url,user,password); }
    @Bean Sql domainSql(DataSource dataSource) { return new Sql(new JdbcTemplate(dataSource)); }
    @Bean(name="identitySql") Sql identitySql() { return new Sql(new JdbcTemplate(identitySource)); }
    @Bean(name="identityTransactions") TransactionTemplate identityTransactions() {
        return new TransactionTemplate(new DataSourceTransactionManager(identitySource));
    }
    @Bean TenantTransactions tenantTransactions(PlatformTransactionManager manager,@Qualifier("domainSql") Sql sql) {
        return new TenantTransactions(new TransactionTemplate(manager),sql);
    }
    public static final class TenantTransactions {
        private final TransactionTemplate transactions;
        private final Sql sql;
        TenantTransactions(TransactionTemplate transactions,Sql sql) {this.transactions=transactions;this.sql=sql;}
        public <T> T run(String userId,Supplier<T> work) {
            return transactions.execute(status->{
                sql.rows("select to_jsonb(set_config('app.user_id',?,true))",userId);
                return work.get();
            });
        }
    }
}
