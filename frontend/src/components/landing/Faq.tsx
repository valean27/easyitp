import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TRIAL_DAYS, planPrice } from '../../utils/plans';

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'De ce am nevoie ca să încep?',
    a: 'De un calculator, o tabletă sau un telefon cu internet. Aplicația merge în browser, nu se instalează nimic.',
  },
  {
    q: 'Pot aduce clienții pe care îi am deja?',
    a: 'Da. Încărcați fișierul Excel (.xlsx) sau CSV, inclusiv exportul din altă aplicație: coloanele (nume, telefon, număr, data ITP-ului, expirarea) se potrivesc singure și le puteți corecta înainte de import. Aplicația recunoaște mărcile și unește înregistrările aceluiași vehicul.',
  },
  {
    q: 'Cum pleacă SMS-urile automate?',
    a: 'Alegeți: dintr-un pachet de SMS inclus în abonament (le trimitem noi), de pe telefonul Android al stației, cu o aplicație gratuită, sau prin contul propriu la un furnizor de SMS. Mesajele pleacă singure dimineața, la termenele alese de dumneavoastră (de exemplu cu 30 și cu 7 zile înainte).',
  },
  {
    q: 'Clienții pot refuza mesajele?',
    a: 'Da. Trimitem doar clienților care și-au dat acordul, iar fiecare SMS are un link de dezabonare. Cine se dezabonează nu mai primește nimic.',
  },
  {
    q: 'Cum se programează clienții online?',
    a: 'Stația primește o pagină de programare proprie. Clientul alege tipul vehiculului, ziua și ora, iar aplicația oferă doar intervalele libere, după durata inspecției și numărul de linii.',
  },
  {
    q: 'Merge și pe telefon?',
    a: 'Da. Formularul ITP, calendarul și lista „De contactat” sunt gândite pentru telefon. Puteți scana talonul cu camera, iar datele mașinii se completează singure.',
  },
  {
    q: 'Am clienți firme, cu flote de mașini.',
    a: 'Fiecare firmă poate primi un cont propriu, în care își vede mașinile, scadențele ITP și centralizatorul lunar.',
  },
  {
    q: 'Cât costă și cum plătesc?',
    a: `Pachetul Gratuit e gratuit pentru totdeauna. Pro costă ${planPrice('PRO')} RON și Premium ${planPrice('PREMIUM')} RON pe lună, fără TVA, iar SMS-urile incluse se adaugă opțional. Plătiți cu cardul din aplicație, pentru 1 lună sau 12 luni (12 la prețul a 10). Abonamentul nu se reînnoiește singur.`,
  },
  {
    q: `Ce se întâmplă după cele ${TRIAL_DAYS} zile de probă?`,
    a: 'Alegeți un pachet plătit sau rămâneți pe Gratuit. Dacă plătiți mai devreme, nu pierdeți zilele de probă: perioada plătită începe după ele. Nu pierdeți nimic: clienții, ITP-urile și programările rămân, doar funcțiile din pachetele plătite se opresc până le activați.',
  },
  {
    q: 'Cine vede datele stației?',
    a: 'Doar contul stației. Fiecare stație își vede numai clienții ei, iar orice modificare sau ștergere rămâne în istoric și poate fi anulată.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {QUESTIONS.map((item, i) => (
        <div key={item.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm sm:text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            {item.q}
            <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && <p className="px-5 pb-4 -mt-1 text-sm text-slate-600 leading-relaxed">{item.a}</p>}
        </div>
      ))}
    </div>
  );
}
