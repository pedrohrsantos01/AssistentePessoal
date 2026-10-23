// Synthetic fixture only. No host trust-store changes; keys stay in ignored output.
import java.nio.file.*;
import java.security.KeyStore;
import java.util.Base64;
import java.util.concurrent.TimeUnit;
class HostingCertificate {
    public static void main(String[] args) throws Exception {
        Path root=Path.of(args[0]);
        Path keytool=Path.of(System.getProperty("java.home"),"bin",System.getProperty("os.name").toLowerCase().contains("windows")?"keytool.exe":"keytool");
        var process=new ProcessBuilder(keytool.toString(),"-genkeypair","-alias","fixture","-keyalg","RSA","-keysize","2048",
            "-dname","CN=ritmo.example.test","-ext","SAN=dns:ritmo.example.test","-ext","bc=ca:true","-validity","2",
            "-storetype","PKCS12","-keystore",root.resolve("fixture.p12").toString(),"-storepass","fixture-password")
            .redirectErrorStream(true).redirectOutput(root.resolve("keytool.log").toFile()).start();
        try {if(!process.waitFor(30,TimeUnit.SECONDS)||process.exitValue()!=0) throw new IllegalStateException("fixture_certificate_failed");}
        finally {if(process.isAlive()) process.destroyForcibly();}
        var store=KeyStore.getInstance("PKCS12");
        try(var input=Files.newInputStream(root.resolve("fixture.p12"))) {store.load(input,"fixture-password".toCharArray());}
        var encoder=Base64.getMimeEncoder(64,new byte[]{10});
        Files.writeString(root.resolve("ritmo.crt"),"-----BEGIN CERTIFICATE-----\n"+encoder.encodeToString(store.getCertificate("fixture").getEncoded())+"\n-----END CERTIFICATE-----\n");
        Files.writeString(root.resolve("ritmo.key"),"-----BEGIN PRIVATE KEY-----\n"+encoder.encodeToString(store.getKey("fixture","fixture-password".toCharArray()).getEncoded())+"\n-----END PRIVATE KEY-----\n");
    }
}
