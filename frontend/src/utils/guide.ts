import type { Feature } from './plans';

// Continutul ghidului de utilizare (pagina /ghid). `link` duce direct la pagina sau setarea despre care e vorba.
export interface GuideLink {
  to: string;
  label: string;
}

export interface GuideSection {
  id: string;
  title: string;
  feature?: Feature; // functia e intr-un pachet platit
  intro: string;
  steps?: string[];
  tips?: string[];
  links?: GuideLink[];
}

export interface GuideGroup {
  title: string;
  sections: GuideSection[];
}

// Primii pasi pentru o statie noua; bifele se tin minte pe dispozitiv
export const FIRST_STEPS: { id: string; text: string; link: GuideLink }[] = [
  { id: 'statie', text: 'Completați numele, adresa și telefonul stației', link: { to: '/account#statie', label: 'Date stație' } },
  { id: 'import', text: 'Aduceți clienții existenți din Excel sau din aplicația veche', link: { to: '/', label: 'Import' } },
  { id: 'programare', text: 'Porniți programarea online și alegeți programul', link: { to: '/account#programare', label: 'Programare online' } },
  { id: 'inspectori', text: 'Adăugați inspectorii stației, cu linia pe care lucrează fiecare', link: { to: '/inspectori', label: 'Inspectori' } },
  { id: 'sms', text: 'Alegeți cum pleacă SMS-urile și porniți reminderele automate', link: { to: '/account#sms', label: 'SMS automate' } },
  { id: 'rezumat', text: 'Primiți rezumatul de dimineață pe email sau WhatsApp', link: { to: '/account#rezumat', label: 'Rezumat zilnic' } },
  { id: 'afis', text: 'Tipăriți afișul cu QR și, dacă vreți, puneți linkul de programare pe Google Maps sau Facebook', link: { to: '/afis', label: 'Afiș cu QR' } },
];

export const GUIDE: GuideGroup[] = [
  {
    title: 'Munca de zi cu zi',
    sections: [
      {
        id: 'itp',
        title: 'Adăugarea unui ITP',
        intro: 'Fiecare inspecție se trece în prima pagină, cu „Adaugă ITP”. Aplicația calculează singură când expiră și când trebuie anunțat clientul.',
        steps: [
          'Apăsați „Adaugă ITP” și începeți cu numărul de înmatriculare: pentru un client care revine, numele, telefonul și mașina se completează singure din ultimul ITP.',
          'Completați data inspecției, valabilitatea (6, 12 sau 24 de luni), rezultatul, prețul și inspectorul.',
          'Bifați acordul clientului pentru mesaje (reminderele automate pleacă doar la cei cu acord).',
          'Opțional, la „Alte scadențe”, treceți data RCA-ului, a rovinietei sau a verificării tahografului.',
          'Salvați. Dacă un câmp e greșit (de exemplu VIN-ul), îl vedeți marcat cu roșu și mesajul sub el.',
        ],
        tips: [
          'Același număr scris cu sau fără spații („CJ 12 ABC” / „CJ12ABC”) e aceeași mașină.',
          'Un client cu mai multe mașini rămâne un singur client, recunoscut după nume și telefon.',
          'Din rândul ITP-ului puteți deschide „Fișa ITP”, de tipărit sau trimis clientului.',
        ],
        links: [{ to: '/', label: 'Prima pagină' }],
      },
      {
        id: 'scanare',
        title: 'Scanarea talonului',
        feature: 'SCAN',
        intro: 'De pe telefon, în formularul ITP, „Scanează talonul” citește din poză numărul, VIN-ul, marca, modelul, anul și proprietarul.',
        steps: [
          'Deschideți „Adaugă ITP” pe telefon și apăsați „Scanează talonul”.',
          'Fotografiați talonul întreg, drept, cu lumină bună.',
          'Verificați câmpurile completate și salvați.',
        ],
        tips: ['Poza nu se păstrează. Scanați doar talonul, niciodată buletinul.'],
      },
      {
        id: 'contactat',
        title: 'Lista „De contactat”',
        intro: 'Aici vedeți cine are ITP-ul pe cale să expire (sau expirat) și îl puteți anunța dintr-o atingere.',
        steps: [
          'Filtrați după urgență: ≤ 7, 14, 30 de zile sau expirate.',
          'Apăsați WhatsApp, SMS sau Sună: mesajul e deja scris, cu numărul mașinii, data și linkul de programare.',
          'Marcați clientul ca „Contactat”, „Programat” sau „Neinteresat”, ca să nu-l sunați de două ori.',
          'Vederea „RCA, rovinietă, tahograf” arată celelalte scadențe ale mașinilor.',
        ],
        tips: ['Textul mesajului manual se schimbă în Contul meu → Date stație.'],
        links: [{ to: '/reminders', label: 'De contactat' }, { to: '/account#statie', label: 'Textul mesajului' }],
      },
      {
        id: 'notificari',
        title: 'Notificări (clopoțelul)',
        intro: 'Ce s-a întâmplat cât nu ați fost cu ochii pe aplicație, cu numărul de necitite pe clopoțel.',
        steps: [
          'Clopoțelul e lângă logo-ul din meniu (pe telefon, în bara de sus). Cifra roșie arată câte notificări nu ați citit.',
          'Apar: programările noi făcute online, programările anulate sau mutate de clienți din link, ITP-urile făcute de inspectori din contul lor și clienții marcați „Nu a venit” de inspectori.',
          'Un click pe notificare deschide calendarul pe ziua programării; „Toate citite” le marchează pe toate.',
        ],
        tips: ['Notificările se păstrează 90 de zile.'],
        links: [{ to: '/calendar', label: 'Calendar' }],
      },
      {
        id: 'calendar',
        title: 'Calendarul și programările',
        intro: 'Programările făcute la telefon sau la ghișeu, plus cele venite online, într-un singur calendar.',
        steps: [
          'Apăsați pe o zi și o oră libere ca să adăugați o programare.',
          'Mutați o programare prin drag & drop: o apucați cu mouse-ul și o trageți la altă oră sau în altă zi; durata rămâne aceeași. Pe telefon, apăsați pe ea și schimbați ora în fereastră.',
          'Stația are mai multe linii? Apăsați „Pe linii”: ziua apare cu câte o coloană pentru fiecare linie, cu numărul de programări și cât e de ocupată. Trageți o programare în altă coloană ca s-o mutați pe altă linie.',
          'O programare nouă merge automat pe prima linie liberă; în fereastra programării puteți alege linia și vedeți care sunt libere la ora aleasă.',
          'Programările online apar singure, marcate; dacă un client și-a mutat sau anulat programarea din link, vedeți asta pe programare.',
          'La sosirea clientului, din programare apăsați „Începe ITP”: datele clientului se completează în formular.',
          'Dacă clientul nu a venit, marcați „Neprezentat”; rata de neprezentare apare în Rapoarte.',
        ],
        tips: [
          'Numele liniilor (ex. „Autoturisme”, „Camioane” sau numele inspectorului) le dați în Contul meu → Programare online.',
          'Programările finalizate sau anulate nu se mai pot trage; le schimbați din fereastra lor.',
        ],
        links: [{ to: '/calendar', label: 'Calendar' }, { to: '/account#programare', label: 'Liniile stației' }],
      },
      {
        id: 'clienti',
        title: 'Clienți, mașini și dubluri',
        intro: 'Fișa fiecărui client cu toate mașinile lui și istoricul ITP al fiecăreia.',
        steps: [
          'Căutați după nume, telefon sau număr.',
          'În fișă puteți edita clientul sau mașina, muta o mașină la alt proprietar și vedea acordul pentru mesaje.',
          '„Posibile dubluri” arată clienții cu același telefon sau nume; îi uniți dintr-un clic.',
          '„Cere o recenzie” trimite pe WhatsApp linkul de recenzie Google al stației.',
        ],
        links: [{ to: '/clients', label: 'Clienți' }],
      },
      {
        id: 'istoric',
        title: 'Istoric și „Anulează”',
        intro: 'Orice adăugare, modificare sau ștergere de ITP, client sau mașină rămâne în istoric.',
        steps: [
          'După o ștergere apare jos bara „Anulează” timp de 10 secunde.',
          'Ați ratat-o? În Istoric găsiți ștergerea și o restaurați în cel mult 30 de zile.',
        ],
        links: [{ to: '/history', label: 'Istoric' }],
      },
    ],
  },
  {
    title: 'Clienții care revin',
    sections: [
      {
        id: 'programare-online',
        title: 'Programarea online',
        intro: 'Stația primește o pagină publică de programare. Clientul vede doar orele libere, după durata inspecției și numărul de linii.',
        steps: [
          'În Contul meu → Programare online, porniți programarea și alegeți adresa paginii (ex. /programare/itp-exemplu).',
          'Setați programul, zilele lucrătoare, câte mașini pot fi inspectate deodată (liniile, cu nume dacă vreți) și durata pe tip de vehicul. Cu mai multe linii, clienții se pot programa la aceeași oră cât timp una e liberă; fiecare programare primește linia ei.',
          'Puneți logo-ul stației în Contul meu → Date stație ITP: apare pe pagina de programare, în emailurile către clienți, în lista de stații, pe afișul cu QR și pe fișa ITP. Tot în Programare online puteți scrie un mesaj scurt care apare sus pe pagină (ex. „Veniți cu 10 minute înainte”).',
          'Copiați linkul și dați-l clienților. Opțional îl puneți pe Google Maps (Google Business Profile → Programări), pe Facebook sau în semnătura mesajelor; programarea online merge și fără ele.',
          'Stația apare și în lista publică /statii, unde șoferii caută după oraș; o puteți scoate de acolo din aceeași setare.',
        ],
        tips: [
          'Linkul de programare intră automat în mesajele de reamintire.',
          'Clientul își poate lăsa și emailul (opțional): primește confirmarea cu butoane „Google Calendar” și „Calendar telefon (.ics)”, iar dacă își mută sau anulează programarea, un email nou. Butoanele de calendar le are și pe ecranul de confirmare și în linkul de anulare / mutare.',
          'Dumneavoastră primiți email la fiecare programare online (și când un client o anulează sau o mută); îl opriți din Contul meu → Programare online. Telefonul trebuie să fie un mobil valid; din altă țară, cu prefixul țării.',
        ],
        links: [{ to: '/account#programare', label: 'Programare online' }, { to: '/afis', label: 'Afiș cu QR' }],
      },
      {
        id: 'sms-automate',
        title: 'SMS-uri automate',
        feature: 'AUTO_SMS',
        intro: 'Aplicația trimite singură, dimineața, SMS-uri clienților cu acord: înainte să le expire ITP-ul, la programări și pentru RCA / rovinietă / tahograf.',
        steps: [
          'Alegeți cum pleacă SMS-urile: de pe telefonul Android al stației (aplicația gratuită „SMS Gateway for Android”, secțiunea Cloud Server: utilizator și parolă), cu cont propriu SMSLink sau din pachetul de SMS inclus în abonament.',
          'Trimiteți un „SMS de test” pe telefonul dumneavoastră.',
          'Alegeți termenele (de exemplu cu 30 și cu 7 zile înainte) și, dacă vreți, schimbați textul; previzualizarea arată câte SMS-uri face.',
          'Porniți reminderele și, opțional, confirmarea programărilor online, reminderul cu o zi înainte și SMS-ul pentru alte scadențe.',
        ],
        tips: [
          'Telefonul cu SMS Gateway trebuie să rămână pornit și conectat la internet.',
          'Fiecare SMS are linkul de dezabonare; cine îl apasă nu mai primește nimic.',
          'Nu se trimite la clienții „Neinteresați” sau care au deja programare.',
          'Jurnalul din același card arată ce a plecat și ce nu.',
        ],
        links: [{ to: '/account#sms', label: 'SMS automate' }],
      },
      {
        id: 'acord',
        title: 'Acordul clientului (GDPR)',
        intro: 'Reminderele automate pleacă doar clienților care și-au dat acordul.',
        steps: [
          'Bifați acordul în formularul ITP când clientul e de acord (pentru clienții care revin, bifa e deja pusă).',
          'La programarea online, clientul își dă singur acordul.',
          'În fișa clientului vedeți când și de unde a venit acordul și îl puteți schimba.',
        ],
        tips: ['Mesajele de reamintire sunt de serviciu: nu puneți promoții în ele.'],
      },
      {
        id: 'recenzii',
        title: 'Recenzii și vizibilitate',
        feature: 'REVIEWS',
        intro: 'Mai multe recenzii pe Google aduc mai mulți clienți noi.',
        steps: [
          'În Contul meu → Recenzii și vizibilitate puneți linkul de recenzie Google, Google Maps și Facebook (apar pe pagina de programare).',
          'Alegeți locul stației de pe Google, ca nota să apară în lista publică de stații.',
          'Porniți SMS-ul cu cererea de recenzie: pleacă în dimineața de după un ITP admis, cel mult o dată pe an pentru același client.',
        ],
        links: [{ to: '/account#recenzii', label: 'Recenzii și vizibilitate' }],
      },
      {
        id: 'afis',
        title: 'Afișul cu QR și fișa ITP',
        intro: 'Afișul A4 se pune la ghișeu: clienții scanează QR-ul și se programează data viitoare singuri.',
        steps: ['Deschideți Afișul, verificați datele și tipăriți-l (sau salvați-l ca PDF).', 'Fișa ITP se deschide din rândul fiecărui ITP și se dă clientului.'],
        links: [{ to: '/afis', label: 'Afiș cu QR' }],
      },
    ],
  },
  {
    title: 'Pentru patron',
    sections: [
      {
        id: 'inspectori',
        title: 'Inspectorii și dashboard-ul echipei',
        intro: 'Echipa stației într-o pagină: cine sunt, pe ce linie lucrează și, în Pro, cât a lucrat fiecare.',
        steps: [
          'În meniu → Inspectori apăsați „+ Inspector”: nume, telefon, culoare, linia pe care lucrează de obicei și data atestatului.',
          'În fereastra inspectorului setați programul săptămânal: zilele în care lucrează, orele și, dacă vreți, altă linie într-o anumită zi. În zilele libere nu mai e trecut pe nicio linie.',
          'Concediile, zilele de medical sau zilele libere le marcați pe zile, nu săptămânal: în „Concedii și zile libere” alegeți tipul și apăsați zilele din lună (Shift + click pentru o perioadă), sau adăugați perioada din fereastra inspectorului. În zilele acelea nu mai e pus pe linia lui, iar el vede absența în contul lui.',
          'Programările de pe o linie îi revin inspectorului liniei. O zi anume (înlocuire) o schimbați în „Cine e pe linii” sau direct în Calendar → „Pe linii”, din capul coloanei.',
          'Tot acolo îi faceți cont în aplicație: se loghează cu prenume.nume@stație și o parolă provizorie, pe care o schimbă la prima logare. Pe telefon își vede ziua (linia, orele, programările lui, cu telefonul clientului), pornește „Începe ITP” din programare (formularul vine precompletat, ITP-ul se salvează pe stație cu numele lui, iar programarea devine „Finalizat”) sau marchează „Nu a venit”. „Finalizat” nu se poate pune fără ITP.',
          'Pe o programare puteți alege alt inspector decât cel al liniei; în vederea pe linii apare cu inițialele lui.',
          'La „Începe ITP” dintr-o programare, inspectorul ei se completează singur în formular.',
          'Dashboard-ul (Pro) arată, pe perioada aleasă, ITP-urile, încasările, respingerile, zilele lucrate, programările și neprezentările fiecăruia, plus graficul pe zile și cine e azi pe ce linie.',
        ],
        tips: [
          'Un inspector care a plecat îl marcați inactiv: nu mai apare la alegere, contul lui nu se mai poate loga, iar ITP-urile lui rămân în rapoarte.',
          'Inspectorul și-a uitat parola? Din fereastra lui îi dați una provizorie nouă; „Am uitat parola” e doar pentru conturile cu email.',
          'Dacă îi schimbați numele, se schimbă și pe ITP-urile făcute de el.',
          'Atestatul intră în termenele stației (Pro): primiți alertă pe dashboard și în rezumatul de dimineață înainte să expire.',
        ],
        links: [{ to: '/inspectori', label: 'Inspectori' }, { to: '/calendar', label: 'Calendar' }],
      },
      {
        id: 'rapoarte',
        title: 'Rapoarte',
        feature: 'OWNER_REPORTS',
        intro: 'Încasările și ITP-urile pe luni, rata de respingere și, în Pro, ce face fiecare inspector și ce clienți nu s-au mai întors.',
        steps: [
          'Alegeți anul. Graficele arată încasările și numărul de ITP-uri pe luni.',
          '„Clasament inspectori” arată câte ITP-uri și ce rată de respingere are fiecare.',
          '„Clienți care au revenit” arată câți dintre clienții de anul trecut au revenit; lista celor pierduți e de sunat.',
          'Exportul pentru contabilitate scoate ITP-urile unei luni sau ale anului în Excel.',
        ],
        links: [{ to: '/reports', label: 'Rapoarte' }],
      },
      {
        id: 'termene',
        title: 'Termenele stației',
        feature: 'STATION_DEADLINES',
        intro: 'Autorizația RAR, verificările metrologice și atestatele inspectorilor, cu alertă înainte să expire.',
        steps: ['Adăugați fiecare termen cu data de expirare.', 'Cu câteva săptămâni înainte apare o alertă în prima pagină și în rezumatul de dimineață.'],
        links: [{ to: '/account#termene', label: 'Termenele stației' }],
      },
      {
        id: 'rezumat',
        title: 'Rezumatul de dimineață',
        intro: 'În fiecare dimineață: programările zilei, programările noi venite online și cine trebuie sunat.',
        steps: ['Alegeți emailul sau WhatsApp-ul (prin CallMeBot, cu cheia personală) și trimiteți un rezumat de test.'],
        links: [{ to: '/account#rezumat', label: 'Rezumat zilnic' }],
      },
      {
        id: 'flote',
        title: 'Flote (firme cu mai multe mașini)',
        feature: 'FLEETS',
        intro: 'O firmă primește propriul cont, în care își vede mașinile, scadențele și centralizatorul lunar.',
        steps: [
          'În Flote adăugați firma (nume, CUI, adresă) și numerele mașinilor.',
          'Creați contul firmei (email + parolă) și trimiteți-i datele de intrare.',
          'La final de lună, centralizatorul arată ITP-urile firmei; îl descărcați în Excel, îl tipăriți sau emiteți factura.',
        ],
        links: [{ to: '/fleets', label: 'Flote' }],
      },
      {
        id: 'facturare',
        title: 'Facturare prin Oblio',
        feature: 'INVOICING',
        intro: 'Facturi reale, din contul Oblio al stației, pentru centralizatorul unei flote sau pentru un ITP, cu trimitere în e-Factura.',
        steps: [
          'În Contul meu → Facturare puneți emailul contului Oblio și cheia API (din Oblio: Setări → Date cont).',
          'Alegeți firma emitentă, seria și cota de TVA; bifați trimiterea automată în SPV dacă vreți.',
          'Emiteți factura din centralizatorul flotei sau din detaliile unui ITP.',
        ],
        links: [{ to: '/account#facturare', label: 'Facturare' }],
      },
      {
        id: 'import',
        title: 'Import și export',
        intro: 'Aduceți clienții din Excel sau din aplicația folosită până acum; scoateți oricând datele.',
        steps: [
          'În prima pagină apăsați „Import CSV” și alegeți fișierul (.xlsx sau .csv).',
          'Verificați potrivirea coloanelor (nume, telefon, număr, data ITP-ului, expirarea) și previzualizarea, apoi importați.',
          'Clienții deja existenți nu se dublează; importul apare în Istoric.',
          '„Export CSV” scoate toate ITP-urile într-un fișier Excel.',
        ],
        links: [{ to: '/', label: 'Prima pagină' }],
      },
      {
        id: 'abonament',
        title: 'Abonamentul',
        intro: 'Pachetul Gratuit rămâne mereu; Pro și Premium se plătesc din aplicație, pentru 1 sau 12 luni, fără reînnoire automată.',
        steps: [
          'În Contul meu → Abonament alegeți perioada (lunar sau anual, cu 2 luni gratuite), pachetul și, opțional, SMS-urile incluse; jos vedeți totalul cu TVA și data până la care e plătit.',
          'Completați datele de facturare și plătiți cu cardul; pachetul se activează imediat, iar factura apare în aceeași secțiune.',
        ],
        tips: [
          'Dacă plătiți în perioada de probă, nu pierdeți zilele rămase: perioada plătită începe după ultima zi de probă.',
          'Cu 3 zile înainte de expirare (și când expiră) primiți un email; confirmați adresa de email din emailul de bun venit ca să-l primiți.',
          'Parola uitată se resetează din pagina de autentificare, cu „Ați uitat parola?”.',
        ],
        links: [{ to: '/account#abonament', label: 'Abonament' }],
      },
    ],
  },
];

// Cautarea in ghid: fara diacritice si fara majuscule
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matches(section: GuideSection, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  const text = [section.title, section.intro, ...(section.steps ?? []), ...(section.tips ?? [])].join(' ');
  return normalize(text).includes(q);
}
