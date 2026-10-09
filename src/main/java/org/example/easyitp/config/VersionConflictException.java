package org.example.easyitp.config;

// Modificarea s-a facut pe o versiune veche (de exemplu offline, iar intre timp clientul a anulat): 409 cu varianta
// de acum, ca aplicatia sa o arate langa cea a utilizatorului si el sa aleaga
public class VersionConflictException extends RuntimeException {

    private final transient Object current;

    public VersionConflictException(String message, Object current) {
        super(message);
        this.current = current;
    }

    public Object getCurrent() {
        return current;
    }
}
