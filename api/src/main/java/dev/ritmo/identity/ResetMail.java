package dev.ritmo.identity;
import java.net.URI;
import jakarta.mail.internet.InternetAddress;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
class ResetMail {
    private final ObjectProvider<JavaMailSender> sender;
    private final String origin;
    private final String from;
    private final boolean configured;
    ResetMail(ObjectProvider<JavaMailSender> sender,@Value("${ritmo.recovery.origin:}") String origin,
        @Value("${ritmo.recovery.from:}") String from,@Value("${spring.mail.host:}") String host) {
        this.sender=sender;this.origin=origin;this.from=from;
        if(!origin.isBlank()) {
            URI uri=URI.create(origin);
            if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||
                uri.getQuery()!=null||uri.getFragment()!=null||!uri.getPath().isEmpty())
                throw new IllegalArgumentException("recovery_origin_must_be_https_origin");
        }
        if(!from.isBlank()) {
            try {new InternetAddress(from,true).validate();}
            catch(jakarta.mail.internet.AddressException e) {throw new IllegalArgumentException("invalid_recovery_sender");}
            if(from.indexOf('\r')>=0||from.indexOf('\n')>=0) throw new IllegalArgumentException("invalid_recovery_sender");
        }
        configured=!host.isBlank()&&!origin.isBlank()&&!from.isBlank();
    }
    boolean available() {return configured&&sender.getIfAvailable()!=null;}
    void send(String email,String token) {
        var message=new SimpleMailMessage();
        message.setFrom(from);message.setTo(email);
        message.setSubject("Recuperação de senha do Ritmo");
        message.setText("Recebemos uma solicitação para trocar sua senha.\n\n"+
            "Abra este link no app Ritmo em até uma hora:\n"+
            origin+"/password-reset#token="+token+"\n\n"+
            "Se você não fez a solicitação, ignore este e-mail. Sua senha continua a mesma.\n");
        sender.getObject().send(message);
    }
}
