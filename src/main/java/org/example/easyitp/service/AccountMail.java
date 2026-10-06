package org.example.easyitp.service;

import org.springframework.web.util.HtmlUtils;

// Sablonul emailurilor despre cont (bun venit, resetarea parolei, abonament): titlu, paragrafe, un buton, o nota
final class AccountMail {

    private AccountMail() {
    }

    static String html(String title, String[] paragraphs, String buttonText, String buttonUrl, String note) {
        StringBuilder b = new StringBuilder();
        b.append("<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b\">")
                .append("<p style=\"font-size:18px;font-weight:bold;color:#2563eb;margin:0 0 16px\">Easy ITP</p>")
                .append("<h2 style=\"font-size:20px;margin:0 0 12px\">").append(HtmlUtils.htmlEscape(title)).append("</h2>");
        for (String p : paragraphs) {
            b.append("<p style=\"font-size:15px;line-height:1.5;margin:0 0 12px\">").append(HtmlUtils.htmlEscape(p)).append("</p>");
        }
        if (buttonUrl != null) {
            b.append("<p style=\"margin:20px 0\"><a href=\"").append(HtmlUtils.htmlEscape(buttonUrl))
                    .append("\" style=\"background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;")
                    .append("font-weight:bold;display:inline-block\">").append(HtmlUtils.htmlEscape(buttonText)).append("</a></p>")
                    .append("<p style=\"font-size:12px;color:#64748b;margin:0 0 12px\">Dacă butonul nu merge, copiați linkul: ")
                    .append(HtmlUtils.htmlEscape(buttonUrl)).append("</p>");
        }
        if (note != null) {
            b.append("<p style=\"font-size:13px;color:#64748b;margin:16px 0 0\">").append(HtmlUtils.htmlEscape(note)).append("</p>");
        }
        b.append("<p style=\"font-size:12px;color:#94a3b8;margin:24px 0 0\">Easy ITP · VLN SOLUTIONS SRL · easyitp.ro</p></div>");
        return b.toString();
    }

    static String stripSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
