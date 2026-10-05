package org.example.easyitp.entity;

// Canalul remindere-lor SMS automate ale statiei
public enum SmsProvider {
    // Telefonul statiei, prin aplicatia "SMS Gateway for Android" (sms-gate.app), modul cloud
    SMS_GATE,
    // Gateway-ul SMSLink.ro, cu contul statiei (platit de statie)
    SMSLINK,
    // Inclus in abonament: contul SMSLink al platformei, in limita pachetului lunar al statiei (AppUser.smsPlan)
    PLATFORM
}
