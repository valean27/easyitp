import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './landing/PublicChrome';
import { COMPANY } from '../utils/company';

const LINKS = [
  { href: '/', label: 'Pentru stații ITP' },
  { href: '/statii', label: 'Stații ITP' },
];

const UPDATED = '5 octombrie 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-2 text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

function Contact() {
  return (
    <>
      {COMPANY.name}, CUI {COMPANY.cui}, telefon <a href={COMPANY.phoneHref} className="text-blue-600 hover:underline">{COMPANY.phone}</a>,
      sau prin formularul de pe <Link to="/#demo" className="text-blue-600 hover:underline">pagina principală</Link>
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
            <b>Programarea online la o stație:</b> nume, telefon, număr de înmatriculare, tipul vehiculului, data și ora, ca stația să vă
            poată primi.
          </li>
          <li>
            <b>Reminderele ITP (SMS / WhatsApp):</b> nume, telefon, numărul mașinii și data expirării. Mesajele automate se trimit doar
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
          <li>mesajele WhatsApp către managerul stației (CallMeBot), dacă stația le folosește.</li>
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

      <Section title="Mesaje către clienți">
        <p>
          Reminderele automate se trimit doar clienților care și-au dat acordul și conțin un link de dezabonare. Când stația folosește un
          cont propriu la un furnizor de SMS, costul mesajelor și relația cu furnizorul sunt ale stației.
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
