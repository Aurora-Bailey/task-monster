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
- Frontend GitHub Pages build check: `cd front && BASE_PATH=/task-monster PUBLIC_API_BASE_URL=https://task-monster-api.onrender.com npm run build`
- Backend install: `cd back && npm install`
- Backend dev: `cd back && npm run dev`
- Backend start: `cd back && npm start`

## Runtime and config

- Frontend is client-rendered only.
  - `front/src/routes/+layout.js` sets `ssr = false`
  - most route-level `+page.js` files explicitly set `csr = true`; the global layout keeps the app client-rendered even where a page has no route-level module
- Frontend production hosting is GitHub Pages.
  - `.github/workflows/deploy-frontend.yml` builds and deploys `front/` from the `production` branch
  - GitHub Pages serves the frontend under the repo base path, so production builds set `BASE_PATH=/${{ github.event.repository.name }}`
  - production frontend API calls point at Render backend `https://task-monster-api.onrender.com`
  - `front/svelte.config.js` uses `@sveltejs/adapter-static` with `fallback: '404.html'` for SPA route refreshes
- Frontend PWA support is manual static-file support.
  - app metadata lives in `front/static/manifest.webmanifest`
  - service worker lives in `front/static/sw.js`
  - install icons live in `front/static/icons/`
  - service worker registration happens from `front/src/routes/+layout.svelte` in production builds only
  - dev builds actively unregister Task Monster service workers and clear `task-monster-pwa-*` caches so local work is never served from the PWA cache
  - manifest URLs intentionally stay relative so the app works at both `/` and the GitHub Pages `/task-monster` base path
- Theme support is account-backed.
  - frontend theme definitions live in `front/src/lib/theme.js`
  - backend-valid theme ids live in `back/lib/themes.js` and should stay in sync with the frontend theme list
  - the selected theme key is stored on `users.theme`
  - `PATCH /users/theme` updates the authenticated user theme
  - `GET /whoami` and `POST /sessions/login` return the current user's theme
  - `localStorage` key `task_monster_theme` is now only a boot-time cache to avoid a theme flash before session verification
  - stored account session metadata in `task_monster_session_accounts` also caches each account theme for preboot rendering and the account switcher
  - `front/src/app.html` applies the cached active account theme before Svelte boots
  - `front/src/routes/profile/+page.svelte` exposes the theme picker grouped by light and dark themes
  - root theme tokens live in `front/src/routes/layout.css`
- Root `.env` is the env source of truth for the current frontend and backend runtime
  - tracked template: `.env.example`
  - backend loads `../.env` at startup
  - frontend Vite config points `envDir` at the repo root
  - frontend SvelteKit config points `kit.env.dir` at the repo root for `$env/static/public`
- `/` is now a minimalist public marketing landing page that uses current product screenshots
- `/demo-board` is also public and currently acts as a product-screen tour without requiring auth
- Frontend API base URL comes from `PUBLIC_API_BASE_URL`
  - default: `http://127.0.0.1:3001`
- Backend config is in `back/lib/config.js`
  - `HOST` default: `127.0.0.1`
  - `PORT` default: `3001`
  - `MONGO_URL` default: `mongodb://127.0.0.1:27017`
  - `MONGO_DB_NAME` default: `task-monster`
  - `OPENAI_MODEL` default: `gpt-5.4-mini`
    - if blank or still set to `your_model_name_here`, config falls back to `gpt-5.4-mini`
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
  - `assistant_messages`
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
- `back/routes/users/create.js` currently hardcodes:
  - `PRERELEASE_ALPHA_CODE = 'gyarados'`
  - `LEGAL_DOCUMENTS_VERSION = '2026-04-24'`
- if the legal page content materially changes, bump `LEGAL_DOCUMENTS_VERSION`
- Session verification route:
  - `GET /whoami`
  - returns `id`, `username`, and `theme`
- Assistant route:
  - `POST /assistant/chat`
  - runs authenticated tool actions under the current user
- Session management routes:
  - `GET /sessions`
  - `DELETE /sessions/:sessionId`
  - `POST /sessions/logout`
  - `GET /login-attempts`
- User preference routes:
  - `PATCH /users/theme`
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
- Repeatable tasks can store automatic daymap weekdays:
  - `tasks.daymapWeekdays`
  - integer values use JavaScript weekday numbering: `0` Sunday through `6` Saturday
  - `/tasks/daymap` and `/tasks/inactive` accept `tzOffsetMinutes` and derive today's local weekday from it
  - scheduled tasks are shown in Daymap automatically on matching weekdays even when `mappedToday !== true`
  - scheduled tasks are excluded from Inactive on matching weekdays
- Task responses can include local-day derived display flags:
  - `scheduledToday`
  - `startedToday`
- Task responses also include `lastStartedAt`; card fading uses `task_runs.startedAt` inside the current local day so overnight sleep tasks are attributed by start time
- Shared task validation and serialization live in `back/lib/tasks.js`
- Template-level task note:
  - stored on `tasks.note`
  - editable from tasks, active, and done views
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
  - not scheduled for the current local weekday
- Daymap:
  - `mappedToday: true`, or scheduled for the current local weekday
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
- Cancel active:
  - `POST /tasks/:taskId/cancel-active`
  - deletes the open run, restores the task to Daymap, and does not create started/abandoned history
- Done:
  - `POST /tasks/:taskId/done`
  - closes the open run with `endingReason: 'done'`
  - accepts optional `startedAt`, `completedAt`, `instanceNote`, and `nextDueAt`
  - inactive or daymap tasks can be historically completed only when both `startedAt` and `completedAt` are supplied
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
  - if scheduled for the current weekday, it still appears on Daymap through derived schedule membership

### Daymap and queue behavior

- Daymap list route:
  - `GET /tasks/daymap`
- Queue routes:
  - `POST /tasks/:taskId/queue`
  - `POST /tasks/:taskId/unqueue`
- Queue order uses `queuePosition`
- Queueing a scheduled-only Daymap task sets `mappedToday: true` before assigning `queuePosition`
- When the last active task is removed from the table by `done` or `inactivate`, the backend auto-activates the next queued daymap task if one exists
- Canceling an active task is treated as an undo and does not auto-activate the next queued task
- Daymap lock route:
  - `PATCH /tasks/:taskId/daymap-lock`
- Daymap lock is mainly meaningful for repeatable tasks because it controls whether `done` loops them back to the daymap

## Active-task behavior

- Active list route:
  - `GET /tasks/active`
- Time tasks record active runtime and history only
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
  - without a `day`, the `/done` page uses `limit` and `cursor` to infinite-scroll completed runs newest-to-oldest, 10 at a time
  - with a `day`, the route still returns that local day's completion history for compatibility
- Daily stats route:
  - `GET /stats/daily`
- Stats heatmap route:
  - `GET /stats/heatmap`
  - returns clipped task-run sessions for 10-day minute-map batches by default
- Done history and stats are real backend-derived features now
- Daily stats accepts local-day context via:
  - `day`
  - `tzOffsetMinutes`
- Heatmap stats accepts local-day batch context via:
  - `startDay`
  - `count`
  - `tzOffsetMinutes`
- Stats are derived from:
  - `task_runs`
  - `panic_runs`
- Current daily stats response includes:
  - summary cards
  - overlap bands
  - top task breakdown
  - hourly cadence
  - panic log
  - done log
  - full session log
- Current `/stats` page uses `GET /stats/heatmap`, not the old daily report UI.
  - renders one 60-by-24 minute grid per local day
  - each cell is one minute; active task spans color cells with the task color
  - midnight starts on the bottom row and the day moves upward
  - overlapping task colors are shown as two- or three-way horizontal split cells
  - loads 10 days at a time and infinite-scrolls older days

## Frontend architecture

- Auth gate and boot splash:
  - `front/src/routes/+layout.svelte`
  - public routes are currently `/`, `/demo-board`, `/auth`, `/privacy`, and `/terms`
  - protected routes still wait for session initialization before redirecting guests
- Marketing visuals used by the public landing/product-tour pages live in:
  - `front/static/images/marketing/`
  - named `hero-*`, `add-*`, `mobile-*`, `home-*`, and `demo-*` PNG screenshots are the current marketing-page source images
- Session storage and authorized fetch helpers:
  - `front/src/lib/session.js`
  - stores the active token under `task_monster_session_token`
  - stores switchable account sessions under `task_monster_session_accounts`
  - mirrors the active token to the legacy single-token cookie and each stored account token to a per-account cookie
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
  - restores the latest persisted backend history slice on first open after reload
- Shared task card:
  - `front/src/lib/TaskCard.svelte`
- Shared sort control:
  - `front/src/lib/TaskSortBar.svelte`
- Top nav and utility controls:
  - `front/src/routes/Header.svelte`
  - owns icon-only top-nav controls for AI and panic
  - owns the theme-colored account switcher dropdown
  - owns the current-hour activity trace under the header
  - owns the authenticated AI drawer trigger and drawer mount

## Main frontend routes

- `/`
  - minimalist public landing page with marketing copy, signup/login CTA, and real product screenshots
- `/demo-board`
  - public product-tour page using current Daymap, Active, Add, Stats, and Profile screenshots
- `/auth`
  - login and account creation
- `/privacy`
  - public legal page, accessible without authentication
- `/terms`
  - public legal page, accessible without authentication
- `/tasks`
  - combined task board with a Day Map section above an Inactive section
  - one shared search/sort control filters both sections, but tasks stay in their section
- `/inactive`
  - redirects to `/tasks`
- `/daymap`
  - redirects to `/tasks`
- `/active`
  - current active tasks
- `/done`
  - completed-task history as a newest-to-oldest infinite feed
- `/stats`
  - real minute-map stats from backend heatmap batches
- `/add`
  - task creation form
  - task notes are always visible on the form; there is no notes checkbox gate
- `/profile`
  - active sessions plus recent login attempt history

## Current UI behavior worth knowing

- `/` is a minimalist public landing page, not a redirect anymore
- `/demo-board` now holds the screenshot-based product tour that replaced the old simulated board demo
- `/tasks` uses compact task cards to fit up to three cards per row on desktop
- Repeatable cards on `/tasks` expose compact seven-day buttons directly on the card for automatic Daymap scheduling
- `/tasks` updates weekday schedule toggles in place instead of reloading the whole board; the card is moved between Day Map and Inactive only when today's local weekday membership changes
- Cards in Daymap/Inactive fade to 50% opacity once the task has a run started during the current local day
- Inactive cards expose icon actions:
  - star moves the task to daymap
  - play activates directly
  - archive hides inactive tasks
- Account creation on `/auth` now requires:
  - alpha code entry
  - password confirmation
  - checking agreement to the Privacy Policy and Terms & Conditions
- Task note autosave is debounced in `TaskCard.svelte`
- Active-task instance note autosave is also debounced in `TaskCard.svelte`
- Daymap cards expose:
  - activate through a play icon
  - queue or unqueue
  - daymap lock toggle
  - star toggle back to inactive for manually mapped tasks
  - scheduled-only cards use the weekday buttons to remove today's automatic Daymap membership
  - the shared `/tasks` sort menu includes `Queue`, which floats queued daymap tasks to the top in queue-number order
- Task board pages now expose a shared right-side board control strip
  - search opens from a search icon, filters the loaded task list, and can be cleared with the inline `x`
  - sort opens from a sort icon into a dropdown menu with `Date`, `Color`, `A-Z`, `Next`, and `Last`
  - `/tasks` also exposes `Queue`
  - `Next` sorts tasks with a `nextDueAt` first by soonest due time
  - `Last` sorts by the most recent completed time
- Task cards can now show:
  - `Next due`
  - `Last done`
  - both timing values are always visible as a compact one-line strip: last done on the left, a subtle arrow, next due on the right
  - visible labels stay out of the strip; hover/title and aria text carry the `Last done` and `Next due` context
  - clicking the visible `Next due` value opens an inline local datetime editor on tasks, active, and done pages
- Active page includes:
  - tally increment and decrement controls
  - cancel control that unstages an active task back to Daymap without logging an inactive run
  - done modal with direct local start and finish datetime editors
  - repeatable-task done flow can optionally set `nextDueAt` with its own direct datetime editor
- Header supports left and right arrow-key navigation across the main board pages when focus is not inside an input
- The top nav exposes icon-only `AI` and `Panic` controls plus a theme-colored account switcher
  - the account switcher lists stored accounts with initial/name rows rendered in each account's saved theme
  - `Add account` opens `/auth?addAccount=1` without logging out the current account
  - `Settings for <user>` opens `/profile`
  - switching accounts verifies the stored token, makes it active, applies that user's theme, and refreshes account-backed board data
  - it opens a right-side assistant drawer
  - `Esc` opens the drawer and focuses the input
  - pressing `Esc` again closes it
  - assistant replies are rendered through a local safe markdown renderer, not a third-party package
  - assistant-triggered changes dispatch `taskmonster:assistant-refresh`
  - active/tasks/done/stats listen for that event and reload as needed
  - arrow-key navigation is intentionally disabled while the drawer is open
  - the drawer only sends the most recent 12 messages to the backend on each request
  - the drawer hydrates from `GET /assistant/history`
- Panic controls live in the top nav, not on the active page itself

## In-app assistant

- The authenticated assistant is backend-mediated only; the OpenAI key stays on the server.
- Backend route:
  - `POST /assistant/chat`
- Request body currently includes:
  - `messages`
  - `timezoneOffsetMinutes`
  - `currentPath`
- Validation and history window:
  - route schema currently accepts up to 64 inbound messages
  - backend sanitization then trims to the most recent 12 `user` / `assistant` messages
  - each successful user + assistant turn is persisted in Mongo in `assistant_messages`
  - `GET /assistant/history` returns the latest persisted messages in chronological order
- Backend implementation:
  - `back/lib/assistant.js`
  - `back/lib/assistant-history.js`
  - currently uses the OpenAI Chat Completions API, not the Responses API
- Current v2 tool surface:
  - `get_board_snapshot`
    - broad board reads with exhaustive counts plus preview-only task lists
  - `filter_tasks`
    - full-board filtered reads when the user means every matching task, not just a preview slice
  - `search_tasks`
    - backend-ranked task search across the full board; this is preferred over making the model paginate broad lists
  - `get_day_summary`
    - real local-day stats read
  - `create_task`
    - still guarded against close duplicates in `inactive` and `daymap`
  - `create_tasks`
    - batch task creation for pasted checklists/TODO imports so the assistant does not loop single-task tool calls until it hits the tool-use limit
    - close duplicate matches are skipped and reported in the batch result unless duplicates were explicitly allowed
  - `edit_task`
    - metadata, note, next due, tally settings, daymap lock, and active `startedAt`
  - `edit_tasks`
    - targeted batch edits for many named tasks where each task may need a different color, mode, name, note, due date, or other metadata
  - `bulk_edit_tasks`
    - shared metadata cleanup across a matched task set
  - `complete_task_run`
    - marks an active task done, or records a historical daymap/inactive completion when both times are supplied, and can correct `startedAt`, `completedAt`, and `instanceNote` in one call
  - `control_task`
    - activate, move to daymap, move to inactive, queue, unqueue, or archive
  - `adjust_active_tally`
    - active tally increments/decrements
  - `set_panic_mode`
    - unified panic start/stop tool
- Current prompt/behavior policy:
  - tools are required for all task-specific facts and all mutations
  - the model is explicitly told to always send a JSON object for tool arguments
  - for broad reads it should call `get_board_snapshot` with `{"scope":"board"}`
  - board snapshot task arrays are previews only and must not be treated as exhaustive sections
  - for full-set checks like “all inactive tasks due this week” it should call `filter_tasks`
  - for pasted checklists, TODO imports, markdown checkbox lists, bullet lists, or “turn these into individual tasks” requests it should call `create_tasks` once instead of looping `create_task`
  - imported checklist items default to one-time inactive time tasks, with house/home/remodel/shopping lists defaulting to Home/gold unless the user says otherwise
  - imported checklist section headings such as Buy/Install/Build/Move/Remove should be folded into child task names so similar items remain distinct
  - for cleanup across a matched set where every task gets the exact same change set it should call `bulk_edit_tasks`
  - for targeted multi-task mappings like `Task A -> blue, Task B -> red`, or classification passes where each task can get a different target value, it should call `edit_tasks` instead of `bulk_edit_tasks` or repeated `edit_task`
  - for recolor/classification requests across all tasks, it should first call `filter_tasks` to read the full matching set, then call `edit_tasks` with the per-task target colors
  - `nextDueAt` is an optional task field that can be edited from task cards, set in the active done modal for repeatable tasks, and managed by assistant tools
  - for day summaries it should call `get_day_summary` with `{"scope":"day"}` and add an explicit `day` only when needed
  - ambiguous requests should trigger a short clarification instead of a guess
  - time-correction requests should be passed as actual tool arguments, not approximated with notes
  - for historical completion of non-active tasks, the assistant should pass both `startedAt` and `completedAt`
  - assistant time tool arguments are local user times, not UTC; the prompt includes the current local offset and backend normalization corrects accidental `Z` timestamps
  - `"pause"` and similar language should resolve toward daymap
  - `"inactive"` and `"backlog"` should resolve toward fully unmapping back to inactive
  - structured replies should use markdown when it helps
  - raw millisecond values should usually be converted into human-readable durations
  - the intended tone is calm, sharp, concise, and slightly futuristic
  - time tasks should be described in terms of active runtime and completion history
- Task creation guard:
  - `create_task` now checks for close existing matches in `inactive` and `daymap` before creating
  - if a close match exists, the backend returns `requiresChoice: true` with `errorCode: duplicate_task_guard`
  - when that happens, the backend immediately asks the model for a no-tools follow-up reply so the user sees a choice prompt instead of raw tool output
  - the assistant should present exactly three options:
    - `1.` reuse the closest existing task
    - `2.` create a clearer, more specific variant
    - `3.` create the exact requested task with `allowDuplicate: true`
  - a bare follow-up `1`, `2`, or `3` should be interpreted as selecting that last duplicate-task choice
  - that bare follow-up only works while the relevant prior choice is still present in the current 12-message working window sent back to the backend
  - current matching is intentionally stricter for single-word loose matches so things like `work` do not too eagerly collide with `homework`

## Filler vs real data

- Real backend-driven pages:
  - `/auth`
  - `/tasks`
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
  - repeatable tasks can choose automatic Daymap weekdays
- Active page:
  - `front/src/routes/active/+page.svelte`
- Tasks page:
  - `front/src/routes/tasks/+page.svelte`
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
  - `cd front && npm run lint`
  - `cd front && npm run build`
  - `cd front && BASE_PATH=/task-monster PUBLIC_API_BASE_URL=https://task-monster-api.onrender.com npm run build`
  - boot the backend against a reachable Mongo instance
- `db/` should not be treated as the source of truth for runtime behavior
- If docs and code disagree, prefer the code and then update this file
