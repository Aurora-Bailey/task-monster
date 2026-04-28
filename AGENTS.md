# Agent Handoff

This file is the canonical repo handoff for future agents. If behavior changes, update this file with the code.

## Repo shape

- `front/`: SvelteKit frontend
- `back/`: Fastify + MongoDB backend
- `db/`: scratch area, not part of the main runtime

## Run commands

- Frontend install: `cd front && npm install`
- Frontend dev: `cd front && npm run dev`
- Frontend build check: `cd front && npm run build`
- Backend install: `cd back && npm install`
- Backend dev: `cd back && npm run dev`
- Backend start: `cd back && npm start`

## Runtime and config

- Frontend is client-rendered only.
  - `front/src/routes/+layout.js` sets `ssr = false`
  - every current page route sets `csr = true`
- Root `.env` is the env source of truth for the current frontend and backend runtime
  - tracked template: `.env.example`
  - backend loads `../.env` at startup
  - frontend Vite config points `envDir` at the repo root
- `/` is now a public marketing landing page
- `/demo-board` is also public and currently acts as a screenshot-led product tour without requiring auth
- Frontend API base URL comes from `PUBLIC_API_BASE_URL`
  - default: `http://127.0.0.1:3001`
- Backend config is in `back/lib/config.js`
  - `HOST` default: `127.0.0.1`
  - `PORT` default: `3001`
  - `MONGO_URL` default: `mongodb://127.0.0.1:27017`
  - `MONGO_DB_NAME` default: `task-monster`
  - `OPENAI_MODEL` default: `gpt-5.4-mini`
  - `OPENAI_API_KEY` is required for the authenticated in-app assistant
- MongoDB is expected locally unless env vars override it

## Backend architecture

- Fastify entrypoint: `back/index.js`
- Shared backend internals live in `back/lib/`
- Route files are auto-registered from `back/routes/` by `back/lib/register-routes.js`
- Authentication is enforced by a global `preHandler` hook in `back/index.js`
- Mongo indexes are created on startup in `back/lib/mongo.js`
- Main collections currently used:
  - `users`
  - `sessions`
  - `login_attempts`
  - `login_events`
  - `tasks`
  - `task_runs`
  - `panic_runs`
- Current startup quirk:
  - Fastify/Ajv emits strict-mode warnings for `type: ['integer', 'string']` query/body schemas around `tzOffsetMinutes`, but the server still boots

## Auth and session model

- Public routes:
  - `GET /ping`
  - `POST /users`
  - `POST /sessions/login`
- Account creation currently requires prerelease alpha code `gyarados`
- Account creation also requires explicit acceptance of the current Privacy Policy and Terms & Conditions
- New user records currently store legal acceptance metadata:
  - `users.legalAcceptance.acceptedAt`
  - `users.legalAcceptance.version`
- Session verification route:
  - `GET /whoami`
- Assistant route:
  - `POST /assistant/chat`
  - runs authenticated tool actions under the current user
- Session management routes:
  - `GET /sessions`
  - `DELETE /sessions/:sessionId`
  - `POST /sessions/logout`
- Security details:
  - passwords use salted `scrypt` in `back/lib/passwords.js`
  - auth tokens are generated raw once, but only SHA-256 token hashes are stored in Mongo
  - bearer parsing and auth lookup live in `back/lib/auth.js` and `back/lib/tokens.js`
  - failed logins are rate-limited in `back/lib/login-rate-limit.js`
  - login outcomes are recorded in `login_events`

## Task model

- Tasks have two modes:
  - `one-time`
  - `repeatable`
- Tasks have two tracking types:
  - `time`
  - `tally`
- Shared task validation and serialization live in `back/lib/tasks.js`
- Template-level task note:
  - stored on `tasks.note`
  - editable from inactive, daymap, active, and done views
- Per-run instance note:
  - stored on the open or closed `task_runs` record
  - editable only while active
- Exact active spans are recorded in `task_runs`
- Tally changes during an active tally task update both the task document and the open run

## Task lifecycle

### States

- Inactive:
  - `archived: false`
  - `activeToday: false`
  - `mappedToday !== true`
- Daymap:
  - `mappedToday: true`
  - `activeToday: false`
- Active:
  - `activeToday: true`
- Done history:
  - derived from closed `task_runs` where `endingReason === 'done'`
- Archived:
  - currently hidden from the app
  - there is no archive page yet

### State transitions

- Create task:
  - `POST /tasks`
  - creates an inactive task
- Move to daymap:
  - `POST /tasks/:taskId/daymap`
- Remove from daymap back to inactive:
  - `POST /tasks/:taskId/unmap`
- Activate:
  - `POST /tasks/:taskId/activate`
  - opens a `task_runs` record
- Inactivate:
  - `POST /tasks/:taskId/inactivate`
  - closes the open run with `endingReason: 'inactive'`
- Done:
  - `POST /tasks/:taskId/done`
  - closes the open run with `endingReason: 'done'`
  - accepts optional `startedAt`, `completedAt`, and `instanceNote`
- Archive:
  - `POST /tasks/:taskId/archive`
  - only allowed for inactive tasks

### Done behavior

- One-time task:
  - becomes `archived: true`
  - disappears from normal UI
- Repeatable task:
  - returns to inactive by default
  - if `daymapLocked === true`, it returns to daymap instead

### Daymap and queue behavior

- Daymap list route:
  - `GET /tasks/daymap`
- Queue routes:
  - `POST /tasks/:taskId/queue`
  - `POST /tasks/:taskId/unqueue`
- Queue order uses `queuePosition`
- Only daymap tasks can be queued
- When the last active task is removed from the table by `done` or `inactivate`, the backend auto-activates the next queued daymap task if one exists
- Daymap lock route:
  - `PATCH /tasks/:taskId/daymap-lock`
- Daymap lock is mainly meaningful for repeatable tasks because it controls whether `done` loops them back to the daymap

## Active-task behavior

- Active list route:
  - `GET /tasks/active`
- Time tasks may have alarms and snooze:
  - `POST /tasks/:taskId/snooze`
- Tally tasks update through:
  - `POST /tasks/:taskId/tally`
- Task note route:
  - `PATCH /tasks/:taskId/note`
- Active run instance note route:
  - `PATCH /tasks/:taskId/instance-note`
- Active API responses include derived runtime fields:
  - `panicMilliseconds`
  - `effectiveMilliseconds`
  - `taskPanicLog`

## Panic model

- Panic routes:
  - `GET /panic/status`
  - `POST /panic/start`
  - `POST /panic/stop`
- Panic records live in `panic_runs`
- Panic mode currently does not auto-pause or inactivate tasks
  - it logs off-rails spans
  - it subtracts overlap from effective task time in active, done, and stats views
- Stopping panic can attach:
  - freeform `note`
  - `emotionalCharge` from 1 to 10
- `POST /panic/start` currently returns `pausedTaskCount: 0`

## Stats and history

- Done-history route:
  - `GET /tasks/done`
- Daily stats route:
  - `GET /stats/daily`
- Both are real backend-derived features now
- Both accept local-day context via:
  - `day`
  - `tzOffsetMinutes`
- Stats are derived from:
  - `task_runs`
  - `panic_runs`
- Current stats response includes:
  - summary cards
  - overlap bands
  - top task breakdown
  - hourly cadence
  - panic log
  - done log
  - full session log

## Frontend architecture

- Auth gate and boot splash:
  - `front/src/routes/+layout.svelte`
  - public routes are currently `/`, `/demo-board`, `/auth`, `/privacy`, and `/terms`
  - protected routes still wait for session initialization before redirecting guests
- Marketing screenshots used by the public landing/product-tour pages live in:
  - `front/static/images/marketing/`
- Session storage and authorized fetch helpers:
  - `front/src/lib/session.js`
- Raw API helper:
  - `front/src/lib/api.js`
- Task API wrapper:
  - `front/src/lib/tasks-client.js`
- Stats client:
  - `front/src/lib/stats-client.js`
- Panic client:
  - `front/src/lib/panic-client.js`
- Assistant client:
  - `front/src/lib/assistant-client.js`
- Assistant markdown renderer:
  - `front/src/lib/assistant-markdown.js`
- Assistant drawer:
  - `front/src/lib/AssistantDrawer.svelte`
- Shared task card:
  - `front/src/lib/TaskCard.svelte`
- Shared sort control:
  - `front/src/lib/TaskSortBar.svelte`
- Top nav and panic control:
  - `front/src/routes/Header.svelte`
  - now also owns the authenticated AI drawer trigger and drawer mount

## Main frontend routes

- `/`
  - public landing page with marketing copy and signup/login CTA
- `/demo-board`
  - public product-tour page using real app screenshots
- `/auth`
  - login and account creation
- `/privacy`
  - public legal page, accessible without authentication
- `/terms`
  - public legal page, accessible without authentication
- `/inactive`
  - inactive backlog
- `/daymap`
  - tasks chosen for today but not active yet
- `/active`
  - current active tasks
- `/done`
  - completed-task history by local day
- `/stats`
  - real daily stats from backend
- `/add`
  - task creation form
- `/profile`
  - active sessions plus recent login attempt history

## Current UI behavior worth knowing

- `/` is a public landing page, not a redirect anymore
- `/demo-board` now holds the screenshot-led product tour that replaced the old simulated board demo
- Inactive cards use the whole card as the action target
  - click or keyboard activation moves the task to daymap, not directly to active
- Account creation on `/auth` now requires:
  - alpha code entry
  - password confirmation
  - checking agreement to the Privacy Policy and Terms & Conditions
- The inactive card intentionally uses a `svelte-ignore a11y_no_noninteractive_tabindex` comment because the card itself carries button semantics
- Task note autosave is debounced in `TaskCard.svelte`
- Active-task instance note autosave is also debounced in `TaskCard.svelte`
- Daymap cards expose:
  - activate
  - queue or unqueue
  - daymap lock toggle
  - unmap back to inactive
- Active page includes:
  - browser audio alarm behavior
  - tally increment and decrement controls
  - snooze
  - done modal with adjustable start and end timing
- Some browsers require prior user interaction before audio alarms can play
- Header supports left and right arrow-key navigation across the main board pages when focus is not inside an input
- The header now also exposes an `AI` button next to `Panic`
  - it opens a right-side assistant drawer
  - assistant replies are rendered through a local safe markdown renderer, not a third-party package
  - assistant-triggered changes dispatch `taskmonster:assistant-refresh`
  - active/daymap/inactive/done/stats listen for that event and reload as needed
  - arrow-key navigation is intentionally disabled while the drawer is open
- Panic controls live in the header, not on the active page itself

## In-app assistant

- The authenticated assistant is backend-mediated only; the OpenAI key stays on the server.
- Backend route:
  - `POST /assistant/chat`
- Current v1 tool surface:
  - list or search tasks by board state
  - summarize a local day from real stats
  - create tasks
  - rename tasks
  - update task note
  - update active instance note
  - move tasks between inactive/daymap/active/done/archive semantics
  - queue or unqueue daymap tasks
  - toggle daymap lock
  - update active tally counts
  - snooze alarms
  - start or stop panic mode

## Filler vs real data

- Real backend-driven pages:
  - `/auth`
  - `/inactive`
  - `/daymap`
  - `/active`
  - `/done`
  - `/stats`
  - `/add`
  - `/profile`
- Still filler or reference only:
  - `front/src/lib/task-catalog.js`
- Old docs claiming `/stats` is filler are outdated

## Useful files

- Frontend shell and nav:
  - `front/src/routes/Header.svelte`
- Frontend route-level styling:
  - `front/src/routes/layout.css`
- Add page:
  - `front/src/routes/add/+page.svelte`
- Active page:
  - `front/src/routes/active/+page.svelte`
- Daymap page:
  - `front/src/routes/daymap/+page.svelte`
- Done page:
  - `front/src/routes/done/+page.svelte`
- Stats page:
  - `front/src/routes/stats/+page.svelte`
- Backend Mongo and index setup:
  - `back/lib/mongo.js`
- Backend auth gate:
  - `back/lib/auth.js`
- Backend task validation and serialization:
  - `back/lib/tasks.js`
- Backend run tracking:
  - `back/lib/task-runs.js`
- Backend queue handling:
  - `back/lib/task-queue.js`
- Backend panic helpers:
  - `back/lib/panic.js`

## Verification and gaps

- There is no automated test suite yet
- Cheap smoke checks that match current workflow:
  - `cd front && npm run build`
  - boot the backend against a reachable Mongo instance
- `db/` should not be treated as the source of truth for runtime behavior
- If docs and code disagree, prefer the code and then update this file
