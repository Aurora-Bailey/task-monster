# SMS Bridge

This folder is a planning area for a future SMS assistant that talks to Task Monster without being tightly coupled to the main app.

Important current context:

- the main app already has an authenticated in-app AI assistant through `POST /assistant/chat`
- the SMS bridge should stay separate anyway because SMS transport, phone-linking, delivery rules, and safety policy are different from the web drawer
- where reasonable, the SMS bridge should mirror the main assistant's task semantics instead of inventing a conflicting second interpretation layer

For now, this is a spec and design brief, not a started implementation.

## Goal

Create a separate Node.js service, likely using Fastify, that can:

- receive SMS messages
- interpret the user's intent
- query the existing Task Monster backend
- take safe task actions through the backend API
- send short confirmation or clarification replies back over SMS

Example user messages:

- `start the running task`
- `end the dev task`
- `what's active`
- `put laundry on the daymap`
- `done with dishes`

## Why a separate service

The main app already has a working backend and frontend. The SMS assistant should stay isolated so it can evolve without tangling the existing codebase.

Benefits of a separate `sms-bridge` service:

- keeps SMS provider logic out of the main backend
- keeps SMS-specific prompting, rate limits, and delivery policy separate from the in-app assistant
- allows different deployment, secrets, rate limits, and logging
- reduces risk to the main app while the idea is still being refined
- makes it easier to iterate on prompts, matching rules, and safety policy

## High-level architecture

Proposed shape:

- `sms-bridge/`
  - separate Node.js app
  - likely Fastify
  - its own `package.json`
  - its own env vars
  - its own README and design notes

External systems:

- SMS provider
  - likely Twilio or similar
- OpenAI model
  - used for intent interpretation and tool selection
- existing Task Monster backend
  - used as the source of truth for tasks and actions

## Core idea

The SMS bridge should not let the model freestyle against the backend.

Preferred pattern:

1. SMS arrives at the bridge.
2. The bridge authenticates the sender by phone number.
3. The bridge parses obvious commands directly when possible.
4. If needed, the bridge calls an OpenAI model with a constrained tool set.
5. The bridge fetches candidate tasks from the Task Monster backend.
6. The bridge resolves the best task match.
7. The bridge either:
   - performs the action through the backend API, or
   - asks a clarifying question if confidence is too low.
8. The bridge sends a short SMS reply.

This keeps the real authority in code and in the existing backend API.

## Recommended scope for v1

First version should be intentionally small.

Suggested supported actions:

- list active tasks
- list daymap tasks
- list inactive tasks
- activate a task
- inactivate an active task
- mark a task done
- move a task to daymap
- snooze an active timed task
- start or stop panic mode

Suggested deferred actions:

- archive task
- create brand new task by SMS
- edit task metadata beyond small notes
- multi-step planning conversations
- natural-language analytics questions

Reason for deferring SMS task creation:

- the web assistant now has a duplicate-task guard against close matches in `inactive` and `daymap`
- if SMS task creation is ever enabled, it should reuse the same safety idea instead of creating silent duplicates from short text commands

## How intent should work

Use a hybrid approach.

### First layer: deterministic parsing

Handle obvious text without the model when possible.

Examples:

- `start X`
- `stop X`
- `end X`
- `done X`
- `activate X`
- `what's active`
- `what is active`
- `show daymap`
- `what's on my daymap`
- `snooze X`

This makes the bridge cheaper, faster, and more predictable.

### Second layer: model-assisted interpretation

If the message is ambiguous or less structured, use an OpenAI model with a narrow tool set.

The model should be able to choose among tools like:

- `list_active_tasks`
- `list_daymap_tasks`
- `list_inactive_tasks`
- `activate_task`
- `inactivate_task`
- `done_task`
- `move_task_to_daymap`
- `snooze_task`
- `start_panic`
- `stop_panic`
- `ask_clarifying_question`

The model should not receive unrestricted backend access.

## Task matching strategy

This is the hardest part of the feature.

For text like `end the dev task`, the bridge must decide:

- which task the user means
- whether `end` means `done` or `inactivate`

Recommended matching flow:

1. Decide the likely action type.
2. Pull only the relevant task pool from the backend.
   - `start` likely searches daymap or inactive
   - `stop` likely searches active
   - `done` should search active
3. Rank candidates in code first.
4. Give the model only the top few candidates if needed.
5. If confidence is low, ask a clarification question.

Matching signals could include:

- exact normalized name match
- substring match
- token overlap
- fuzzy string similarity
- task state relevance
- recency

Example:

- user: `end the dev task`
- bridge:
  - fetches active tasks
  - sees `fix vite config`, `task monster docs`, `slcc reading`
  - maybe maps `dev` loosely to `task monster docs`
  - if confidence is weak, asks:
    - `Do you mean "task monster docs" or "fix vite config"? Reply 1 or 2.`

## Safety rules

The bridge should bias toward clarification over guessing.

Recommended rules:

- never act for an unknown phone number
- verify SMS webhook signatures
- require explicit user mapping from phone number to Task Monster user
- ask before risky or irreversible actions
- do not guess if multiple tasks are plausible
- keep an audit log of inbound message, chosen action, backend call, and reply
- if SMS task creation is later allowed, require the same kind of explicit reuse-vs-create choice the web assistant now uses

Actions that should likely require extra caution:

- `done`
- `archive`
- anything that affects a one-time task

Possible policy:

- low-risk actions can execute immediately
  - `what's active`
  - `show daymap`
  - `snooze`
- medium-risk actions execute if confidence is high
  - `start X`
  - `stop X`
- high-risk actions may require confirmation when ambiguous
  - `done X`
  - `archive X`

## Proposed integration with the current backend

The bridge should use the current backend as the source of truth instead of reimplementing task logic.

Likely backend routes the bridge will use:

- `GET /tasks/active`
- `GET /tasks/daymap`
- `GET /tasks/inactive`
- `POST /tasks/:taskId/activate`
- `POST /tasks/:taskId/inactivate`
- `POST /tasks/:taskId/done`
- `POST /tasks/:taskId/daymap`
- `POST /tasks/:taskId/snooze`
- `GET /panic/status`
- `POST /panic/start`
- `POST /panic/stop`

This is a good fit for the current app because the backend already owns task-state transitions and run tracking.

## Auth options between bridge and backend

This needs a deliberate decision.

### Option A: store a backend session token per linked user

Pros:

- easiest MVP
- works with the current backend model

Cons:

- token lifecycle management becomes the bridge's problem
- less elegant long-term

### Option B: add a service-to-backend auth path later

Pros:

- cleaner architecture
- better for long-term multi-user use

Cons:

- requires main backend changes
- more upfront design

Current recommendation:

- start with Option A for a personal MVP
- move toward Option B if the bridge becomes more serious

## Recommended phone linking design

This feature should be exposed in the existing user settings area, which currently lives at `/profile`.

Recommended UI:

- add an `SMS Assistant` section to `/profile`
- let the user enter a phone number
- send a verification code by SMS
- let the user enter that code back into the UI
- once verified, show the number as active for SMS assistant use
- allow unlinking or replacing the number later

Recommended initial product rule:

- one verified active phone number per Task Monster user
- one phone number can belong to only one Task Monster user

That keeps the model simple while the feature is still young.

## Ownership boundaries

This is the cleanest split so far:

- frontend UI
  - collects phone number
  - collects verification code
  - shows linked or unlinked status
- main backend
  - authenticates the logged-in user
  - stores the canonical phone-link state
  - stores pending verification requests and code hashes
  - decides when a number becomes verified and active
- sms-bridge
  - is the only component allowed to talk to the SMS provider
  - sends the verification code text
  - later receives normal inbound SMS commands
  - later sends action confirmations and clarification texts

Important rule:

- no part of the main app should talk to Twilio or any other SMS provider directly
- the main backend may request that sms-bridge send a message
- sms-bridge remains the only system that actually sends text messages

## Recommended verification flow

Suggested flow:

1. The user opens `/profile`.
2. The user enters a phone number.
3. The frontend calls an authenticated backend route such as `POST /sms-link/start`.
4. The backend:
   - normalizes the number to E.164
   - checks that the number is not already linked to another account
   - creates a short verification code
   - stores only a hash of that code plus expiry and attempt metadata
   - requests that sms-bridge send the verification SMS
5. sms-bridge sends a short code like `Task Monster code: 482193`.
6. The user enters the code back into `/profile`.
7. The frontend calls `POST /sms-link/verify`.
8. The backend verifies the code and marks the phone number as active.
9. sms-bridge can now treat inbound texts from that number as coming from that Task Monster user.

## Recommended backend surface for linking

Suggested authenticated user-facing routes:

- `GET /sms-link`
  - returns current linked-phone status
- `POST /sms-link/start`
  - begins verification for a phone number
- `POST /sms-link/verify`
  - verifies the code entered in the UI
- `DELETE /sms-link`
  - disables or removes the current link

Suggested internal backend responsibilities:

- normalize phone numbers
- store code hashes, not raw codes
- enforce expiry
- enforce retry limits
- enforce uniqueness on verified phone numbers
- mark links active only after verification

## Recommended bridge surface for linking

The main backend should have a narrow way to tell sms-bridge to send a verification code.

Two good options:

### Option 1: internal bridge endpoint

Backend calls something like:

- `POST /internal/send-verification`

with:

- phone number
- short verification message
- request metadata
- internal auth signature or shared secret

Pros:

- simple
- easy to reason about
- bridge stays the only SMS sender

Cons:

- tighter runtime coupling between backend and bridge

### Option 2: outbox or job queue

Backend writes a send request to a queue or outbox record. sms-bridge consumes it and sends the SMS.

Pros:

- more decoupled
- easier retry behavior
- better long-term scaling

Cons:

- more moving parts
- heavier for a first version

Current recommendation:

- use the internal bridge endpoint first
- move to an outbox or queue later if the bridge becomes important enough

## Where phone-link data should live

Canonical phone-link data should live with the main app's backend data, not only inside sms-bridge.

That means the source of truth should probably be in the main Mongo database, owned by the backend.

Suggested collections:

- `sms_phone_links`
  - `userId`
  - `phoneE164`
  - `status`
  - `verifiedAt`
  - `createdAt`
  - `updatedAt`
  - `disabledAt`
- `sms_verification_requests`
  - `userId`
  - `phoneE164`
  - `codeHash`
  - `expiresAt`
  - `attemptCount`
  - `status`
  - `createdAt`
  - `updatedAt`

Recommended constraints:

- unique verified phone number
- one active linked number per user for v1
- short expiry window for codes
- max verification attempts per request

## How sms-bridge should access linked numbers

The bridge needs access to the verified phone mapping so it can resolve inbound SMS to the correct user.

Best long-term option:

- sms-bridge looks up linked numbers through a narrow internal backend API

Possible internal backend routes:

- `POST /internal/sms/resolve-sender`
- `GET /internal/sms/link/:phoneE164`

Why this is preferable:

- keeps bridge decoupled from raw database schema
- keeps the backend as the canonical owner of link state
- makes it easier to change storage later

Shortcut MVP option:

- let sms-bridge read the shared Mongo collections directly

That is acceptable for a personal prototype, but it couples the bridge more tightly to backend storage details.

## Why this keeps SMS encapsulated

This split preserves the boundary you want:

- the UI never sends texts
- the main backend never talks to Twilio directly
- sms-bridge is the only thing that sends SMS
- the main backend still owns account identity and verified phone-link state

So the linkage exists, but the SMS side stays isolated.

## Conversation state

SMS is messy and ambiguous, so the bridge should keep a small amount of state.

Useful examples:

- pending clarification
- pending confirmation
- last candidate list shown to the user
- last intended action
- timestamps for expiration

Example:

- user: `done the chore one`
- bridge: `Did you mean "laundry" or "dishes"? Reply 1 or 2.`
- user: `2`
- bridge uses stored context and completes the action

## SMS reply style

Replies should stay short and direct.

Good examples:

- `Started "running".`
- `Marked "dev docs" done.`
- `Active: dishes, task monster docs`
- `I found two matches: 1) dev docs 2) vite config. Reply 1 or 2.`

Avoid:

- long explanations
- verbose chain-of-thought style text
- unnecessary formatting

## Likely provider choice

Twilio is the obvious default because:

- inbound SMS webhooks are simple
- outbound messaging is straightforward
- Node.js support is mature
- webhook validation is well documented

This is still a design decision, not a final commitment.

## Likely tech stack

Proposed initial stack:

- Node.js
- Fastify
- SMS provider SDK or webhook integration
- OpenAI API for intent interpretation and tool selection
- bridge-local datastore for conversation state and audit logs
  - SQLite would be enough for a personal MVP
  - Postgres would be more scalable
- canonical phone-link state should probably live in the main backend's Mongo database

## Suggested internal modules

If implemented later, likely modules would be:

- `server`
  - Fastify app and routes
- `providers/sms`
  - inbound webhook handling
  - outbound SMS sending
- `providers/openai`
  - model calls and tool loop
- `task-monster-client`
  - typed wrapper around the main backend API
- `verification`
  - request verification sends
  - manage code-send related logic on the bridge side
- `matcher`
  - task name matching and candidate ranking
- `conversation-state`
  - pending clarifications and confirmations
- `users`
  - linked-number lookup and user resolution
- `audit-log`
  - store requests, decisions, and outcomes

## MVP proposal

Personal MVP:

- one linked phone number
- one linked Task Monster user
- phone linking from `/profile` with verification code
- Twilio inbound and outbound SMS
- deterministic commands first
- model fallback for ambiguous text
- support:
  - `what's active`
  - `what's on my daymap`
  - `start X`
  - `stop X`
  - `done X`
- clarification flow for low-confidence matches
- log every action

This would prove the concept without overbuilding.

## Risks and tricky parts

- ambiguous task names
- users saying `stop`, `end`, and `done` interchangeably
- phone number normalization and uniqueness
- deciding where canonical phone-link state should live
- SMS delivery and retry behavior
- keeping replies within practical SMS length
- avoiding accidental destructive actions
- keeping bridge auth secure
- deciding how much state to preserve between messages

## Estimated effort

Very rough estimates:

- tiny proof of concept: a couple of days
- solid personal MVP: around one to two weeks
- polished multi-user version: significantly more

## Open questions

These should be refined before implementation:

- Which SMS provider do we want first?
- Do we want the bridge to support one user only at first?
- Should `end X` default to `inactivate` instead of `done`?
- Should `done` require confirmation for one-time tasks?
- Should the bridge be able to create tasks by SMS in v1?
- Should the bridge read phone links through an internal backend API or directly from Mongo in the MVP?
- Do we want a bridge-only service token model eventually?

## Recommended next step

Before writing code:

1. refine this README
2. define exact v1 commands
3. define clarification and confirmation rules
4. lock the phone-linking flow between `/profile`, backend, and sms-bridge
5. choose SMS provider
6. choose bridge-to-backend auth strategy

Once those are stable, scaffold the service inside this folder.
