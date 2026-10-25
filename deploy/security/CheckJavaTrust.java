import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Properties;
import java.util.HashSet;
import java.util.Set;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

/** Offline checks of published compromised chains, plus a normal HTTPS control. */
public class CheckJavaTrust {
    public static void main(String[] args) throws Exception {
        if (args[0].equals("--https-control")) {
            var connection = (HttpsURLConnection) new java.net.URI("https://repo.maven.apache.org/maven2/").toURL().openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            if (connection.getResponseCode() != 200) throw new IllegalStateException("HTTPS control failed");
            connection.disconnect();
            System.out.println("PASS normal public HTTPS still validates");
            return;
        }
        boolean baseline = args.length > 2 && args[2].equals("--baseline");
        Set<String> previouslyAccepted = baseline ? Set.of() : new HashSet<>(Files.readAllLines(Path.of(args[2])));
        if (!baseline) {
            var blocked = new Properties();
            try (var input = Files.newInputStream(Path.of(System.getProperty("java.home"), "lib/security/blocked.certs"))) {
                blocked.load(input);
            }
            int count = 0;
            for (String fingerprint : Files.readAllLines(Path.of(args[1]))) {
                if (fingerprint.isBlank() || fingerprint.startsWith("#")) continue;
                if (!blocked.containsKey(fingerprint)) throw new IllegalStateException("Missing compromised certificate block");
                count++;
            }
            if (count != 16) throw new IllegalStateException("Expected 16 explicit certificate blocks");
        }
        var factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        if (args.length > 3) {
            // Explicit fixture anchors exist only in this offline verification JVM.
            KeyStore fixtures = KeyStore.getInstance(KeyStore.getDefaultType());
            fixtures.load(null, null);
            try (var roots = Files.list(Path.of(args[3]))) {
                for (Path root : roots.sorted().toList()) {
                    try (var input = Files.newInputStream(root)) {
                        fixtures.setCertificateEntry(root.getFileName().toString(), CertificateFactory.getInstance("X.509").generateCertificate(input));
                    }
                }
            }
            factory.init(fixtures);
        } else {
            factory.init((KeyStore) null);
        }
        X509TrustManager manager = null;
        for (var candidate : factory.getTrustManagers()) {
            if (candidate instanceof X509TrustManager x509) manager = x509;
        }
        if (manager == null) throw new IllegalStateException("No X509 trust manager");
        int checked = 0;
        int accepted = 0;
        try (var paths = Files.list(Path.of(args[0]))) {
            for (Path path : paths.filter(p -> p.toString().endsWith(".pem")).sorted().toList()) {
                X509Certificate[] chain;
                try (var input = Files.newInputStream(path)) {
                    chain = CertificateFactory.getInstance("X.509").generateCertificates(input).toArray(X509Certificate[]::new);
                }
                // Expired fixtures must fail the verification itself, not masquerade as protection.
                for (var certificate : chain) certificate.checkValidity();
                String authentication = switch (chain[0].getPublicKey().getAlgorithm()) {
                    case "EC" -> "ECDHE_ECDSA";
                    case "RSA" -> "RSA";
                    default -> throw new IllegalStateException("Unsupported fixture key algorithm");
                };
                try {
                    manager.checkServerTrusted(chain, authentication);
                    accepted++;
                    System.out.println("ACCEPTED " + path.getFileName());
                } catch (CertificateException expected) {
                    if (expected.getMessage().contains("Unknown authType")) throw expected;
                    boolean blockedCause = false;
                    for (Throwable cause = expected; cause != null; cause = cause.getCause()) {
                        if (cause.getMessage() != null && cause.getMessage().contains("Untrusted certificate")) blockedCause = true;
                    }
                    if (previouslyAccepted.contains(path.getFileName().toString()) && !blockedCause) {
                        throw new IllegalStateException("Expected blocklist rejection for untreated accepted chain", expected);
                    }
                    System.out.println("REJECTED " + path.getFileName() + " blocklist=" + blockedCause);
                }
                checked++;
            }
        }
        if (checked != 14) throw new IllegalStateException("Expected all 14 published chains");
        System.out.printf("Java trust chains: checked=%d accepted=%d rejected=%d%n", checked, accepted, checked - accepted);
        if (!baseline && accepted != 0) throw new IllegalStateException("Compromised certificate chains are still trusted");
    }
}
