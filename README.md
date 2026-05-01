# task-monster

Task Monster is a SvelteKit + Fastify + MongoDB task board built around a concrete daily flow:

- `inactive`: backlog tasks not selected for today yet
- `daymap`: tasks chosen for today but not active yet
- `active`: tasks currently on the table
- `done`: completed run history
- `stats`: daily stats derived from task runs and panic runs

It also supports timed tasks, tally tasks, session management, and a `panic` overlay that records off-the-rails time and subtracts it from effective task time.

Authenticated app pages now also expose an AI assistant drawer in the header. It talks to the backend with the current user session and now uses a smaller, higher-level tool surface: board snapshot previews, full-board filtered reads, task search, create task, single-task edit, bulk task edit, complete a run with corrected timing, control task state, adjust active tally counts, control panic mode, and summarize the day from real stats data. New task creation still has a duplicate guard against close matches already sitting in `inactive` or `daymap`, and the assistant is expected to present a `1 / 2 / 3` choice instead of silently creating a duplicate. Tasks now also support an optional `nextDueAt` field that is still broadly assistant-managed, but the active done-confirmation modal can also set it for repeatable tasks. The board sort bars expose `Next` and `Last` buttons across the app.

## Current app status

- Public frontend routes:
  - `/`
  - `/demo-board`
  - `/auth`
  - `/privacy`
  - `/terms`
- Authenticated frontend routes:
  - `/inactive`
  - `/daymap`
  - `/active`
  - `/done`
  - `/stats`
  - `/add`
  - `/profile`
- Frontend rendering is client-only
- MongoDB is required for the backend runtime
- There is no automated test suite yet
- Account creation is gated by the prerelease alpha code and a required legal-acceptance checkbox
- `sms-bridge/` is still planning-only, not an implemented runtime service

## Repo layout

- `front/`: SvelteKit frontend
- `back/`: Fastify API and Mongo-backed business logic
- `db/`: scratch area, not a runtime surface
- `sms-bridge/`: design/spec area for a future SMS bridge service
- `AGENTS.md`: canonical handoff for future coding agents

## Environment source of truth

The repo now treats the root `.env` file as the canonical runtime env file for the current frontend and backend.

- tracked template: `.env.example`
- local runtime file: `.env`
- backend loads env from the root `.env`
- frontend Vite env loading points at the repo root, so `PUBLIC_*` vars also come from the root `.env`

If you are setting up a new machine, start by copying `.env.example` to `.env` and then replace placeholders as needed.

## Quick start

1. Start MongoDB on `127.0.0.1:27017`, or set `MONGO_URL` to another instance.
2. Create a root `.env` from `.env.example`.
3. Start the backend:
   - `cd back && npm install`
   - `npm run dev`
4. Start the frontend:
   - `cd front && npm install`
   - `npm run dev`
5. Open the Vite dev server in your browser.
6. If you are upgrading an older local database that still has legacy alarm fields on tasks:
   - `cd back && npm run migrate:pomodoro`

Creating an account currently requires alpha code `gyarados`.
Creating an account also requires agreeing to the current Privacy Policy and Terms & Conditions.

## Backend config

Backend defaults come from the root `.env`, with fallback defaults defined in `back/lib/config.js`:

- `HOST=127.0.0.1`
- `PORT=3001`
- `MONGO_URL=mongodb://127.0.0.1:27017`
- `MONGO_DB_NAME=task-monster`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-5.4-mini`
  - if blank or still set to `your_model_name_here`, the backend falls back to `gpt-5.4-mini`

Frontend API requests use `PUBLIC_API_BASE_URL` from the root `.env`, defaulting to `http://127.0.0.1:3001` if unset.

## Core runtime model

- Tasks are either `one-time` or `repeatable`
- Tasks track either by `time` or `tally`
- Time-tracked tasks now use stored pomodoro cadences:
  - `none`: no focus/break cycle; task still records active time and history
  - `short`: 15/5 with a 15-minute long break every 4 focus blocks
  - `medium`: 25/5 with a 20-minute long break every 4 focus blocks
  - `long`: 50/10 with a 30-minute long break every 3 focus blocks
- Time tasks also store a per-task break bell sound:
  - `glass`
  - `temple`
  - `arcade`
- Repeatable tasks can be `daymapLocked`, which sends them back to the daymap after `done`
- Active spans are recorded in `task_runs`
- Panic sessions are recorded in `panic_runs`
- Queueing is only for daymap tasks
- When the last active task leaves the table, the backend auto-activates the next queued daymap task if one exists
- Panic does not currently pause tasks automatically; it affects derived effective-time calculations instead

## Main API surface

Public routes:

- `GET /ping`
- `POST /users`
- `POST /sessions/login`

Public frontend routes:

- `/`
- `/demo-board`
  - public product tour page using real app screenshots
- `/auth`
- `/privacy`
- `/terms`

Auth/session routes:

- `GET /whoami`
- `GET /sessions`
- `DELETE /sessions/:sessionId`
- `POST /sessions/logout`
- `GET /login-attempts`

Assistant route:

- `POST /assistant/chat`
  - authenticated assistant route used by the header drawer
  - request body currently includes:
    - `messages`
    - `timezoneOffsetMinutes`
    - `currentPath`
  - the frontend only sends the most recent 12 conversation messages
  - the backend accepts a larger payload window, then sanitizes/trims to the most recent 12 user/assistant messages before calling OpenAI
  - each successful user/assistant turn is persisted in Mongo under the authenticated user account in `assistant_messages`
  - the drawer reloads from backend history instead of starting empty on page refresh
  - the backend now gives the model a higher-level domain tool surface instead of asking it to compose low-level route semantics
  - current v2 actions include:
    - board snapshot reads with exhaustive counts and preview-only task lists
    - full-board filtered reads for exact set checks
    - full-board task search with backend-side ranking
    - create tasks
    - edit a single task’s metadata, notes, pomodoro, bell sound, tally settings, and active started time
    - bulk-edit matching task sets for shared metadata cleanup like removing pomodoro from every inactive task
    - complete an active run or a historical daymap/inactive run with optional corrected `startedAt` / `completedAt`
    - activate, daymap, backlog, queue, unqueue, and archive control actions
    - adjust active tally counts
    - start or stop panic
    - summarize a local day from real stats
  - duplicate-task guard behavior:
    - create checks only `inactive` and `daymap` for close matches
    - if a close match exists, the assistant should stop and present options `1`, `2`, and `3`
    - option `3` is the explicit duplicate override path
  - board-read guard behavior:
    - `get_board_snapshot` counts are exhaustive, but its task lists are previews only
    - for “all inactive tasks”, “every daymap-locked task”, or similar full-set claims, the assistant should use `filter_tasks`
    - for status-wide cleanup, the assistant should use `bulk_edit_tasks` instead of looping many single-task edits
  - assistant time behavior:
    - `startedAt` / `completedAt` tool arguments are local user times, not UTC wall-clock guesses
    - the prompt includes the current local timezone offset, and backend normalization corrects accidental `Z` timestamps from the model
- `GET /assistant/history`
  - authenticated assistant history route used to hydrate the drawer on load
  - returns the latest persisted assistant/user messages in chronological order
  - the drawer currently asks for the latest 12, which guarantees at least the last 6 are present when enough history exists

Task routes:

- `POST /tasks`
- `GET /tasks/inactive`
- `GET /tasks/daymap`
- `GET /tasks/active`
- `GET /tasks/done`
- `POST /tasks/:taskId/daymap`
- `POST /tasks/:taskId/unmap`
- `POST /tasks/:taskId/queue`
- `POST /tasks/:taskId/unqueue`
- `POST /tasks/:taskId/activate`
- `POST /tasks/:taskId/inactivate`
- `POST /tasks/:taskId/done`
- `POST /tasks/:taskId/archive`
- `POST /tasks/:taskId/tally`
- `PATCH /tasks/:taskId/note`
- `PATCH /tasks/:taskId/instance-note`
- `PATCH /tasks/:taskId/daymap-lock`
- `PATCH /tasks/:taskId`
  - broad task edit route for metadata, bell sound, pomodoro, tracking type, tally fields, and active started time

Panic and stats routes:

- `GET /panic/status`
- `POST /panic/start`
- `POST /panic/stop`
- `GET /stats/daily`

## Useful docs

- `AGENTS.md`: agent-oriented handoff and current repo reality
- `front/README.md`: frontend-specific notes
- `back/README.md`: backend-specific notes
- `sms-bridge/README.md`: planning document for the future SMS assistant service
- `db/readme.md`: what the `db/` folder is and is not

## Verification

Current cheap smoke checks:

- `cd front && npm run build`
- boot the backend against a reachable Mongo instance
