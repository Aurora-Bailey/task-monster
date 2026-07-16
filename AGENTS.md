# Agent Handoff

This file is the canonical repo handoff for future agents. If behavior changes, update this file with the code.

## Repo shape

- `front/`: SvelteKit frontend
- `back/`: Fastify + MongoDB backend
- `db/`: scratch area, not part of the main runtime

## Run commands

The repo is an npm workspace (`front` + `back`); prefer the root commands.

- Required Node version: `^20.19.0 || >=22.12.0`
- Install both apps: `npm install` (repo root)
- Dev (both, concurrently): `npm run dev` — back on `:3001`, front on the Vite dev server
- Dev (backend only): `npm run dev:back`
- Dev (frontend only): `npm run dev:front`
- Frontend build check: `npm run build`
- Frontend lint: `npm run lint`
- Frontend live-state tests: `npm run test:front`
- Backend start: `npm run start`
- Backend integration tests: `TEST_MONGO_URL=<mongodb url> npm run test:back`
- Frontend GitHub Pages build check: `cd front && BASE_PATH=/task-monster PUBLIC_API_BASE_URL=https://taskmonster-api.aurora-bailey.dev npm run build`

Per-app commands (`cd front && npm run dev`, `cd back && npm run dev`, etc.) still work.

## Runtime and config

- Frontend is client-rendered only.
  - `front/src/routes/+layout.js` sets `ssr = false`
  - most route-level `+page.js` files explicitly set `csr = true`; the global layout keeps the app client-rendered even where a page has no route-level module
- Frontend production hosting is Cloudflare Tunnel at `taskmonster.aurora-bailey.dev`.
  - `.github/workflows/deploy-frontend.yml` can build and deploy `front/` from the `production` branch if needed
  - production frontend API calls point at `https://taskmonster-api.aurora-bailey.dev`
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
  - frontend SvelteKit config points `kit.env.dir` at the repo root for `$env/dynamic/public`
- `/` is now a minimalist public marketing landing page that uses current product screenshots
- Frontend API base URL comes from `PUBLIC_API_BASE_URL`
  - default: `http://127.0.0.1:3001`
- Frontend Vite dev-server tunnel access comes from `PUBLIC_FRONTEND_HOST`
  - use a hostname without a URL scheme, such as `taskmonster.aurora-bailey.dev`
- Backend config is in `back/lib/config.js`
  - `HOST` default: `127.0.0.1`
  - `PORT` default: `3001`
  - `MONGO_URL` default: `mongodb://127.0.0.1:27017`
  - `MONGO_DB_NAME` default: `task-monster`
- MongoDB is expected locally unless env vars override it

## Backend architecture

- Fastify entrypoint: `back/index.js`
- Shared backend internals live in `back/lib/`
- Route files are auto-registered from `back/routes/` by `back/lib/register-routes.js`
- Authentication is enforced by a global `preHandler` hook in `back/index.js`
- Mongo indexes are created on startup in `back/lib/mongo.js`
- idempotent task data migrations run before indexes, route registration, and normal traffic
  - `back/lib/task-migrations.js` migrates legacy `tasks.intensity` values to `tasks.hueShift`
  - valid integers are clamped to `0`–`100`, invalid or missing values default to `50`, and `intensity` is removed
- Main collections currently used:
  - `users`
  - `sessions`
  - `quick_action_tokens`
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
- `back/routes/users/create.js` currently hardcodes:
  - `PRERELEASE_ALPHA_CODE = 'gyarados'`
  - `LEGAL_DOCUMENTS_VERSION = '2026-06-16'`
- if the legal page content materially changes, bump `LEGAL_DOCUMENTS_VERSION`
- Session verification route:
  - `GET /whoami`
  - returns `id`, `username`, and `theme`
- Session management routes:
  - `GET /sessions`
  - `DELETE /sessions/:sessionId`
  - `POST /sessions/logout`
  - `GET /login-attempts`
- Shortcut token routes:
  - `GET /quick-tokens`
  - `POST /quick-tokens`
    - returns raw `tmq_live_*` shortcut tokens exactly once and stores only `tokenHash`
  - `DELETE /quick-tokens/:tokenId`
- User preference routes:
  - `PATCH /users/theme`
  - `PATCH /users/password`
    - requires the current password and a new password
    - updates the stored password hash and revokes all other active sessions for the user
- Security details:
  - passwords use salted `scrypt` in `back/lib/passwords.js`
  - auth tokens are generated raw once, but only SHA-256 token hashes are stored in Mongo
  - quick action tokens are generated raw once, but only SHA-256 token hashes and previews are stored in Mongo
  - the frontend may cache generated raw quick action tokens in localStorage for copy/paste shortcut examples
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
- Task color keys are `red`, `orange`, `gold`, `green`, `teal`, `blue`, `violet`, and `pink`; `pink` is the Anima category for soul-healing and divine-feminine activities
- Tasks store `hueShift` as an integer from `0` to `100`; missing or invalid values default to `50`
- Hue Shift applies one linear offset to the base category's HSL channels:
  - `0` is hue `−10°`, saturation `−10` percentage points, and lightness `−10` percentage points
  - `50` is the exact unchanged category color
  - `100` is hue `+10°`, saturation `+10` percentage points, and lightness `+10` percentage points
  - hue wraps around the color wheel; saturation and lightness clamp to `0%`–`100%`
- Repeatable tasks can store automatic daymap weekdays:
  - `tasks.daymapWeekdays`
  - integer values use JavaScript weekday numbering: `0` Sunday through `6` Saturday
  - `/tasks/daymap` and `/tasks/inactive` accept `tzOffsetMinutes` and derive today's local weekday from it
  - scheduled tasks are shown in Daymap automatically on matching weekdays even when `mappedToday !== true`
  - scheduled tasks are excluded from Inactive on matching weekdays
- Task responses can include local-day derived display flags:
  - `scheduledToday`
  - `startedToday`
  - `skippedToday`
- Task responses also include `lastStartedAt`; card fading uses `task_runs.startedAt` inside the current local day so overnight sleep tasks are attributed by start time
- Daily skips store the local day on `tasks.skippedLocalDay` and are presentation-only; they fade Daymap cards without creating a `task_runs` completion record
- Shared task validation and serialization live in `back/lib/tasks.js`
- Template-level task note:
  - stored on `tasks.note`
  - editable from tasks, active, and done views
- Per-run instance note:
  - stored on the open or closed `task_runs` record
  - editable only while active
- Exact active spans are recorded in `task_runs`
- quick-action task transitions use `tasks.quickActionTransition` as a recoverable per-task operation lock
- startup recovers interrupted quick transitions, reconciles orphaned or duplicate open runs, and enforces one open `task_runs` record per user/task with a partial unique index
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
- Load one owned task:
  - `GET /tasks/:taskId`
  - supports refresh-safe task editing from `/add?edit=<taskId>`
- Update task fields:
  - `PATCH /tasks/:taskId`
  - the Add page sends only changed fields while editing
- Move to daymap:
  - `POST /tasks/:taskId/daymap`
- Remove from daymap back to inactive:
  - `POST /tasks/:taskId/unmap`
- Pin or unpin daymap membership:
  - `PATCH /tasks/:taskId/daymap-pin`
  - pins set `mappedToday: true` and set `daymapLocked: true` for repeatable tasks
- Skip or unskip the current local day:
  - `PATCH /tasks/:taskId/day-skip`
  - updates `tasks.skippedLocalDay` without creating task history
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
- Quick action stop/next/start/add-task/stop-task routes:
  - `POST /api/quick/stop`
    - requires a `tmq_live_*` shortcut token with `tasks:stop`
    - marks all active tasks done for the token owner and starts nothing
    - closed runs use `endingReason: 'done'`
    - returns `message: "All active tasks marked done"`
  - `POST /api/quick/next`
    - requires a `tmq_live_*` shortcut token with `tasks:next`
    - marks all active tasks done for the token owner, then activates the first queued Daymap task
    - closed runs use `endingReason: 'done'`
    - returns `message: "Next Task: <title>"` when a queued task starts, otherwise `message: "No next task queued"`
  - `POST /api/quick/start`
    - accepts JSON body `{ "taskId": "<task id>" }`
    - requires `tasks:start`; legacy quick tokens with `tasks:next` are accepted for compatibility
    - marks other active tasks done for the token owner, then activates the requested task
    - closed runs use `endingReason: 'done'`
    - returns `message: "<title> active"`
  - `POST /api/quick/add-task`
    - accepts required `taskId` plus optional `source` and `action` string metadata
    - requires `tasks:start`; legacy quick tokens with `tasks:next` are accepted for compatibility
    - activates the requested inactive, Daymap, scheduled, or queued task without ending any other active task
    - already-active retries return success without creating a duplicate open run
    - returns `message: "<title> active"`
  - `POST /api/quick/stop-task`
    - accepts required `taskId` plus optional `source` and `action` string metadata
    - requires `tasks:stop`
    - marks only the selected active task done, applying the same tally, repeatable pin, and one-time archival behavior as quick stop
    - leaves other active tasks untouched and never starts a queued task
    - active transitions return `stoppedCount: 1`; inactive or archived retries return `stoppedCount: 0` without creating history
    - returns `message: "<title> marked done"` or `message: "<title> already stopped"`
  - targeted actions return `400 invalid_task_id` for malformed ids and `404 task_not_found` for missing or foreign-owned tasks
  - quick actions append `-- Ended with shortcut` to the bottom of each run they complete
  - quick routes derive `userId` from the token record, not from request input
- Daymap lock route:
  - `PATCH /tasks/:taskId/daymap-lock`
- Daymap lock is mainly meaningful for repeatable tasks because it controls whether `done` loops them back to the daymap
- The `/tasks` UI now treats the star as the daymap pin control; the separate lock button is no longer shown there

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
  - `PATCH /tasks/done-runs/:runId` updates a completed run's `startedAt` and `endedAt`
  - `DELETE /tasks/done-runs/:runId` erases a completed run from history and stats; erasing the last done run for an archived one-time task restores it to Inactive
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
  - each day grid is followed by a muted, dot-separated list of the distinct task names worked during that local day
  - loads 10 days at a time and infinite-scrolls older days

## Frontend architecture

- Auth gate and boot splash:
  - `front/src/routes/+layout.svelte`
  - public routes are currently `/`, `/auth`, `/privacy`, and `/terms`
  - protected routes still wait for session initialization before redirecting guests
- Marketing visuals used by the public landing page live in:
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
- App-wide refresh events:
  - `front/src/lib/app-events.js`
  - account switching dispatches `taskmonster:app-refresh`
- Shared live activity synchronization:
  - `front/src/lib/live-activity.js`
  - starts from the authenticated app shell and polls active tasks every 30 seconds while the tab is visible
  - refreshes immediately on focus, reconnect, account switch, and same-tab task/panic events
  - owns the shared current-day heatmap snapshot used by the header and stats page, refreshing it at minute boundaries and after activity changes
  - pauses polling in hidden tabs, prevents overlapping requests, and rejects responses from an earlier account generation
  - `/tasks`, `/active`, `/stats`, and `/done` reconcile shared snapshots while preserving active edits, loaded history, and page position
- Shared task card:
  - `front/src/lib/TaskCard.svelte`
- Shared sort control:
  - `front/src/lib/TaskSortBar.svelte`
- Top nav and utility controls:
  - `front/src/routes/Header.svelte`
  - owns icon-only top-nav panic controls
  - owns the theme-colored account switcher dropdown
  - owns the current-hour activity trace under the header

## Main frontend routes

- `/`
  - minimalist public landing page with marketing copy, signup/login CTA, and real product screenshots
- `/auth`
  - login and account creation
- `/privacy`
  - public legal page, accessible without authentication
- `/terms`
  - public legal page, accessible without authentication
- `/tasks`
  - combined task board with a Day Map section above an Inactive section
  - one shared search/sort control filters both sections, but tasks stay in their section
  - `/tasks?task=<taskId>` selects exactly one owned task by id
  - `/tasks?search=<query>` restores ordinary board text search
  - exact links to archived or otherwise absent tasks resolve to an unavailable explanation
- `/inactive`
  - redirects to `/tasks`
- `/daymap`
  - redirects to `/tasks`
- `/active`
  - current active tasks
- `/done`
  - completed-task history as a newest-to-oldest infinite feed
  - loaded done cards are grouped under chronological day dividers in the feed
  - done cards expose start/end datetime editors that save when the field loses focus, plus an erase button for the completed run
  - done card titles link to the source task's exact `/tasks?task=<taskId>` filter
- `/stats`
  - real minute-map stats from backend heatmap batches
- `/add`
  - task creation and inactive-task editing form
  - successful task creation navigates to `/tasks?task=<createdTaskId>`; failed saves preserve the entered form
  - task colors are eight icon-only category controls on one row with the selected category description below
  - task notes are always visible on the form; there is no notes checkbox gate
  - Task Type, tracking mode, Hue Shift, Auto Daymap weekdays, and tally configuration live in a collapsed `Task settings` disclosure below notes
  - Add defaults remain Repeatable and Time; invalid tally settings open the disclosure and are rejected before an API request
  - `/add?edit=<taskId>` loads an owned task, changes the heading and submit label to Update, and keeps edits local until submission
  - unchanged edit submissions return to `/tasks` without sending a patch
- `/profile`
  - active sessions plus recent login attempt history

## Current UI behavior worth knowing

- `/` is a minimalist public landing page, not a redirect anymore
- `/tasks` uses compact task cards to fit up to three cards per row on desktop
- `/tasks`, `/active`, and `/done` task cards expose a shared left-edge Hue Shift slider from `TaskCard.svelte` that persists on release; the thumb is a plain theme-colored circle
- shared hue-shift color functions live in `front/src/lib/hue-shift-colors.js`
  - `normalizeHueShift`, `getHueShiftOffset`, `getHueShiftColor`, and `buildHueShiftSplitFill` are the canonical frontend interfaces
  - task cards use the shifted color as `--task-accent`, including borders, controls, accent bars, and derived gradients
- `/stats` and the header current-hour trace receive task `hueShift` from `GET /stats/heatmap`
  - cells, overlap segments, glows, and stats activity underlines use the same fully opaque shifted task color
  - the category legend stays on the base category colors
  - panic overlap is marked with a small solid red dot in the top-right of each affected cell
- The header and `/stats` consume the same live current-day heatmap snapshot; `/stats` replaces only today while retaining its previously loaded historical batches
- The task activity row under each `/stats` day grid underlines each task in its task color and shows its day-clipped active duration as a compact minute label
  - each task name/duration entry links to that task's exact `/tasks?task=<taskId>` filter
- Repeatable cards on `/tasks` expose compact seven-day buttons directly on the card for automatic Daymap scheduling
- `/tasks` updates weekday schedule toggles in place instead of reloading the whole board; the card is moved between Day Map and Inactive only when today's local weekday membership changes
- Cards in Daymap/Inactive fade to 50% opacity once the task has a run started during the current local day or has been skipped for the current local day
- Inactive cards expose icon actions:
  - star pins the task to daymap
  - play activates directly
  - wrench opens `/add?edit=<taskId>` for local form editing
  - archive hides inactive tasks
- Account creation on `/auth` now requires:
  - alpha code entry
  - password confirmation
  - checking agreement to the Privacy Policy and Terms & Conditions
- Task note autosave is debounced in `TaskCard.svelte`
- Active-task instance note autosave is also debounced in `TaskCard.svelte`
- task note saves and active instance note saves merge independently in the frontend because the task note lives on `tasks` while the instance note lives on the open `task_runs` record
- Daymap cards expose:
  - activate through a play icon
  - queue or unqueue
  - star toggles the daymap pin; for repeatable tasks, starring also makes done loop them back to Daymap until unstarred
  - skip today through a calendar-x icon, which fades the card without marking it done
  - a tiny pill icon at the bottom-right that copies the original task id and briefly shows a copied state
  - scheduled-only cards use the weekday buttons to remove today's automatic Daymap membership
  - the shared `/tasks` sort menu includes `Queue`, which floats queued daymap tasks to the top in queue-number order
- Task board pages now expose a shared right-side board control strip
  - search opens from a search icon, filters the loaded task list, and can be cleared with the inline `x`
  - `/tasks` keeps exact and text filters in the URL; editing an exact filter converts it to ordinary text search
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
  - a compact inline start datetime editor on each active task card
  - start defaults to the activation time and saves to the active task run when the field loses focus
  - Done completes active tasks at the current time; end-time corrections live on `/done`
- Header supports left and right arrow-key navigation across the main board pages when focus is not inside an input
- The top nav exposes an icon-only `Panic` control plus a theme-colored account switcher
  - the account switcher lists stored accounts with initial/name rows rendered in each account's saved theme
  - `Add account` opens `/auth?addAccount=1` without logging out the current account
  - `Settings for <user>` opens `/profile`
  - switching accounts verifies the stored token, makes it active, applies that user's theme, and refreshes account-backed board data
  - account switching dispatches `taskmonster:app-refresh`
  - active/tasks/done/stats listen for that event and reload as needed
- Panic controls live in the top nav, not on the active page itself

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
  - repeatable tasks can choose automatic Daymap weekdays from the collapsed Task Settings panel
  - edit mode loads through `GET /tasks/:taskId` and saves changed fields through `PATCH /tasks/:taskId`
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

- Backend quick-action concurrency has a Mongo-backed integration regression test in `back/test/quick-actions.integration.test.js`
  - it only runs when `TEST_MONGO_URL` is explicitly supplied and uses a disposable database name
- Frontend live snapshot fingerprinting and edit-preserving reconciliation are covered by `front/test/live-activity-state.test.js`
- Cheap smoke checks that match current workflow:
  - `npm run lint`
  - `npm run build`
  - `cd front && BASE_PATH=/task-monster PUBLIC_API_BASE_URL=https://taskmonster-api.aurora-bailey.dev npm run build`
  - boot the backend against a reachable Mongo instance
- `db/` should not be treated as the source of truth for runtime behavior
- If docs and code disagree, prefer the code and then update this file
