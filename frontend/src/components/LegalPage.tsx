import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './landing/PublicChrome';
import { ANPC_SAL_URL, COMPANY } from '../utils/company';
import { PLANS, PLAN_LABELS, VAT_PERCENT, amountWithVat, formatRon } from '../utils/plans';
import { SMS_PLANS } from '../utils/smsPlans';

const LINKS = [
  { href: '/', label: 'Pentru stații ITP' },
  { href: '/statii', label: 'Stații ITP' },
];

const UPDATED = '6 octombrie 2026';

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
            <b>Programarea online la o stație:</b> nume, telefon, număr de înmatriculare, tipul vehiculului, data și ora, ca stația să vă
            poată primi; dacă stația le folosește, primiți un SMS de confirmare și unul cu o zi înainte, cu un link din care vă
            puteți anula sau muta programarea.
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
          <li>găzduirea aplicației și a bazei de date (Vercel, Render, Neon);</li>
          <li>trimiterea emailurilor (Resend);</li>
          <li>recunoașterea textului din poza talonului (Anthropic);</li>
          <li>trimiterea SMS-urilor, pe canalul ales de stație (telefonul stației prin SMS Gateway for Android, sau SMSLink);</li>
          <li>mesajele WhatsApp către managerul stației (CallMeBot), dacă stația le folosește;</li>
          <li>emiterea facturilor în contul de facturare al stației (Oblio) și, de acolo, în e-Factura (ANAF), dacă stația le folosește;</li>
          <li>plata abonamentului cu cardul (NETOPIA Payments) și factura abonamentului (Oblio, e-Factura);</li>
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
          <li>datele stației și ale clienților ei: cât timp stația are cont, apoi se șterg la cererea stației;</li>
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
          autentificare și tema aleasă (luminoasă sau întunecată).
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

      <Section title="Contul stației">
        <ul className="list-disc pl-5 space-y-1">
          <li>Stația păstrează confidențialitatea parolei și răspunde pentru ce se face din contul ei.</li>
          <li>Stația răspunde de corectitudinea datelor introduse și de acordul clienților pentru mesaje.</li>
          <li>Datele introduse sunt ale stației; le poate exporta oricând din aplicație.</li>
        </ul>
      </Section>

      <Section id="pachete" title="Pachete și prețuri">
        <p>Prețurile sunt în lei (RON), pe lună. Firma este plătitoare de TVA; la prețurile de mai jos se adaugă TVA {VAT_PERCENT}%.</p>
        <ul className="list-disc pl-5 space-y-1">
          {PLANS.map((p) => (
            <li key={p.name}>
              <b>{PLAN_LABELS[p.name]}</b>: {p.price === 0 ? 'gratuit' : `${p.price} RON + TVA (${formatRon(amountWithVat(p.name, 0, 1))} cu TVA)`}{' '}
              – {p.points.join('; ')}.
            </li>
          ))}
          <li>
            SMS-uri incluse, opțional, peste Pro sau Premium:{' '}
            {SMS_PLANS.map((p) => `${p.sms} SMS / lună cu ${p.price} RON + TVA`).join(', ')}.
          </li>
          <li>Plata pentru 12 luni costă cât 10 luni.</li>
          <li>
            O stație nouă primește 14 zile de probă cu pachetul Premium, fără card. La final alege un pachet plătit sau trece singură pe
            pachetul Gratuit.
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
            retrageți în 14 zile de la plată, fără să invocați un motiv, cu un email la {COMPANY.email}. Pentru că serviciul începe
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
