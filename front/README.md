# task-monster frontend

## Overview

The frontend is a client-rendered SvelteKit app that talks directly to the Fastify backend.

- `front/src/routes/+layout.js` sets `ssr = false`
- page components fetch real data from the backend from the browser
- the default API base is `http://127.0.0.1:3001`
- `PUBLIC_API_BASE_URL` is now read from the repo root `.env`
- Vite env loading is configured to use the repo root as `envDir`
- authenticated app pages expose icon-only top-nav controls for AI, panic, and profile; logout lives on the profile page

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

## Main routes

- `/`
  - public landing page with product positioning and signup/login CTA
- `/demo-board`
  - public product tour using marketing visuals and product-screen references
- `/auth`
  - login and account creation
- `/privacy`
  - public legal page
- `/terms`
  - public legal page
- `/tasks`
  - combined task board with Day Map above Inactive
  - one shared search/sort control filters both sections without moving tasks between sections
- `/inactive`
  - redirects to `/tasks`
- `/daymap`
  - redirects to `/tasks`
- `/active`
  - current active tasks
- `/done`
  - newest-to-oldest completed-task feed with infinite scroll
- `/stats`
  - real minute-map heatmap derived from backend task-run data
- `/add`
  - task creation form
- `/profile`
  - active sessions and recent login attempts

## Important files

- `src/routes/+layout.svelte`
  - session boot gate and redirect logic
- `static/images/marketing/`
  - marketing visuals used by the public landing page and `/demo-board`
- `src/lib/session.js`
  - token persistence, authorized requests, logout/revoke helpers
- `src/lib/api.js`
  - low-level fetch wrapper
- `src/lib/tasks-client.js`
  - task API wrapper
- `src/lib/stats-client.js`
  - daily stats and heatmap API wrapper
- `src/lib/panic-client.js`
  - panic API wrapper and event dispatch
- `src/lib/assistant-client.js`
  - assistant API wrapper and assistant-refresh event dispatch
- `src/lib/assistant-markdown.js`
  - local safe markdown renderer used by assistant replies
- `src/lib/AssistantDrawer.svelte`
  - right-side authenticated chat drawer with themed markdown response rendering
  - hydrates the latest persisted backend history slice when first opened after reload
- `src/lib/TaskCard.svelte`
  - shared card UI for inactive, daymap, active, and done variants
- `src/lib/theme.js`
  - theme definitions, theme grouping metadata, account-cache helpers, and DOM theme application
- `src/app.html`
  - applies the cached active account theme before Svelte boots to avoid a flash of the default skin
- `src/routes/layout.css`
  - root theme tokens and shared themed surfaces
- `src/routes/Header.svelte`
  - top nav, AI drawer trigger, panic control, theme-colored account switcher, and arrow-key page navigation
- `static/sw.js`
  - production PWA service worker; dev hosts clear Task Monster caches and unregister instead of serving cached app files
- `static/manifest.webmanifest`
  - install metadata with relative URLs so Pages base paths continue to work

## Current UI behavior

- `/tasks` uses compact cards and can fit up to three cards per row on desktop
- Inactive task cards expose icon actions for moving to daymap, activating directly, and archiving
- Account creation on `/auth` now requires:
  - prerelease alpha code
  - password confirmation
  - checking agreement to the Privacy Policy and Terms & Conditions
- The profile page exposes the theme engine grouped into Light and Dark sections
  - the selected theme is saved to the backend user record through `PATCH /users/theme`
  - `task_monster_theme` and stored account metadata are only local boot caches for fast pre-Svelte rendering
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
- Daymap task cards support activating, queueing, daymap locking, and toggling manually mapped tasks back to inactive
- The `/tasks` sort menu includes `Queue`
  - queued tasks rise to the top in queue-number order
  - unqueued tasks stay below them
- Task board pages share a right-side board control strip
  - search opens from a search icon, filters the loaded tasks, and clears/closes from the inline `x`
  - sort opens from a sort icon into a dropdown with `Date`, `Color`, `A-Z`, `Next`, and `Last`
  - `Next` sorts by the optional `nextDueAt` timestamp, with undated tasks below dated ones
  - `Last` sorts by the most recent completed time
- Task cards always show a compact timing strip
  - left side: last done, themed from the secondary color
  - center: a tiny low-contrast arrow
  - right side: next due, themed from the primary color
  - visible labels are intentionally omitted; hover/title and aria text carry `Last done` and `Next due`
  - next due opens an inline local datetime editor on tasks, active, and done cards
- The add page exposes task color, mode, tracking type, auto-daymap weekdays, tally fields, and always-visible task notes
- Active tasks support:
  - inactivate
  - done
  - elapsed and effective runtime for time tasks
  - tally increment/decrement for tally tasks
- Marking a task done from `/active` opens a modal that can:
  - edit the run start time directly with a local datetime input
  - edit the completion time directly with a local datetime input
  - attach an instance note
  - for repeatable tasks, optionally set `nextDueAt` with its own local datetime input
- The done page loads the 10 freshest completed runs first and uses an intersection observer to request older runs
- The stats page loads 10 local days at a time from `GET /stats/heatmap`
  - each day renders a 60 x 24 minute grid
  - midnight starts at the bottom and the day moves upward
  - overlapping tasks render as two- or three-way horizontal split cells
  - scrolling near the bottom requests older day batches
- Panic mode is controlled from the top nav, not from the active page itself
- PWA behavior:
  - service worker registration is production-only
  - production navigation uses network-first fallback behavior
  - immutable app assets and static shell assets are cached
  - dev mode unregisters existing Task Monster service workers and clears `task-monster-pwa-*` caches to avoid stale local files
- The header AI drawer talks to `POST /assistant/chat`
  - the key stays on the backend
  - the drawer also hydrates from `GET /assistant/history`
  - `Esc` opens the drawer and focuses the input
  - `Esc` closes it again
  - arrow-key page navigation is disabled while the drawer is open
  - the thread is bottom-scrolled and newest-message-oriented
  - replies are rendered through the local markdown renderer, not raw text
  - the drawer only sends the most recent 12 messages to the backend
  - successful turns are persisted on the backend, so reloading the page restores the latest stored thread slice
  - assistant-triggered task or panic changes dispatch `taskmonster:assistant-refresh`
  - active, tasks, done, and stats pages listen for that refresh event
- Assistant create behavior now has a duplicate guard
  - if the backend sees a close match already in `inactive` or `daymap`, the assistant should present a `1 / 2 / 3` choice instead of silently creating another task
  - that follow-up choice still depends on the relevant choice being present in the current 12-message working window
- The backend assistant surface is now higher-level and more domain-shaped
  - broad reads should come back through board snapshots, but those snapshot task arrays are preview-only
  - exact full-set checks should come back through backend-owned filtered reads
  - pasted checklist/TODO imports should use batch task creation instead of long chains of single task creates
  - status-wide cleanup where every task gets the same change should come back through backend-owned bulk edit actions
  - per-task mappings such as recoloring/classifying tasks by meaning should come back through targeted batch edits
  - task completion can now include corrected run timing in one assistant action, including historical completion of non-active tasks when both times are known
  - metadata edits still flow through the broad task edit route
  - `next due` is mostly AI-managed, but the active done modal can now set it for repeatable tasks directly

## Data source notes

- The app no longer uses a filler homepage redirect
  - `/` is now a real public marketing page
- The simulated board preview was split out of the homepage hero
  - `/demo-board` now carries the public product-screen tour
- The following routes are live app surfaces, not placeholder screens:
  - `/`
  - `/demo-board`
  - `/auth`
  - `/privacy`
  - `/terms`
  - `/tasks`
  - `/active`
  - `/done`
  - `/stats`
  - `/add`
  - `/profile`
- `src/lib/task-catalog.js` is still filler/reference data only
- Old docs that described `/stats` as filler are no longer accurate
