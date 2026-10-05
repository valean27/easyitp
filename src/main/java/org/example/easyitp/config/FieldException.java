package org.example.easyitp.config;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// 400 pentru un camp anume din formular: interfata il marcheaza cu rosu ({"message", "field"})
public class FieldException extends ResponseStatusException {

    private final String field;

    public FieldException(String field, String message) {
        super(HttpStatus.BAD_REQUEST, message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
