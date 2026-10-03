# EasyITP

ITP (vehicle inspection) station management app. One manager = one ITP station: ITP records, reminders for expiring ITPs (WhatsApp/SMS), appointments calendar, reports, CSV import/export. Admin manages manager accounts and sees aggregated numbers only. JWT auth.

## Stack
- Backend: Spring Boot 3.3.5, Java 17, Maven (`mvnw`), JPA + PostgreSQL, Spring Security + JWT, Lombok, commons-csv.
- Frontend (`frontend/`): React 19 + TypeScript, Vite, Tailwind 4, axios, react-router, FullCalendar, Vitest.

## Layout
- `src/main/java/org/example/easyitp/` — `controller/`, `service/`, `repository/`, `entity/`, `dto/`, `security/` (JwtUtil, JwtRequestFilter, CurrentUser), `config/` (SecurityConfig incl. CORS, DataSeeder).
- `src/main/resources/application.properties` — config via env: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (>= 32 bytes), `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`, `SHOW_SQL`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `PORT` (default 8080). `JWT_SECRET`, `ADMIN_PASSWORD` (only for the first start on an empty DB) and `ALLOWED_ORIGINS` have no defaults: startup fails without them; local defaults live in `application-dev.properties` (profile `dev`, enabled by `./mvnw spring-boot:run`; for `java -jar` pass `--spring.profiles.active=dev` or the env vars). Default JVM time zone is set to Europe/Bucharest (`TimeZoneConfig`). `ddl-auto=update` (avoid `columnDefinition`; it breaks the Postgres ALTER).
- `frontend/src/` — `api/` (one module per backend controller, shared `axiosInstance.ts`), `components/` (pages + modals; pages are lazy-loaded in `App.tsx`), `context/` (`AuthContext.tsx` provider, `auth.ts` context + `useAuth`), `utils/` (pure helpers with `*.test.ts`), `types/index.ts`.
- Public booking page `/programare/:slug` (no login): backend `/api/public/**` is permitAll, rate-limited per IP (`BookingRateLimiter`) with a honeypot field; settings per station on `AppUser.booking*`. Capacity: each appointment has `vehicleCategory` + `durationMinutes` (legacy null = 30 min); per-station durations per vehicle type in `AppUser.bookingDurations` (`InspectionDurations`, defaults car 20 / 4x4 30 / van 45); online slots = the type's own grid plus the end times of other bookings, offered only if the whole interval fits on one of `bookingCapacity` lines.
- Daily digest email: GitHub Actions (`daily-digest.yml`) calls `POST /api/internal/daily-digest` with `X-Cron-Secret`; `DigestService` builds an HTML and a WhatsApp text version; each manager picks the channel: `EmailService` (Resend) or `WhatsAppService` (CallMeBot, free personal-use API, per-manager key never returned to the client). Never commit API keys.
- Registration scan: `POST /api/itp/scan-registration` (multipart `image`) sends the photo of the Romanian talon to Claude Haiku (`RegistrationScanService`, forced tool use, fields A/E/D.1/D.3/B/C.2.x), maps make/model through the car dictionary; the photo is never stored, 200 scans/user/day cap. Frontend shrinks the photo first (`utils/image.ts`). Talon only, never ID cards (GDPR).
- Fleets (B2B): a manager creates `Fleet`s (company, CUI, plates in `fleet_plates`) and one login per fleet (`AppUser` with role `FLEET` + `fleetId`). Manager API `/api/fleets/**`, fleet portal `/api/fleet-portal/**` (`FleetService`): vehicles matched by normalized plate against the station's latest ITPs, and a monthly statement (informative, not a fiscal invoice; CSV + printable page built in `utils/fleet.ts`). `SecurityConfig` limits FLEET to the portal and `/api/account/me|password`. `SchemaFixes` drops Hibernate's old `app_users_role_check` on startup so the new role can be stored.
- Owner reports: inspectors are names only (`AppUser.inspectors`, `/api/account/inspectors`), picked per ITP (`ItpRecord.inspector`, last choice remembered per device). `ReportService` adds per-inspector monthly rows and retention (vehicles with an ITP last year that reached expiry: returned this year vs lost, with a call list). Admin gets neither names nor the lost-client list (aggregates only).
- Dark mode: `ThemeProvider` (`context/ThemeContext.tsx`, `useTheme` in `context/theme.ts`) sets `<html data-theme>`; an inline script in `index.html` applies it before paint. `index.css` remaps the slate scale via Tailwind CSS variables, maps `bg-white`/`.modal-panel` to `--surface`, and overrides colored tints per class (generated block). Don't add `dark:` classes everywhere; use `var(--surface)` / `var(--color-slate-*)` for inline colors, and the `dark:` variant only for one-off fixes. MUI calendar gets its own dark theme.
- Security: errors go through `config/ApiExceptionHandler` as `{"message"}` (bad dates/params/body and DB constraint errors -> 400); don't add per-controller handlers. JWT carries `tv` = `AppUser.tokenVersion`; `revokeTokens()` on password change/reset, deactivation and fleet password change (password change returns a new token). Login: emails lowercased + `findByEmailIgnoreCase`, failed attempts limited per email and per IP (`LoginRateLimiter`), dummy bcrypt for unknown emails. Client IP for limits = `CF-Connecting-IP` (`security/ClientIp`; Render is behind Cloudflare and keeps client-sent X-Forwarded-For). CSV cells go through `CsvCells.cell` (quoting + formula neutralizing). Admin report export has no plates/names. Frontend security headers + CSP in `frontend/vercel.json` (no inline scripts: the theme script is `public/theme-init.js`; `connect-src` must list the backend URL).
- Data scoping: every manager query filters by `client.user.id`; legacy clients may have `user_id = null` and must be skipped.
- Same license plate (ignoring spaces/dashes/case, `PlateUtils`) = same vehicle; only the latest ITP per vehicle counts for expiry.

## Commands
- Backend: `./mvnw spring-boot:run` (profile `dev`) · build `./mvnw clean package` · test `./mvnw test` (H2 in-memory, profile `test`; no Postgres needed)
- Frontend (in `frontend/`): `npm run dev` (proxies `/api` → localhost:8080) · `npm run build` · `npm run lint` · `npm test`
- CI: `.github/workflows/ci.yml` runs backend tests + frontend lint/test/build on push.
- Docker: `Dockerfile` builds backend only.

## Deploy
- `main` auto-deploys: frontend on Vercel (`frontend/`, SPA rewrite in `vercel.json`), backend on Render (Dockerfile), DB on Neon.

## Notes
- Comments/UI text are partly in Romanian.
- Generated dirs (`target/`, `frontend/dist`, `frontend/node_modules`) are Read-denied in `.claude/settings.json`; don't scan them.
