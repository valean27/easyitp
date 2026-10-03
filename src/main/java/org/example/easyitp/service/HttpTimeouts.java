package org.example.easyitp.service;

import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.net.ConnectException;
import java.net.UnknownHostException;
import java.time.Duration;

// Apelurile catre servicii externe au timeout: un serviciu blocat nu mai tine pe loc rezumatul zilnic
final class HttpTimeouts {

    private HttpTimeouts() {
    }

    static SimpleClientHttpRequestFactory factory(Duration connect, Duration read) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connect);
        factory.setReadTimeout(read);
        return factory;
    }

    // Cererea nu a plecat deloc (conexiune refuzata, DNS), deci poate fi reincercata fara risc de dublura
    static boolean notConnected(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof ConnectException || t instanceof UnknownHostException) return true;
        }
        return false;
    }
}
