# task-monster frontend

## Overview

The frontend is a client-rendered SvelteKit app that talks directly to the Fastify backend.

- `front/src/routes/+layout.js` sets `ssr = false`
- page components fetch real data from the backend from the browser
- the default API base is `http://127.0.0.1:3001`
- `PUBLIC_API_BASE_URL` is now read from the repo root `.env`
- Vite env loading is configured to use the repo root as `envDir`
- authenticated app pages expose icon-only top-nav controls for panic and profile; logout lives on the profile page

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build check: `npm run build`
- Preview build: `npm run preview`

## Environment

- canonical runtime env file: `../.env`
- tracked template: `../.env.example`
- frontend values should not be duplicated inside `front/`
- public browser-facing env vars must still use the `PUBLIC_` prefix
- `PUBLIC_FRONTEND_HOST` optionally allows one hostname in the Vite dev server; use a hostname without a scheme, such as `taskmonster.aurora-bailey.dev`

## Main routes

- `/`
  - minimalist public landing page with product positioning, signup/login CTA, and current screenshots
- `/auth`
  - login and account creation
- `/privacy`
  - public legal page
- `/terms`
  - public legal page
- `/tasks`
  - combined task board with Day Map above Inactive
  - one shared search/sort control filters both sections without moving tasks between sections
  - `/tasks?task=<taskId>` selects one exact task; `/tasks?search=<query>` restores ordinary text search
- `/inactive`
  - redirects to `/tasks`
- `/daymap`
  - redirects to `/tasks`
- `/active`
  - current active tasks
- `/done`
  - newest-to-oldest completed-task feed with infinite scroll
  - task titles deep-link to the exact source-task filter on `/tasks`
- `/stats`
  - real minute-map heatmap derived from backend task-run data
- `/add`
  - compact task creation and editing form; newly created tasks navigate to their exact `/tasks?task=<taskId>` filter
  - eight icon-only color categories remain on one row
  - type, tracking, Hue Shift, scheduling, and tally fields live in a collapsed Task Settings panel
  - `/add?edit=<taskId>` reloads an owned task and submits only changed fields
- `/profile`
  - active sessions and recent login attempts
- `/quick-actions`
  - shortcut-token management plus iOS Shortcuts and Apple Watch setup docs

## Important files

- `src/routes/+layout.svelte`
  - session boot gate and redirect logic
- `static/images/marketing/`
  - marketing visuals used by the public landing page
  - named `hero-*`, `add-*`, `mobile-*`, `home-*`, and `demo-*` PNG screenshots are the current source images for that page
- `src/lib/session.js`
  - token persistence, authorized requests, logout/revoke helpers
- `src/lib/api.js`
  - low-level fetch wrapper
- `src/lib/tasks-client.js`
  - task API wrapper
  - card updates persist through `updateTaskHueShift(taskId, hueShift)`
- `src/lib/hue-shift-colors.js`
  - canonical Hue Shift normalization, combined HSL adjustment, and split-fill helpers
  - exports `normalizeHueShift`, `getHueShiftOffset`, `getHueShiftColor`, and `buildHueShiftSplitFill`
- `src/lib/stats-client.js`
  - daily stats and heatmap API wrapper
- `src/lib/panic-client.js`
  - panic API wrapper and event dispatch
- `src/lib/quick-actions-client.js`
  - shortcut-token management API wrapper
- `src/lib/app-events.js`
  - app-wide refresh event dispatch used by account switching
- `src/lib/TaskCard.svelte`
  - shared card UI for inactive, daymap, active, and done variants
- `src/lib/theme.js`
  - theme definitions, theme grouping metadata, account-cache helpers, and DOM theme application
- `src/app.html`
  - applies the cached active account theme before Svelte boots to avoid a flash of the default skin
- `src/routes/layout.css`
  - root theme tokens and shared themed surfaces
- `src/routes/Header.svelte`
  - top nav, panic control, theme-colored account switcher, and arrow-key page navigation
- `static/sw.js`
  - production PWA service worker; dev hosts clear Task Monster caches and unregister instead of serving cached app files
- `static/manifest.webmanifest`
  - install metadata with relative URLs so Pages base paths continue to work

## Current UI behavior

- `/tasks` uses compact cards and can fit up to three cards per row on desktop
- Inactive task cards expose icon actions for moving to daymap, activating directly, editing through `/add?edit=<taskId>`, and archiving
- Account creation on `/auth` now requires:
  - prerelease alpha code
  - password confirmation
  - checking agreement to the Privacy Policy and Terms & Conditions
- The profile page exposes the theme engine grouped into Light and Dark sections
  - the selected theme is saved to the backend user record through `PATCH /users/theme`
  - `task_monster_theme` and stored account metadata are only local boot caches for fast pre-Svelte rendering
  - the Security section links to `/quick-actions` for shortcut-token setup
- The header account switcher stores multiple local account sessions under `task_monster_session_accounts`
  - each saved account row renders with that account's cached theme
  - switching accounts verifies the stored token, applies that user's theme, and refreshes account-backed board data
  - `Add account` opens `/auth?addAccount=1` without logging out the active account
- Logout is available from the profile page instead of the global header controls
- Task notes autosave with a debounce in `TaskCard.svelte`
- Active-task instance notes also autosave with a debounce
- Repeatable task cards on `/tasks` expose compact seven-day buttons directly on the card for automatic Day Map scheduling
- Tasks scheduled for the current local weekday appear in Day Map automatically and are excluded from Inactive
- Weekday schedule toggles on `/tasks` hot-update the current board arrays instead of calling the full task loader, so the page does not flash through its loading state
- Daymap/inactive cards fade to 50% opacity after the task has been started once in the current local day
- Daymap task cards support activating, queueing, daymap locking, toggling manually mapped tasks back to inactive, and copying the original task id from the card footer
- The `/tasks` sort menu includes `Queue`
  - queued tasks rise to the top in queue-number order
  - unqueued tasks stay below them
- Task board pages share a right-side board control strip
  - search opens from a search icon, filters the loaded tasks, and clears/closes from the inline `x`
  - `/tasks` keeps exact and text filters in the URL so links, refresh, and browser navigation preserve them
  - sort opens from a sort icon into a dropdown with `Date`, `Color`, `A-Z`, `Next`, and `Last`
  - `Next` sorts by the optional `nextDueAt` timestamp, with undated tasks below dated ones
  - `Last` sorts by the most recent completed time
- Task cards always show a compact timing strip
  - left side: last done, themed from the secondary color
  - center: a tiny low-contrast arrow
  - right side: next due, themed from the primary color
  - visible labels are intentionally omitted; hover/title and aria text carry `Last done` and `Next due`
  - next due opens an inline local datetime editor on tasks, active, and done cards
- The add page keeps task notes visible while mode, tracking type, Hue Shift, auto-daymap weekdays, and tally fields live in a collapsed Task Settings panel
  - Hue Shift accepts `0`–`100`: `0` applies `−10` to hue, saturation, and lightness; `50` preserves the exact category color; and `100` applies `+10`
  - hue uses degrees, saturation and lightness use absolute percentage points, and saturation/lightness clamp to `0%`–`100%`
  - the selected-category helper and range track preview the shifted color
  - the readout exposes the shared hue, saturation, and lightness offset
  - task create/update requests and responses use `hueShift`; the legacy `intensity` interface is not accepted or returned
  - backend startup migrates legacy stored `intensity` values to `hueShift`, defaults invalid or missing values to `50`, and removes the old field
  - task colors include Anima/Pink for soul-healing and divine-feminine activities
  - all eight color categories render as one icon-only row with accessible labels and a selected-category helper
  - successful creates navigate to the new task's exact filter; successful edits return to `/tasks`; validation or API failures preserve the entered form
  - edit mode uses `GET /tasks/:taskId`, labels the page and button Update, keeps changes local, and patches only changed fields
  - submitting an unchanged edit performs no update request and returns to `/tasks`
- Active tasks support:
  - inactivate
  - done
  - inline start and end datetime editing on each active task card
  - end time follows the current time until the user edits it, then Done uses the pinned card-local value
  - effective runtime for time tasks
  - tally increment/decrement for tally tasks
- The done page loads the 10 freshest completed runs first and uses an intersection observer to request older runs
  - each task title links to the source task's exact filter on `/tasks`
- The stats page loads 10 local days at a time from `GET /stats/heatmap`
  - the color legend includes Anima/Pink after Becoming/Violet
  - each day renders a 60 x 24 minute grid
  - midnight starts at the bottom and the day moves upward
  - overlapping tasks render as two- or three-way horizontal split cells
  - task cells, overlap segments, glows, and activity underlines use the fully opaque shifted task color
  - the header current-hour trace uses the same shifted color and split-fill logic
  - panic overlap is marked with a small red dot
  - each grid is followed by a muted dot-separated list of distinct task names worked that day
  - each task name/duration entry links to that task's exact filter on `/tasks`
  - scrolling near the bottom requests older day batches
- Authenticated app activity is synchronized through `src/lib/live-activity.js`
  - active tasks poll once every 30 seconds while the tab is visible and refresh immediately after focus, reconnect, account switch, or a same-tab task event
  - the header and stats page share one current-day heatmap snapshot refreshed at minute boundaries and when active activity changes
  - tasks, active, stats, and done reconcile shared snapshots without replacing loaded history, current sorting/filtering, or in-progress card edits
  - hidden tabs pause polling and stale responses from a previous account are ignored
- Panic mode is controlled from the top nav, not from the active page itself
- The quick actions page creates `tmq_live_*` tokens, lists active shortcut tokens, revokes them, and provides URLs, JSON bodies, curl examples, and iPhone/Apple Watch setup for all five shortcuts: stop, next, switching start, add task, and stop task
  - add task activates the task id copied from a Day Map card without ending other active tasks
  - stop task marks only the copied task id Done, leaves other active tasks running, and never advances the queue
  - setup examples display each response's `message` field and explain retry-safe targeted results
  - generated raw shortcut tokens are cached in localStorage on that browser so copy examples can include the real bearer token
- PWA behavior:
  - service worker registration is production-only
  - production navigation uses network-first fallback behavior
  - immutable app assets and static shell assets are cached
  - dev mode unregisters existing Task Monster service workers and clears `task-monster-pwa-*` caches to avoid stale local files
- Account switching dispatches `taskmonster:app-refresh`
  - active, tasks, done, stats, and the header trace listen for the refresh event where needed

Run focused live-state reconciliation tests from the repository root with `npm run test:front`.

## Data source notes

- The app no longer uses a filler homepage redirect
  - `/` is now a real minimalist public marketing page built around product screenshots
- The following routes are live app surfaces, not placeholder screens:
  - `/`
  - `/auth`
  - `/privacy`
  - `/terms`
  - `/tasks`
  - `/active`
  - `/done`
  - `/stats`
  - `/add`
  - `/profile`
  - `/quick-actions`
- `src/lib/task-catalog.js` is still filler/reference data only
- Old docs that described `/stats` as filler are no longer accurate
