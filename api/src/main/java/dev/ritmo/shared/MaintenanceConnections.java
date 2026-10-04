package dev.ritmo.shared;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration(proxyBeanMethods=false)
class MaintenanceConnections {
    private final DataSource domain;
    private final Sql domainSql,inventorySql;
    MaintenanceConnections(@Value("${spring.datasource.url}") String url,
        @Value("${spring.datasource.username}") String user,@Value("${spring.datasource.password}") String password,
        @Value("${ritmo.identity.url}") String identityUrl,@Value("${ritmo.identity.username}") String identityUser,
        @Value("${ritmo.identity.password}") String identityPassword,@Value("${ritmo.sync-retention.io-seconds:5}") int timeout) {
        if(timeout<1||timeout>30) throw new IllegalArgumentException("Invalid retention I/O bound");
        domain=source(url,user,password,timeout);
        domainSql=new Sql(new JdbcTemplate(domain));
        inventorySql=new Sql(new JdbcTemplate(source(identityUrl,identityUser,identityPassword,timeout)));
    }
    private DataSource source(String url,String user,String password,int timeout) {
        if(!url.startsWith("jdbc:postgresql:")) throw new IllegalArgumentException("Retention requires PostgreSQL");
        var parts=url.split("\\?",2);var options=new ArrayList<String>();
        if(parts.length==2) for(String option:parts[1].split("&")) {
            String key=URLDecoder.decode(option.split("=",2)[0],StandardCharsets.UTF_8);
            if(!key.equals("connectTimeout")&&!key.equals("socketTimeout")) options.add(option);
        }
        options.add("connectTimeout="+timeout);options.add("socketTimeout="+timeout);
        return new DriverManagerDataSource(parts[0]+"?"+String.join("&",options),user,password);
    }
    @Bean(name="retentionSql") Sql retentionSql() { return domainSql; }
    @Bean(name="retentionInventorySql") Sql retentionInventorySql() { return inventorySql; }
    @Bean(name="retentionTransactions",defaultCandidate=false) Database.TenantTransactions retentionTransactions() {
        return new Database.TenantTransactions(new TransactionTemplate(new DataSourceTransactionManager(domain)),domainSql);
    }
}
