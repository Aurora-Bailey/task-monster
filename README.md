# task-monster

Task Monster is a SvelteKit + Fastify + MongoDB task board built around a concrete daily flow:

- `inactive`: backlog tasks not selected for today yet
- `daymap`: tasks chosen for today but not active yet
- `active`: tasks currently on the table
- `done`: completed run history
- `stats`: daily stats derived from task runs and panic runs

It also supports timed tasks, tally tasks, session management, and a `panic` overlay that records off-the-rails time and subtracts it from effective task time.

## Current app status

- Frontend pages are real and backend-driven:
  - `/auth`
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

## Quick start

1. Start MongoDB on `127.0.0.1:27017`, or set `MONGO_URL` to another instance.
2. Start the backend:
   - `cd back && npm install`
   - optional: copy values from `.env.example`
   - `npm run dev`
3. Start the frontend:
   - `cd front && npm install`
   - optional: set `PUBLIC_API_BASE_URL` if the API is not at `http://127.0.0.1:3001`
   - `npm run dev`
4. Open the Vite dev server in your browser.

Creating an account currently requires alpha code `gyarados`.

## Backend config

Backend defaults come from `back/lib/config.js`:

- `HOST=127.0.0.1`
- `PORT=3001`
- `MONGO_URL=mongodb://127.0.0.1:27017`
- `MONGO_DB_NAME=task-monster`

Frontend API requests use `PUBLIC_API_BASE_URL`, defaulting to `http://127.0.0.1:3001`.

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

Auth/session routes:

- `GET /whoami`
- `GET /sessions`
- `DELETE /sessions/:sessionId`
- `POST /sessions/logout`
- `GET /login-attempts`

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
