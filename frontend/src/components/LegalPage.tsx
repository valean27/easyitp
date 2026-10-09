import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './landing/PublicChrome';
import { ANPC_SAL_URL, COMPANY } from '../utils/company';
import { PLANS, PLAN_LABELS, VAT_PERCENT } from '../utils/plans';
import { SMS_PLANS } from '../utils/smsPlans';
import { usePageTitle } from '../utils/pageTitle';

const LINKS = [
  { href: '/', label: 'Pentru stații ITP' },
  { href: '/statii', label: 'Stații ITP' },
];

const UPDATED = '8 octombrie 2026';

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-2">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-2 text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

function Contact() {
  return (
    <>
      {COMPANY.name}
      {COMPANY.regCom ? `, Nr. Reg. Com. ${COMPANY.regCom}` : ''}, CUI {COMPANY.cui}, cu sediul în {COMPANY.address}, telefon{' '}
      <a href={COMPANY.phoneHref} className="text-blue-600 hover:underline">{COMPANY.phone}</a>, email{' '}
      <a href={`mailto:${COMPANY.email}`} className="text-blue-600 hover:underline">{COMPANY.email}</a>, sau prin formularul de pe <Link to="/#demo" className="text-blue-600 hover:underline">pagina principală</Link>
    </>
  );
}

function Privacy() {
  return (
    <>
      <Section title="Cine suntem">
        <p>
          Easy ITP este o aplicație pentru stații ITP, oferită de <Contact />.
        </p>
      </Section>

      <Section title="Două roluri diferite">
        <p>
          <b>Pentru datele din formularele noastre</b> (cererea de demonstrație) și pentru conturile stațiilor, {COMPANY.name} este
          operator de date.
        </p>
        <p>
          <b>Pentru datele clienților unei stații</b> (ITP-uri, programări, remindere), operatorul este stația ITP, iar {COMPANY.name}{' '}
          le prelucrează doar în numele și după instrucțiunile stației, ca persoană împuternicită. Pentru întrebări despre aceste date
          vă puteți adresa direct stației sau nouă, iar noi transmitem cererea stației.
        </p>
      </Section>

      <Section title="Ce date prelucrăm și de ce">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <b>Cererea de demonstrație:</b> nume, stație, oraș, telefon, email, mesaj, ca să vă contactăm (demersuri înainte de un contract
            și interesul nostru legitim de a răspunde).
          </li>
          <li>
            <b>Contul stației și abonamentul:</b> numele stației, orașul, telefonul, emailul și parola (păstrată criptat), iar pentru
            plată datele de facturare ale firmei (denumire, CUI, adresă), ca să furnizăm serviciul și să emitem factura (executarea
            contractului și obligația legală de facturare). Datele cardului le introduceți direct pe pagina NETOPIA Payments; noi nu
            le vedem și nu le păstrăm.
          </li>
          <li>
            <b>Cererea de retragere din contract:</b> nume, email, contractul și mesajul, ca să o soluționăm și să vă trimitem
            confirmarea (obligație legală).
          </li>
          <li>
            <b>Programarea online la o stație:</b> nume, telefon, număr de înmatriculare, tipul vehiculului, data și ora și, dacă îl
            completați, emailul, ca stația să vă poată primi; dacă stația le folosește, primiți un SMS de confirmare și unul cu o zi
            înainte, cu un link din care vă puteți anula sau muta programarea. Dacă ați lăsat emailul, primiți confirmarea și
            schimbările și pe email (prin Resend), cu link pentru calendar; emailul nu e folosit pentru reclame.
          </li>
          <li>
            <b>Reminderele (SMS / WhatsApp):</b> nume, telefon, numărul mașinii și data expirării ITP-ului și, dacă stația le
            completează, a RCA-ului, rovinietei sau a verificării tahografului; după un ITP, stația vă poate cere o recenzie. Mesajele
            automate se trimit doar
            dacă v-ați dat acordul, iar acordul se poate retrage oricând din linkul de dezabonare din fiecare mesaj.
          </li>
          <li>
            <b>Evidența ITP a stației:</b> datele clientului și ale vehiculului introduse de stație, pentru evidența inspecțiilor și
            programări.
          </li>
          <li>
            <b>Scanarea talonului:</b> poza este trimisă unui serviciu de recunoaștere a textului doar ca să completeze formularul și nu
            se păstrează. Nu scanăm cărți de identitate.
          </li>
          <li>
            <b>Siguranța aplicației:</b> date tehnice (de exemplu adresa IP) pentru limitarea abuzurilor și jurnale de erori.
          </li>
        </ul>
      </Section>

      <Section title="Cui transmitem datele">
        <p>Folosim furnizori care ne ajută să rulăm serviciul, fiecare doar pentru partea lui:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>găzduirea aplicației și a bazei de date (Vercel, Render, Neon) și copiile de siguranță criptate ale bazei de date (GitHub);</li>
          <li>trimiterea emailurilor (Resend);</li>
          <li>recunoașterea textului din poza talonului (Anthropic);</li>
          <li>trimiterea SMS-urilor, pe canalul ales de stație (telefonul stației prin SMS Gateway for Android, sau SMSLink);</li>
          <li>mesajele WhatsApp către managerul stației (CallMeBot), dacă stația le folosește;</li>
          <li>emiterea facturilor în contul de facturare al stației (Oblio) și, de acolo, în e-Factura (ANAF), dacă stația le folosește;</li>
          <li>plata abonamentului cu cardul (NETOPIA Payments) și factura abonamentului (Oblio, e-Factura);</li>
          <li>
            notificările push pe telefonul sau calculatorul stației și al inspectorilor, dacă le pornesc: trec criptate prin serviciul de
            notificări al browserului (Google, Apple, Mozilla sau Microsoft), care nu le poate citi;
          </li>
          <li>nota și recenziile stației de pe Google (Google Places), doar date publice ale stației, fără date despre clienți.</li>
        </ul>
        <p>
          Unii furnizori pot prelucra date în afara Uniunii Europene; în aceste cazuri transferul se face pe baza garanțiilor prevăzute de
          GDPR. Nu vindem date și nu le folosim pentru reclame.
        </p>
      </Section>

      <Section title="Cât timp păstrăm datele">
        <ul className="list-disc pl-5 space-y-1">
          <li>cererile de demonstrație: cel mult 12 luni de la ultimul contact;</li>
          <li>cererile de retragere din contract: 3 ani, ca dovadă a primirii și a soluționării;</li>
          <li>
            datele stației și ale clienților ei: cât timp stația are cont; la cererea stației (Contul meu → Datele stației) contul se
            închide imediat, iar datele se șterg definitiv după 30 de zile;
          </li>
          <li>copiile de siguranță ale bazei de date: cel mult 30 de zile;</li>
          <li>linkurile de resetare a parolei și de confirmare a emailului: până expiră (o oră, respectiv 7 zile);</li>
          <li>istoricul modificărilor: un an;</li>
          <li>poza talonului: nu se păstrează.</li>
        </ul>
      </Section>

      <Section title="Drepturile dumneavoastră">
        <p>
          Aveți dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a vă retrage
          acordul pentru mesaje. Ne puteți scrie la datele de contact de mai sus. Aveți și dreptul să depuneți o plângere la Autoritatea
          Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (
          <a href="https://www.dataprotection.ro" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">dataprotection.ro</a>).
        </p>
      </Section>

      <Section title="Cookie-uri">
        <p>
          Nu folosim cookie-uri de reclamă sau de analiză. Browserul păstrează local doar ce e necesar pentru funcționare: sesiunea de
          autentificare, tema aleasă (luminoasă sau întunecată) și, pentru conturile stațiilor și ale inspectorilor, programările zilei
          curente, ca aplicația să le arate și fără internet; acestea se șterg la ieșirea din cont.
        </p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <Section title="Serviciul">
        <p>
          Easy ITP este o aplicație online pentru stații ITP: evidența inspecțiilor, remindere pentru clienți, programări online, rapoarte
          și portal pentru flote. Serviciul este oferit de <Contact />.
        </p>
      </Section>

      <Section id="vanzator" title="Cine vinde serviciul și emite factura">
        <p>
          Vânzătorul abonamentelor Easy ITP și al pachetelor de SMS, precum și emitentul facturii, este o singură entitate juridică:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Denumire: <b>{COMPANY.name}</b>, societate cu răspundere limitată, plătitoare de TVA</li>
          <li>CUI / CIF: {COMPANY.cui}</li>
          {COMPANY.regCom && <li>Nr. de ordine în Registrul Comerțului: {COMPANY.regCom}</li>}
          <li>Sediul social: {COMPANY.address}, România</li>
          <li>
            Telefon: <a href={COMPANY.phoneHref} className="text-blue-600 hover:underline">{COMPANY.phone}</a>, email:{' '}
            <a href={`mailto:${COMPANY.email}`} className="text-blue-600 hover:underline">{COMPANY.email}</a>
          </li>
        </ul>
        <p>
          <b>Rolul nostru:</b> {COMPANY.name} este <b>comerciantul direct</b> și furnizorul serviciului: dezvoltă și operează aplicația
          Easy ITP și o vinde, în nume și pe cont propriu, stațiilor ITP. Nu suntem marketplace, intermediar, distribuitor sau agent
          pentru alți vânzători. Contractul se încheie între stație și {COMPANY.name}, iar factura pentru fiecare plată este emisă de{' '}
          {COMPANY.name}, pe datele de facturare ale stației, și este transmisă în sistemul e-Factura.
        </p>
        <p>
          NETOPIA Payments este doar procesatorul plăților cu cardul; nu vinde serviciul și nu emite factura. Inspecțiile ITP nu se
          vând prin Easy ITP: programarea online la o stație este gratuită, iar inspecția se plătește direct stației, care emite propriul
          document fiscal. Facturile pe care o stație le emite clienților ei din aplicație (prin contul ei Oblio) sunt emise de stație, în
          numele ei.
        </p>
      </Section>

      <Section title="Contul stației">
        <ul className="list-disc pl-5 space-y-1">
          <li>Stația păstrează confidențialitatea parolei și răspunde pentru ce se face din contul ei.</li>
          <li>Stația răspunde de corectitudinea datelor introduse și de acordul clienților pentru mesaje.</li>
          <li>Datele introduse sunt ale stației; le poate exporta oricând din aplicație.</li>
        </ul>
      </Section>

      <Section id="pachete" title="Pachete și prețuri">
        <p>Prețurile sunt în lei (RON), pe lună. Firma este plătitoare de TVA; prețurile de mai jos includ TVA {VAT_PERCENT}%.</p>
        <ul className="list-disc pl-5 space-y-1">
          {PLANS.map((p) => (
            <li key={p.name}>
              <b>{PLAN_LABELS[p.name]}</b>: {p.price === 0 ? 'gratuit' : `${p.price} RON cu TVA inclus`}{' '}
              – {p.points.join('; ')}.
            </li>
          ))}
          <li>
            SMS-uri incluse, opțional, peste Pro sau Premium:{' '}
            {SMS_PLANS.map((p) => `${p.sms} SMS / lună cu ${p.price} RON cu TVA inclus`).join(', ')}.
          </li>
          <li>Plata pentru 12 luni costă cât 10 luni.</li>
          <li>
            O stație nouă primește 14 zile de probă cu pachetul Premium, fără card. La final alege un pachet plătit sau trece singură pe
            pachetul Gratuit. Dacă plătește în timpul probei, perioada plătită începe după ultima zi de probă.
          </li>
        </ul>
      </Section>

      <Section id="plata" title="Modalități de plată">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Cu cardul (Visa, Mastercard), online, din aplicație (Contul meu → Abonament), prin procesatorul NETOPIA Payments. Datele
            cardului se introduc pe pagina securizată NETOPIA Payments; {COMPANY.name} nu le vede și nu le păstrează.
          </li>
          <li>Prin transfer bancar, pe baza facturii, la cerere (ne scrieți la datele de contact).</li>
          <li>
            Plata se face în avans, pentru 1 lună sau 12 luni, în lei. Abonamentul nu se reînnoiește automat și cardul nu se debitează
            fără o plată inițiată de dumneavoastră. Factura se emite după confirmarea plății și apare în aplicație.
          </li>
        </ul>
      </Section>

      <Section id="livrare" title="Livrarea serviciului">
        <p>
          Easy ITP este un serviciu online; nu se livrează produse fizice. Pachetul plătit se activează automat în contul stației imediat
          după ce NETOPIA Payments confirmă plata (de obicei în câteva secunde), iar la plata prin transfer bancar în cel mult o zi
          lucrătoare de la primirea banilor. Serviciul se folosește din browser, la adresa aplicației, cu emailul și parola contului.
        </p>
        <p>
          Dacă pachetul nu apare activ după plată, ne scrieți și îl activăm sau vă returnăm suma.
        </p>
      </Section>

      <Section id="anulare" title="Anulare, retragere și rambursare">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Puteți renunța oricând: abonamentul nu se reînnoiește, iar după ultima zi plătită stația trece pe pachetul Gratuit. Datele
            rămân, iar funcțiile din pachetele plătite (de exemplu SMS-urile automate) se opresc. Contul și datele se pot șterge la
            cerere.
          </li>
          <li>
            La schimbarea pachetului, cel nou începe în ziua plății, iar zilele rămase din cel vechi se transformă în zile din cel nou,
            proporțional cu prețul.
          </li>
          <li>
            Serviciul se adresează firmelor (stații ITP). Dacă îl cumpărați ca persoană fizică (consumator), aveți dreptul să vă
            retrageți în 14 zile de la plată, fără să invocați un motiv, din pagina{' '}
            <Link to="/retragere" className="text-blue-600 hover:underline">Retrageți-vă din contract aici</Link> (link permanent în
            subsolul site-ului; primiți imediat confirmarea pe email) sau cu un email la {COMPANY.email}. Pentru că serviciul începe
            imediat, la cererea dumneavoastră, vi se returnează suma corespunzătoare zilelor nefolosite (art. 14 din OUG nr. 34/2014).
          </li>
          <li>
            Pentru firme, sumele plătite pentru perioada în curs nu se returnează, cu excepția cazului în care serviciul nu a putut fi
            furnizat din vina noastră.
          </li>
          <li>
            Rambursările se fac în cel mult 14 zile de la aprobare, pe același card (prin NETOPIA Payments) sau în contul bancar din care
            s-a plătit.
          </li>
        </ul>
      </Section>

      <Section title="Mesaje către clienți">
        <p>
          Reminderele automate se trimit doar clienților care și-au dat acordul și conțin un link de dezabonare. Când stația folosește un
          cont propriu la un furnizor de SMS, costul mesajelor și relația cu furnizorul sunt ale stației. SMS-urile incluse în
          abonament se trimit în limita pachetului lunar ales; un mesaj mai lung de 160 de caractere se numără ca două SMS-uri,
          iar SMS-urile nefolosite nu se reportează în luna următoare.
        </p>
      </Section>

      <Section title="Programările online">
        <p>
          Programarea se face direct la stația aleasă. Stația confirmă, mută sau anulează programarea și răspunde de inspecția propriu-zisă;
          Easy ITP doar transmite cererea.
        </p>
      </Section>

      <Section title="Disponibilitate și răspundere">
        <p>
          Ne străduim ca aplicația să funcționeze fără întreruperi și facem copii de siguranță ale datelor, dar nu putem garanta
          funcționarea neîntreruptă. Nu răspundem pentru pierderi indirecte (de exemplu venituri nerealizate) cauzate de indisponibilitate
          sau de mesaje care nu au ajuns.
        </p>
      </Section>

      <Section id="litigii" title="Reclamații și soluționarea litigiilor">
        <p>
          Reclamațiile ni le puteți trimite la datele de contact de mai sus; răspundem în cel mult 30 de zile. Consumatorii pot apela și
          la Autoritatea Națională pentru Protecția Consumatorilor, prin procedura de soluționare alternativă a litigiilor (SAL):{' '}
          <a href={ANPC_SAL_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">reclamatiisal.anpc.ro</a>.
        </p>
        <a href={ANPC_SAL_URL} target="_blank" rel="noreferrer" className="inline-block">
          <img src="/legal/anpc-sal.png" alt="ANPC – Soluționarea alternativă a litigiilor (SAL)" width={201} height={50} />
        </a>
      </Section>

      <Section id="prelucrare" title="Acordul de prelucrare a datelor (art. 28 GDPR)">
        <p>
          Această secțiune face parte din contractul dintre stație și {COMPANY.name} și se aplică datelor clienților stației pe care
          stația le introduce sau le primește prin Easy ITP.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <b>Roluri.</b> Stația ITP este operatorul datelor clienților ei; {COMPANY.name} este persoana împuternicită și le
            prelucrează doar pentru a furniza serviciul și doar după instrucțiunile stației, date prin folosirea aplicației și prin
            setările ei.
          </li>
          <li>
            <b>Ce date și ale cui.</b> Clienții stației (persoane fizice, reprezentanți ai firmelor, șoferi): nume, telefon, numărul
            și datele vehiculului, VIN, datele ITP-urilor și ale altor scadențe, programări, acordul pentru mesaje, mesajele trimise.
            Nu prelucrăm categorii speciale de date.
          </li>
          <li>
            <b>Scop și durată.</b> Evidența inspecțiilor, programări, remindere și rapoarte, pe durata contului; la încheiere, datele
            se pot descărca și se șterg conform secțiunii „Cât timp păstrăm datele” din politica de confidențialitate.
          </li>
          <li>
            <b>Confidențialitate și securitate.</b> Accesul la date îl au doar persoanele care întrețin serviciul, obligate la
            confidențialitate. Folosim conexiuni criptate (https), parole criptate, separarea datelor pe stație, limitarea încercărilor
            de logare, copii de siguranță și jurnalul modificărilor. Conturile de inspector le creează stația pentru oamenii ei; ele văd
            doar programările inspectorului respectiv, iar stația răspunde de cine le primește și le poate închide oricând.
          </li>
          <li>
            <b>Împuterniciți secundari.</b> Stația autorizează folosirea furnizorilor enumerați în politica de confidențialitate
            (găzduire, bază de date, email, SMS, recunoașterea talonului, facturare). Anunțăm pe această pagină orice furnizor nou
            înainte să-l folosim; stația se poate opune încheind contractul. Furnizorii au obligații de protecție a datelor cel puțin
            la fel de stricte, iar transferurile în afara UE se fac pe baza clauzelor contractuale standard.
          </li>
          <li>
            <b>Ajutor pentru stație.</b> Ajutăm stația să răspundă cererilor clienților (acces, rectificare, ștergere, opoziție):
            datele se pot vedea, corecta, șterge și exporta din aplicație, iar linkul de dezabonare oprește mesajele. O cerere primită
            direct de noi o transmitem stației.
          </li>
          <li>
            <b>Incidente.</b> Dacă aflăm de o încălcare a securității datelor stației, o anunțăm fără întârziere nejustificată, în cel
            mult 48 de ore, cu ce știm despre ea și ce am făcut.
          </li>
          <li>
            <b>La încheierea contractului</b> stația își descarcă datele (Contul meu → Datele stației); după ștergerea contului, datele
            se șterg definitiv în 30 de zile, iar din copiile de siguranță în cel mult încă 30 de zile.
          </li>
          <li>
            <b>Verificare.</b> La cerere, punem la dispoziția stației informațiile necesare pentru a arăta că respectăm aceste
            obligații.
          </li>
          <li>
            <b>Obligațiile stației.</b> Stația are temei legal pentru datele introduse, informează clienții (poate trimite la această
            politică), cere acordul pentru mesajele automate și nu trimite prin aplicație mesaje de marketing fără acord.
          </li>
        </ul>
      </Section>

      <Section title="Datele personale">
        <p>
          Modul în care prelucrăm datele este descris în{' '}
          <Link to="/confidentialitate" className="text-blue-600 hover:underline">Politica de confidențialitate</Link>.
        </p>
      </Section>

      <Section title="Modificări și lege aplicabilă">
        <p>
          Putem actualiza acești termeni; versiunea curentă este cea de pe această pagină. Se aplică legea română, iar eventualele
          neînțelegeri se rezolvă amiabil sau de instanțele competente din România.
        </p>
      </Section>
    </>
  );
}

// Paginile legale publice: politica de confidentialitate si termenii
export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  usePageTitle(doc === 'privacy' ? 'Politica de confidențialitate' : 'Termeni și condiții');
  // linkurile din subsol (/termeni#plata) deruleaza la sectiune
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash, doc]);
  const title = doc === 'privacy' ? 'Politica de confidențialitate' : 'Termeni și condiții';
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-800">
      <PublicHeader links={LINKS} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">Actualizat la {UPDATED}</p>
        </div>
        {doc === 'privacy' ? <Privacy /> : <Terms />}
      </main>
      <PublicFooter />
    </div>
  );
}
