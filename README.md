# task-monster

Task Monster is a SvelteKit + Fastify + MongoDB task board built around a concrete daily flow:

- `inactive`: backlog tasks not selected for today yet
- `daymap`: tasks chosen for today but not active yet
- `active`: tasks currently on the table
- `done`: completed run history
- `stats`: daily stats derived from task runs and panic runs

It also supports timed tasks, tally tasks, session management, and a `panic` overlay that records off-the-rails time and subtracts it from effective task time.

Authenticated app pages now also expose an AI assistant drawer in the header. It talks to the backend with the current user session and can inspect the board, create tasks, rename tasks, move tasks across board states, update notes, queue/daymap-lock tasks, snooze alarms, adjust tally counts, control panic mode, and summarize the day from real stats data. New task creation now has a duplicate guard against close matches already sitting in `inactive` or `daymap`, and the assistant is expected to present a `1 / 2 / 3` choice instead of silently creating a duplicate.

## Current app status

- Frontend routes currently exposed:
  - `/`
  - `/demo-board`
  - `/auth`
  - `/privacy`
  - `/terms`
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

## Repo layout

- `front/`: SvelteKit frontend
- `back/`: Fastify API and Mongo-backed business logic
- `db/`: scratch area, not a runtime surface
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

Frontend API requests use `PUBLIC_API_BASE_URL` from the root `.env`, defaulting to `http://127.0.0.1:3001` if unset.

## Core runtime model

- Tasks are either `one-time` or `repeatable`
- Tasks track either by `time` or `tally`
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
  - current v1 actions include:
    - list/search tasks
    - create tasks
    - rename tasks
    - update task note or active instance note
    - move tasks between inactive/daymap/active/done/archive semantics
    - queue or unqueue daymap tasks
    - toggle daymap lock
    - update tally counts
    - snooze alarms
    - start or stop panic
    - summarize a local day from real stats

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
- `POST /tasks/:taskId/snooze`
- `POST /tasks/:taskId/tally`
- `PATCH /tasks/:taskId/note`
- `PATCH /tasks/:taskId/instance-note`
- `PATCH /tasks/:taskId/daymap-lock`

Panic and stats routes:

- `GET /panic/status`
- `POST /panic/start`
- `POST /panic/stop`
- `GET /stats/daily`

## Useful docs

- `AGENTS.md`: agent-oriented handoff and current repo reality
- `front/README.md`: frontend-specific notes
- `back/README.md`: backend-specific notes
- `db/readme.md`: what the `db/` folder is and is not

## Verification

Current cheap smoke checks:

- `cd front && npm run build`
- boot the backend against a reachable Mongo instance
