# task-monster frontend

## Overview

The frontend is a client-rendered SvelteKit app that talks directly to the Fastify backend.

- `front/src/routes/+layout.js` sets `ssr = false`
- page components fetch real data from the backend from the browser
- the default API base is `http://127.0.0.1:3001`
- `PUBLIC_API_BASE_URL` is now read from the repo root `.env`
- Vite env loading is configured to use the repo root as `envDir`
- authenticated app pages now also expose a right-side AI drawer in the header

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
- `src/lib/assistant-client.js`
  - assistant API wrapper and assistant-refresh event dispatch
- `src/lib/assistant-markdown.js`
  - local safe markdown renderer used by assistant replies
- `src/lib/AssistantDrawer.svelte`
  - right-side authenticated chat drawer with themed markdown response rendering
  - local in-memory conversation state only; page reload clears the thread
- `src/lib/TaskCard.svelte`
  - shared card UI for inactive, daymap, active, and done variants
- `src/routes/Header.svelte`
  - top nav, panic control, AI drawer trigger, logout, and arrow-key page navigation

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
- The add page exposes pomodoro presets directly for time tasks
  - `none`: manual run with no focus/break bell
  - `short`: 15/5
  - `medium`: 25/5
  - `long`: 50/10
  - task notes are always visible on the form
- Active tasks support:
  - inactivate
  - done
  - pomodoro focus/break runtime for time tasks
  - tally increment/decrement for tally tasks
- Marking a task done from `/active` opens a modal that can:
  - adjust the run start time
  - adjust the completion time
  - attach an instance note
- Active pomodoro breaks use browser audio bells
  - focus is silent
  - breaks ring once per minute
  - some browsers require user interaction before audio can play
- Panic mode is controlled from the header, not from the active page itself
- The header AI drawer talks to `POST /assistant/chat`
  - the key stays on the backend
  - `Esc` opens the drawer and focuses the input
  - `Esc` closes it again
  - arrow-key page navigation is disabled while the drawer is open
  - the thread is bottom-scrolled and newest-message-oriented
  - replies are rendered through the local markdown renderer, not raw text
  - the drawer only sends the most recent 12 messages to the backend
  - there is no durable history store; reloading the page clears the current assistant thread
  - assistant-triggered task or panic changes dispatch `taskmonster:assistant-refresh`
  - active, daymap, inactive, done, and stats pages listen for that refresh event
- Assistant create behavior now has a duplicate guard
  - if the backend sees a close match already in `inactive` or `daymap`, the assistant should present a `1 / 2 / 3` choice instead of silently creating another task
  - that follow-up choice depends on the current thread still being present in the drawer

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
