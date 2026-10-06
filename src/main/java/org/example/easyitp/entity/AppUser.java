package org.example.easyitp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "app_users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // Date statie ITP (un manager = o statie)
    private String stationName;
    private String address;
    private String phone;

    // Mesajul de reamintire ITP cu placeholdere ({nume}, {numar}, ...); null = mesajul implicit
    @Column(columnDefinition = "TEXT")
    private String reminderTemplate;

    // Programare online (pagina publica /programare/{bookingSlug}); null = valorile implicite din BookingService
    private Boolean bookingEnabled;

    @Column(unique = true, length = 60)
    private String bookingSlug;

    private LocalTime bookingOpen;
    private LocalTime bookingClose;

    // Zilele lucratoare ca numere ISO separate prin virgula (1 = luni ... 7 = duminica)
    @Column(length = 20)
    private String bookingDays;

    // Recenzii si vizibilitate (C5): link de recenzie Google, harta, Facebook (publice, https)
    @Column(length = 300)
    private String reviewUrl;

    @Column(length = 300)
    private String mapsUrl;

    @Column(length = 300)
    private String facebookUrl;

    // Nota de pe Google (GooglePlacesService): locul ales de statie, stelele, numarul de recenzii, cand a fost citita
    @Column(length = 300)
    private String googlePlaceId;

    private Double googleRating;

    private Integer googleRatingCount;

    private java.time.LocalDateTime googleRatingAt;

    // Facturare prin Oblio (InvoiceService): contul (cheia API nu pleaca spre interfata), firma emitenta, seria,
    // cota de TVA, daca preturile includ TVA, trimiterea automata in e-Factura si termenul de plata
    @Column(length = 200)
    private String oblioEmail;

    @Column(length = 200)
    private String oblioSecret;

    @Column(length = 30)
    private String oblioCif;

    @Column(length = 30)
    private String oblioSeries;

    @Column(length = 60)
    private String oblioVatName;

    private Double oblioVatPercent;

    private Boolean oblioVatIncluded;

    private Boolean oblioEinvoice;

    private Integer oblioDueDays;

    // SMS cu cererea de recenzie a doua zi dupa un ITP admis (pe canalul SMS al statiei); null = nu
    private Boolean reviewSms;

    // Apare in lista publica de statii (/statii); null = da, cand programarea online e pornita
    private Boolean publicListing;

    // Cate masini pot fi programate in acelasi interval (numarul de linii ITP)
    private Integer bookingCapacity;

    // Durata inspectiei per tip de vehicul (vezi InspectionDurations); null = valorile implicite
    @Column(length = 200)
    private String bookingDurations;

    // Email zilnic catre manager; null = activ
    private Boolean digestEnabled;
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DigestChannel digestChannel;

    // WhatsApp prin CallMeBot: numarul managerului si cheia lui personala
    @Column(length = 30)
    private String whatsappPhone;

    @Column(length = 100)
    private String callmebotApiKey;

    // Pachetul de SMS inclus in abonament (SMS pe luna); null / 0 = niciunul. Setat de admin sau cumparat
    private Integer smsPlan;

    // Abonamentul (vezi Plans): pachetul, ultima zi platita (null = fara expirare) si daca e perioada de proba.
    // plan null = cont facut inainte de abonamente: Premium fara expirare
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Plan plan;

    private LocalDate planUntil;

    private Boolean planTrial;

    // Emailul confirmat din linkul primit la inscriere; null = cont facut inainte (considerat confirmat)
    private Boolean emailVerified;

    // Ultimul anunt despre expirarea abonamentului ("<planUntil>:SOON" / "<planUntil>:EXPIRED"), vezi PlanNoticeService
    @Column(length = 40)
    private String planNotice;

    // Datele de facturare ale statiei (pentru plata Netopia si factura abonamentului)
    @Column(length = 200)
    private String billingName;

    @Column(length = 30)
    private String billingCui;

    @Column(length = 200)
    private String billingAddress;

    @Column(length = 80)
    private String billingCity;

    @Column(length = 80)
    private String billingCounty;

    // SMS-uri pentru programari (AppointmentSmsService), pe canalul SMS al statiei; null = oprite
    private Boolean apptConfirmSms;
    private Boolean apptReminderSms;

    // Remindere SMS automate (vezi AutoReminderService); null = oprite
    private Boolean autoSmsEnabled;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private SmsProvider autoSmsProvider;

    // SMS automat si pentru RCA / rovinieta / tahograf, cu 7 zile inainte; null = nu
    private Boolean autoSmsDeadlines;

    // Cu cate zile inainte de expirare se trimite, ex. "30,7"; null = valorile implicite
    @Column(length = 20)
    private String autoSmsDays;

    // Textul SMS-ului cu placeholdere ({numar}, {data}...); null = textul implicit
    @Column(columnDefinition = "TEXT")
    private String autoSmsTemplate;

    // Telefonul statiei ca gateway (aplicatia SMS Gateway for Android, modul cloud); parola nu pleaca spre interfata
    @Column(length = 200)
    private String smsGateUrl;
    @Column(length = 100)
    private String smsGateUsername;
    @Column(length = 200)
    private String smsGatePassword;

    // Gateway SMSLink.ro; parola nu pleaca spre interfata
    @Column(length = 100)
    private String smslinkConnectionId;
    @Column(length = 200)
    private String smslinkPassword;

    // Ziua ultimului email zilnic trimis, ca sa nu trimitem de doua ori
    private LocalDate lastDigestDate;

    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;

    // Inspectorii statiei (doar nume, fara conturi); se aleg in formularul ITP si apar in rapoarte
    @ElementCollection
    @CollectionTable(name = "station_inspectors", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "name", length = 80)
    @OrderColumn(name = "position")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<String> inspectors = new java.util.ArrayList<>();

    // Doar pentru conturile FLEET: firma pe care o administreaza
    @Column(name = "fleet_id")
    private Long fleetId;

    // null pentru conturile vechi = activ
    private Boolean active;

    // Versiunea tokenurilor emise; crescuta la schimbarea parolei sau dezactivare -> tokenurile vechi nu mai merg.
    // null pentru conturile vechi = 0
    private Integer tokenVersion;

    public int currentTokenVersion() {
        return tokenVersion == null ? 0 : tokenVersion;
    }

    public void revokeTokens() {
        tokenVersion = currentTokenVersion() + 1;
    }

    public boolean isEnabled() {
        return !Boolean.FALSE.equals(active);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (active == null) active = true;
    }
}
