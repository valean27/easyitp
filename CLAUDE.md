# EasyITP

ITP (vehicle inspection) station management app. One manager = one ITP station: ITP records, reminders for expiring ITPs (WhatsApp/SMS), appointments calendar, reports, CSV import/export. Admin manages manager accounts and sees aggregated numbers only. JWT auth.

## Stack
- Backend: Spring Boot 3.3.5, Java 17, Maven (`mvnw`), JPA + PostgreSQL, Spring Security + JWT, Lombok, commons-csv.
- Frontend (`frontend/`): React 19 + TypeScript, Vite, Tailwind 4, axios, react-router, FullCalendar, Vitest.

## Layout
- `src/main/java/org/example/easyitp/` — `controller/`, `service/`, `repository/`, `entity/`, `dto/`, `security/` (JwtUtil, JwtRequestFilter, CurrentUser), `config/` (SecurityConfig incl. CORS, DataSeeder).
- `src/main/resources/application.properties` — config via env: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (>= 32 bytes), `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`, `SHOW_SQL`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `CRON_SECRET`, `PORT` (default 8080). Default JVM time zone is set to Europe/Bucharest (`TimeZoneConfig`). `ddl-auto=update` (avoid `columnDefinition`; it breaks the Postgres ALTER).
- `frontend/src/` — `api/` (one module per backend controller, shared `axiosInstance.ts`), `components/` (pages + modals; pages are lazy-loaded in `App.tsx`), `context/` (`AuthContext.tsx` provider, `auth.ts` context + `useAuth`), `utils/` (pure helpers with `*.test.ts`), `types/index.ts`.
- Public booking page `/programare/:slug` (no login): backend `/api/public/**` is permitAll, rate-limited per IP (`BookingRateLimiter`) with a honeypot field; settings per station on `AppUser.booking*`.
- Daily digest email: GitHub Actions (`daily-digest.yml`) calls `POST /api/internal/daily-digest` with `X-Cron-Secret`; `DigestService` builds it, `EmailService` sends via Resend. Never commit API keys.
- Data scoping: every manager query filters by `client.user.id`; legacy clients may have `user_id = null` and must be skipped.
- Same license plate (ignoring spaces/dashes/case, `PlateUtils`) = same vehicle; only the latest ITP per vehicle counts for expiry.

## Commands
- Backend: `./mvnw spring-boot:run` · build `./mvnw clean package` · test `./mvnw test` (H2 in-memory, profile `test`; no Postgres needed)
- Frontend (in `frontend/`): `npm run dev` (proxies `/api` → localhost:8080) · `npm run build` · `npm run lint` · `npm test`
- CI: `.github/workflows/ci.yml` runs backend tests + frontend lint/test/build on push.
- Docker: `Dockerfile` builds backend only.

## Deploy
- `main` auto-deploys: frontend on Vercel (`frontend/`, SPA rewrite in `vercel.json`), backend on Render (Dockerfile), DB on Neon.

## Notes
- Comments/UI text are partly in Romanian.
- Generated dirs (`target/`, `frontend/dist`, `frontend/node_modules`) are Read-denied in `.claude/settings.json`; don't scan them.
