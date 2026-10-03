package org.example.easyitp.service;

// Mesajul (email sau WhatsApp) nu a putut fi trimis; textul e afisat managerului
public class DeliveryException extends RuntimeException {
    public DeliveryException(String message) {
        super(message);
    }
}
