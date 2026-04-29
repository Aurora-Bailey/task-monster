# task-monster backend

## Overview

The backend is a Fastify server backed by MongoDB. It owns the real business logic for:

- auth and session validation
- task creation and task-state transitions
- active run tracking in `task_runs`
- panic logging in `panic_runs`
- done history and daily stats
- authenticated assistant actions through `POST /assistant/chat`

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Start: `npm start`

## Config

The backend now treats the repo root `.env` as the canonical env source.

- canonical runtime env file: `../.env`
- tracked template: `../.env.example`
- backend-local env files are no longer the source of truth

At startup, the backend loads the root `.env` and then reads from `process.env` in `lib/config.js`.

- `HOST`
  - default: `127.0.0.1`
- `PORT`
  - default: `3001`
- `MONGO_URL`
  - default: `mongodb://127.0.0.1:27017`
- `MONGO_DB_NAME`
  - default: `task-monster`
- `OPENAI_API_KEY`
  - required for the authenticated in-app assistant
- `OPENAI_MODEL`
  - default: `gpt-5.4-mini`
  - if blank or left as `your_model_name_here`, `lib/config.js` falls back to `gpt-5.4-mini`

## Structure

- `index.js`
  - builds the Fastify app, connects to Mongo, installs hooks, and registers routes
- `lib/`
  - shared logic
- `lib/assistant.js`
  - assistant prompt, tool definitions, task matching, and OpenAI chat loop
- `routes/`
  - one file per route, auto-registered recursively

## Main collections

- `users`
- `sessions`
- `login_attempts`
- `login_events`
- `tasks`
- `task_runs`
- `panic_runs`

Indexes are created on startup in `lib/mongo.js`.

## Auth and sessions

- Most routes require `Authorization: Bearer <token>`
- Public exceptions:
  - `GET /ping`
  - `POST /users`
  - `POST /sessions/login`
- Assistant route:
  - `POST /assistant/chat`
  - requires a normal bearer token
  - executes tool actions under the authenticated user
- Passwords are hashed with salted `scrypt`
- Session tokens are not stored raw
  - only SHA-256 token hashes are stored
- Account creation currently requires alpha code `gyarados`
- Account creation also requires `acceptedLegalTerms === true`
- New users currently store legal acceptance metadata on `users.legalAcceptance`:
  - `acceptedAt`
  - `version`
- if the legal pages materially change, bump `LEGAL_DOCUMENTS_VERSION` in `routes/users/create.js`
- Failed login attempts are rate-limited and written to `login_attempts`
- Login outcomes are written to `login_events`

## Task model

Tasks support:

- modes:
  - `one-time`
  - `repeatable`
- tracking types:
  - `time`
  - `tally`

Important task-state fields:

- `mappedToday`
- `activeToday`
- `queuePosition`
- `daymapLocked`
- `activatedAt`
- `pomodoro`
- `bellSound`
- `activeTallyCount`

Notes:

- `tasks.note` is the template-level task note
- `task_runs.instanceNote` is the per-run note

## Task lifecycle

- Create:
  - `POST /tasks`
- Move to daymap:
  - `POST /tasks/:taskId/daymap`
- Remove from daymap:
  - `POST /tasks/:taskId/unmap`
- Queue:
  - `POST /tasks/:taskId/queue`
- Unqueue:
  - `POST /tasks/:taskId/unqueue`
- Activate:
  - `POST /tasks/:taskId/activate`
  - opens a `task_runs` record
- Inactivate:
  - `POST /tasks/:taskId/inactivate`
  - closes the open run as `inactive`
- Done:
  - `POST /tasks/:taskId/done`
  - closes the open run as `done`
- Archive:
  - `POST /tasks/:taskId/archive`
  - only valid for inactive tasks

Done semantics:

- one-time tasks archive immediately
- repeatable tasks return to inactive unless `daymapLocked === true`
- repeatable locked tasks return to daymap after done

Queue semantics:

- only daymap tasks can be queued
- queue order uses `queuePosition`
- when the last active task is removed by `done` or `inactivate`, the backend auto-activates the next queued daymap task if one exists
- if older task docs still carry legacy alarm fields, normalize them with:
  - `npm run migrate:pomodoro`

## Active runtime behavior

- Active list route:
  - `GET /tasks/active`
- Time tasks use stored pomodoro cadence:
  - `none`: no focus/break cycle
  - `short`: 15/5 with a 15-minute long break every 4 focus blocks
  - `medium`: 25/5 with a 20-minute long break every 4 focus blocks
  - `long`: 50/10 with a 30-minute long break every 3 focus blocks
- Time tasks also store a bell sound:
  - `glass`
  - `temple`
  - `arcade`
- Break behavior:
  - focus phase is silent
  - break phase rings a short bell every minute on the frontend
- Tally updates:
  - `POST /tasks/:taskId/tally`
- Task note updates:
  - `PATCH /tasks/:taskId/note`
- Active run instance note updates:
  - `PATCH /tasks/:taskId/instance-note`
- Broad task edits:
  - `PATCH /tasks/:taskId`
  - supports metadata edits, bell sound, pomodoro, tracking type, tally fields, and active started-time changes

The active list derives and returns:

- `panicMilliseconds`
- `effectiveMilliseconds`
- `taskPanicLog`

## Panic

- Routes:
  - `GET /panic/status`
  - `POST /panic/start`
  - `POST /panic/stop`
- Panic logs are stored in `panic_runs`
- Panic mode does not currently pause tasks automatically
- Instead, panic overlap is subtracted from effective task time in active, done, and stats responses

## History and stats

- Done history:
  - `GET /tasks/done`
- Daily stats:
  - `GET /stats/daily`

Both are local-day aware through `day` and `tzOffsetMinutes`.

Daily stats are derived from:

- `task_runs`
- `panic_runs`

Current stats output includes:

- summary
- overlap bands
- task breakdown
- hourly cadence
- panic log
- done log
- session log

## Assistant scope

The current in-app assistant can:

- take a broad board snapshot with backend-owned grouping and exhaustive counts
- inspect exact full-board task sets through backend-owned filters
- search tasks across the full board with backend-owned ranking
- summarize a selected local day from real stats
- create tasks
- edit task metadata, note fields, bell sound, pomodoro, tally settings, daymap lock, and active started time
- bulk-edit shared metadata across a matched task set
- complete an active run with corrected `startedAt` / `completedAt` and optional `instanceNote`
- control activate/daymap/inactive/queue/archive semantics through a single high-level task-control tool
- update active tally counts
- start or stop panic mode through one unified tool

Assistant request model:

- route: `POST /assistant/chat`
- body fields:
  - `messages`
  - `timezoneOffsetMinutes`
  - `currentPath`
- request validation currently allows up to 64 inbound messages
- the backend then sanitizes and trims to the most recent 12 `user` / `assistant` messages before calling OpenAI
- there is no server-side conversation persistence
  - the drawer owns the visible thread state in the browser
- the backend currently uses the Chat Completions API shape, not the Responses API
- legacy task docs can be normalized with:
  - `npm run migrate:pomodoro`

Assistant prompt policy:

- use tools for all task-specific facts and all mutations
- do not guess task state or stats
- always send tool arguments as a JSON object
- broad board reads should use `get_board_snapshot`
- the task arrays in `get_board_snapshot` are previews only; its counts are exhaustive
- full-set checks should use `filter_tasks`
- status-wide cleanup should use `bulk_edit_tasks` instead of manual pagination or long single-task edit loops
- broad task lookup should use `search_tasks` instead of pagination loops
- timing corrections should be passed as tool arguments, not approximated with notes
- ambiguous requests should get a short clarification question
- `"pause"` or `"take it off active"` should resolve toward daymap
- `"inactive"` or `"backlog"` should resolve toward fully unmapping back to inactive
- replies are encouraged to use markdown when structured output helps
- raw millisecond values should usually be converted into human-readable durations
- the current voice target is calm, sharp, concise, and slightly futuristic

Assistant UI/runtime coupling:

- the frontend only sends the most recent 12 messages on each request
- the current drawer has no durable history store
- `currentPath` is included so the system prompt knows which page the user is viewing

Assistant create-task guard:

- before creating a task, the backend checks for close matches already in `inactive` or `daymap`
- if it finds one, `create_task` returns a guarded `requiresChoice` payload instead of mutating state
- when that happens, the backend chat loop immediately asks the model for a no-tools follow-up response so the user gets the `1 / 2 / 3` choice instead of a raw tool blob
- the assistant should then offer:
  - `1.` reuse the existing task
  - `2.` create a clearer, more specific version
  - `3.` create the exact requested task anyway
- exact duplicate creation now requires the tool argument `allowDuplicate: true`, which should only be used after the user explicitly chooses option `3`
- the current matcher intentionally guards more aggressively on exact, prefix, and strong token matches than on loose one-word substring overlap
- because there is no durable server-side chat state, a bare follow-up `1`, `2`, or `3` only works while the relevant prior assistant choice is still present in the drawer conversation history

## Current quirk

Fastify/Ajv currently emits strict-mode warnings at startup for schemas that use `type: ['integer', 'string']` around `tzOffsetMinutes`. The app still boots.

## Verification

- there is no automated test suite yet
- current cheap smoke check is booting the server against a reachable Mongo instance
