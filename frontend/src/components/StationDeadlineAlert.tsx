import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { StationDeadline } from '../types';
import { getStationDeadlines } from '../api/stationDeadlineApi';
import { usePlan } from '../context/plan';
import { daysText, dueFirst } from '../utils/stationDeadlines';
import { formatDateRo } from '../utils/fleet';

// Dashboard: termenele statiei care expira curand (autorizatia RAR, metrologie, atestate); nimic daca nu sunt
export default function StationDeadlineAlert() {
  const { has } = usePlan();
  return has('STATION_DEADLINES') ? <DueDeadlines /> : null;
}

function DueDeadlines() {
  const [due, setDue] = useState<StationDeadline[]>([]);

  useEffect(() => {
    getStationDeadlines()
      .then((list) => setDue(dueFirst(list)))
      .catch(() => setDue([]));
  }, []);

  if (due.length === 0) return null;
  const expired = due.some((d) => d.daysLeft < 0);
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${expired ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert size={16} className="shrink-0" /> Termenele stației
        </p>
        <Link to="/account#termene" className="text-xs font-semibold underline shrink-0">
          Vezi toate
        </Link>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-sm">
        {due.slice(0, 5).map((d) => (
          <li key={d.id}>
            <span className="font-medium">{d.label}</span>
            {d.title && ` · ${d.title}`} — {daysText(d.daysLeft)} ({formatDateRo(d.dueDate)})
          </li>
        ))}
        {due.length > 5 && <li className="text-xs opacity-75">și încă {due.length - 5}</li>}
      </ul>
    </div>
  );
}
