# Agent Handoff

## Repo shape

- `front/`: SvelteKit frontend
- `back/`: Fastify + MongoDB backend
- `db/`: database-related scratch area, not currently the main runtime surface

## Run commands

- Frontend dev: `cd front && npm run dev`
- Frontend build check: `cd front && npm run build`
- Backend dev: `cd back && npm run dev`
- Backend start: `cd back && npm start`

## Backend status

- MongoDB is expected on `localhost:27017`.
- Fastify entrypoint: `back/index.js`
- Shared backend internals live in `back/lib/`
- Routes are split one file per request under `back/routes/`

### Auth/session model

- Account creation: `POST /users`
- Login: `POST /sessions/login`
- Who am I: `GET /whoami`
- Session list: `GET /sessions`
- Session revoke: `DELETE /sessions/:sessionId`
- Logout current session: `POST /sessions/logout`
- Login attempt history: `GET /login-attempts`

- Passwords use salted `scrypt` in `back/lib/passwords.js`
- Session tokens are not stored raw; only token hashes are stored in Mongo via `back/lib/sessions.js`
- Most routes require `Authorization: Bearer <token>`
- Public exceptions are create user, login, and ping
- Logout revokes the current token server-side
- Login rate limiting exists in `back/lib/login-rate-limit.js`

### Task model/runtime

- Create task: `POST /tasks`
- List inactive: `GET /tasks/inactive`
- List active: `GET /tasks/active`
- Activate: `POST /tasks/:taskId/activate`
- Inactivate: `POST /tasks/:taskId/inactivate`
- Done: `POST /tasks/:taskId/done`
- Snooze: `POST /tasks/:taskId/snooze`

- Exact active spans are recorded in `back/lib/task-runs.js`
- Inactive means:
  - repeatable tasks when idle
  - one-time tasks until completed
- Active means on the table for today
- Done behavior:
  - one-time task -> archived/disappears
  - repeatable task -> returns to inactive

## Frontend status

- Auth gate is in `front/src/routes/+layout.svelte`
- Session/token handling is in `front/src/lib/session.js`
- API helpers are in `front/src/lib/api.js` and `front/src/lib/tasks-client.js`
- Shared task card is `front/src/lib/TaskCard.svelte`

### Main routes

- `/auth`: login/create account
- `/inactive`: real DB-backed inactive task list
- `/active`: real DB-backed active task list
- `/add`: real DB-backed task creation form
- `/profile`: sessions + login attempt history
- `/stats`: currently filler/demo data only

### Current UI behavior worth knowing

- `/inactive` uses the whole card as the activate control. The clickable behavior and styling live in `front/src/lib/TaskCard.svelte`.
- The inactive card has a `svelte-ignore a11y_no_noninteractive_tabindex` comment because the card itself carries button semantics. This is intentional.
- `/active` includes alarm behavior with browser audio. Some browsers may require user interaction before sound can start.
- `/add` already writes to the backend and includes:
  - custom color selector
  - task type slider
  - alarm reveal with duration/snooze controls
  - additional notes reveal

## Data split: real vs filler

- Real backend-driven pages:
  - `/auth`
  - `/inactive`
  - `/active`
  - `/add`
  - `/profile`
- Filler/demo data:
  - `/stats` uses `front/src/lib/task-stats.js`
  - `front/src/lib/task-catalog.js` is still filler/reference data for display utilities, not the live task source

## Useful files

- Frontend shell/nav: `front/src/routes/Header.svelte`
- Frontend global route layout styles: `front/src/routes/layout.css`
- Stats page: `front/src/routes/stats/+page.svelte`
- Add page: `front/src/routes/add/+page.svelte`
- Backend Mongo/index setup: `back/lib/mongo.js`
- Backend auth gate: `back/lib/auth.js`
- Backend task validation/serialization: `back/lib/tasks.js`

## Likely next useful work

- Replace stats filler with real data derived from `task_runs` and task lifecycle events
- Add richer profile/session metadata in UI if needed
- Add tests; most work so far has been smoke-tested manually via local builds and Mongo-backed route checks
- Consider hardening password parameters further if this is moving past local/private use
