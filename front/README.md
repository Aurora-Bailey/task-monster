# task-monster frontend

## Overview

The frontend is a client-rendered SvelteKit app that talks directly to the Fastify backend.

- `front/src/routes/+layout.js` sets `ssr = false`
- page components fetch real data from the backend from the browser
- the default API base is `http://127.0.0.1:3001`
- `PUBLIC_API_BASE_URL` is now read from the repo root `.env`
- Vite env loading is configured to use the repo root as `envDir`

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
  - public product tour using real app screenshots
- `/auth`
  - login and account creation
- `/privacy`
  - public legal page
- `/terms`
  - public legal page
- `/inactive`
  - backlog tasks not selected for today yet
- `/daymap`
  - tasks selected for today but not active yet
- `/active`
  - current active tasks
- `/done`
  - real completion history by local day
- `/stats`
  - real daily stats derived from backend data
- `/add`
  - task creation form
- `/profile`
  - active sessions and recent login attempts

## Important files

- `src/routes/+layout.svelte`
  - session boot gate and redirect logic
- `static/images/marketing/`
  - screenshots used by the public landing page and `/demo-board`
- `src/lib/session.js`
  - token persistence, authorized requests, logout/revoke helpers
- `src/lib/api.js`
  - low-level fetch wrapper
- `src/lib/tasks-client.js`
  - task API wrapper
- `src/lib/stats-client.js`
  - stats API wrapper
- `src/lib/panic-client.js`
  - panic API wrapper and event dispatch
- `src/lib/TaskCard.svelte`
  - shared card UI for inactive, daymap, active, and done variants
- `src/routes/Header.svelte`
  - top nav, panic control, logout, and arrow-key page navigation

## Current UI behavior

- Inactive cards use the full card as the action target
  - clicking the card moves the task to daymap
- Account creation on `/auth` now requires:
  - prerelease alpha code
  - password confirmation
  - checking agreement to the Privacy Policy and Terms & Conditions
- Task notes autosave with a debounce in `TaskCard.svelte`
- Active-task instance notes also autosave with a debounce
- Daymap cards support queueing and daymap locking
- Active tasks support:
  - inactivate
  - done
  - snooze for timed tasks
  - tally increment/decrement for tally tasks
- Marking a task done from `/active` opens a modal that can:
  - adjust the run start time
  - adjust the completion time
  - attach an instance note
- Active alarms use browser audio
  - some browsers require user interaction before audio can play
- Panic mode is controlled from the header, not from the active page itself

## Data source notes

- The app no longer uses a filler homepage redirect
  - `/` is now a real public marketing page
- The simulated board preview was split out of the homepage hero
  - `/demo-board` now carries the public screenshot-led product tour
- The following routes are live app surfaces, not placeholder screens:
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
- `src/lib/task-catalog.js` is still filler/reference data only
- Old docs that described `/stats` as filler are no longer accurate
