# EasyITP

Aplicație pentru stații ITP: evidența inspecțiilor, clienți de contactat când le expiră ITP-ul, programări și rapoarte.

- **Manager (o stație ITP):** dashboard cu ITP-uri și programările zilei, listă „De contactat” cu mesaje WhatsApp/SMS gata scrise, calendar, rapoarte lunare cu export pentru contabilitate, import/export CSV.
- **Clienți:** pagină publică de programare a stației (`/programare/<link>`), fără cont; programările apar în calendarul stației.
- **Admin:** conturile managerilor (creare, resetare parolă, dezactivare) și cifre agregate pe stații.

## Rulare locală

Backend (Java 17, Postgres):

```bash
./mvnw spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Teste

```bash
./mvnw test              # backend, pe H2 in memorie (nu cere Postgres)
cd frontend && npm test  # utilitare frontend (Vitest)
```

## Configurare (variabile de mediu)

| Variabilă | Descriere |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | conexiunea Postgres |
| `JWT_SECRET` | minim 32 de caractere |
| `ADMIN_PASSWORD` | parola contului `admin@itp.ro` (sincronizată la pornire) |
| `ALLOWED_ORIGINS` | originile CORS, ex. `https://easyitp.vercel.app` |
| `PORT` | implicit 8080 |
| `VITE_API_BASE_URL` | (frontend) adresa backend-ului |

## Deploy

La push pe `main`: frontend-ul pe Vercel, backend-ul pe Render (Docker), baza de date pe Neon. CI-ul din GitHub Actions rulează testele, lint-ul și build-ul.
