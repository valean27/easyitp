package org.example.easyitp.security;

import jakarta.servlet.http.HttpServletRequest;

// IP-ul clientului pentru limitele de cereri. Render sta in spatele Cloudflare, care pune IP-ul real in
// CF-Connecting-IP (o singura adresa, suprascrisa de Cloudflare). X-Forwarded-For nu e folosit: Render
// pastreaza ce trimite clientul in el, deci poate fi falsificat.
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        String cf = request.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) return cf.trim();
        return request.getRemoteAddr();
    }
}
