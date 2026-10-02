# EasyITP

ITP (vehicle inspection) station management app: ITP records, appointments calendar, CSV import, user admin. JWT auth.

## Stack
- Backend: Spring Boot 3.3.5, Java 17, Maven (`mvnw`), JPA + PostgreSQL, Spring Security + JWT, Lombok, commons-csv.
- Frontend (`frontend/`): React 19 + TypeScript, Vite, Tailwind 4, axios, react-router, FullCalendar.

## Layout
- `src/main/java/org/example/easyitp/` — `controller/`, `service/`, `repository/`, `entity/`, `dto/`, `security/` (JwtUtil, JwtRequestFilter), `config/` (Security, CORS, DataSeeder).
- `src/main/resources/application.properties` — config via env: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `PORT` (default 8080). `ddl-auto=update`.
- `frontend/src/` — `api/` (one module per backend controller, shared `axiosInstance.ts`), `components/` (pages + modals), `context/AuthContext.tsx`, `types/index.ts`.

## Commands
- Backend: `./mvnw spring-boot:run` · build `./mvnw clean package` · test `./mvnw test`
- Frontend (in `frontend/`): `npm run dev` (proxies `/api` → localhost:8080) · `npm run build` · `npm run lint`
- Docker: `Dockerfile` builds backend only.

## Notes
- Comments/UI text are partly in Romanian.
- Generated dirs (`target/`, `frontend/dist`, `frontend/node_modules`) are Read-denied in `.claude/settings.json`; don't scan them.
