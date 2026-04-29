# API Endpoint Audit

Date: 2026-04-28

Scope:

- backend route definitions in `backend/app`
- frontend API callers in `frontend/src`
- comparison based on code currently in the workspace

## Executive Summary

The API is substantial and covers the main product areas well, but it still has contract drift between backend and frontend.

What is healthy:

- broad endpoint coverage across auth, alumni, admin, documents, events, registrations, verification, notifications, meetings, and references
- Swagger/OpenAPI is mounted from the live FastAPI app
- core admin user verification flow is now wired through the admin namespace
- backend has clear modular route files

What is risky:

- some frontend flows still call endpoints that do not exist
- some backend endpoints exist but return shapes or query semantics different from what the frontend expects
- a few route families are split across multiple files or duplicated under old and new namespaces
- the MFA section in `backend/app/api/register.py` is partially corrupted and should not be treated as production-safe

## Inventory Snapshot

Backend route decorators found: `105`

By file:

- `backend/app/api/register.py`: `17`
- `backend/app/api/endpoints/admin.py`: `19`
- `backend/app/api/endpoints/admin_roles.py`: `6`
- `backend/app/api/endpoints/alumni.py`: `11`
- `backend/app/api/endpoints/auth_password.py`: `1`
- `backend/app/api/endpoints/document_requests.py`: `7`
- `backend/app/api/endpoints/documents.py`: `8`
- `backend/app/api/endpoints/events.py`: `8`
- `backend/app/api/endpoints/meetings.py`: `5`
- `backend/app/api/endpoints/notifications.py`: `2`
- `backend/app/api/endpoints/references.py`: `1`
- `backend/app/api/endpoints/registrations.py`: `11`
- `backend/app/api/endpoints/stubs.py`: `5`
- `backend/app/api/endpoints/verification.py`: `4`

Frontend API call sites found: `163`

Heaviest consumers:

- `frontend/src/services/api.js`
- `frontend/src/services/eventService.js`
- `frontend/src/services/hyperledger.js`
- `frontend/src/services/authService.js`
- `frontend/src/services/meetingService.js`

## Backend Route Families

### Auth

Implemented under:

- `backend/app/api/register.py`
- `backend/app/api/endpoints/auth_password.py`

Active families:

- register, login, me, refresh, logout
- csrf token
- password reset flow
- security question flow
- legacy user verification flow: `/auth/unverified-users`, `/auth/verify-user/{user_id}`
- MFA status and disable endpoints only
- change password

Notes:

- Auth has both modern admin verification routes and older auth-based verification routes.
- MFA setup and enable are not implemented as standalone routes even though the frontend expects them.

### Alumni

Implemented under `backend/app/api/endpoints/alumni.py`

Active families:

- profile create/update
- profile lookup by profile id and by user id
- `me`
- list and alias list
- profile picture upload
- compatibility `simple` wrappers

Notes:

- `/alumni/simple` and `/alumni/{id}/simple` are compatibility wrappers and add contract noise.

### Admin

Implemented under:

- `backend/app/api/endpoints/admin.py`
- `backend/app/api/endpoints/admin_roles.py`

Active families:

- admin profile
- admin user management
- pending user verification
- roles and permissions
- document verification review
- dashboard stats and recent activity

Notes:

- `/admin/roles` list lives in `admin.py`, while role detail/create/update/delete lives in `admin_roles.py`.
- This works, but the split is easy to lose track of and makes the contract feel more fragmented than it needs to.

### Documents And Document Requests

Implemented under:

- `backend/app/api/endpoints/documents.py`
- `backend/app/api/endpoints/document_requests.py`

Healthy areas:

- upload, search, pending, get, delete
- request create/list/detail/admin/update/generate/download

### Events And Registrations

Implemented under:

- `backend/app/api/endpoints/events.py`
- `backend/app/api/endpoints/registrations.py`

Healthy areas:

- events CRUD
- upcoming events
- qr endpoints
- registration, attendee, check-in, quick-register flows

### Meetings

Implemented under `backend/app/api/endpoints/meetings.py`

Current backend supports:

- list meetings
- create meeting
- get meeting
- list meetings by event
- generate meeting token

Notes:

- frontend expects a richer meeting lifecycle than the backend currently implements

### Notifications

Implemented under `backend/app/api/endpoints/notifications.py`

Current backend supports:

- list notifications
- create notification

Notes:

- query contract and response shape do not fully match the frontend

### Verification / Hyperledger

Implemented under:

- `backend/app/api/endpoints/verification.py`
- `backend/app/api/endpoints/stubs.py`

Current state:

- blockchain verification endpoints exist
- Hyperledger network/channel/chaincode CRUD is mostly stubbed or missing

## High-Priority Findings

### 1. MFA contract is broken

Files:

- `backend/app/api/register.py`
- `frontend/src/services/api.js`

Frontend expects:

- `POST /auth/mfa/setup`
- `POST /auth/mfa/enable`
- `GET /auth/mfa/status`
- `POST /auth/mfa/disable`

Backend currently exposes:

- `GET /auth/mfa/status`
- `POST /auth/mfa/disable`

Problems:

- `setup` and `enable` routes are missing
- the code inside `get_mfa_status` is corrupted: it references `payload` where no payload exists and appears to contain stray login/enable logic

Impact:

- MFA cannot be considered reliable from either Swagger or frontend

Recommendation:

1. split MFA into four clean routes
2. repair `get_mfa_status`
3. add focused tests before using MFA in production

### 2. Notifications contract is mismatched

Files:

- `backend/app/api/endpoints/notifications.py`
- `frontend/src/layouts/DashboardLayout.jsx`
- `frontend/src/pages/dashboard/NotificationsPage.jsx`
- `frontend/src/services/polling.js`

Frontend sends:

- `include_read=true|false`
- `since_id`

Backend accepts:

- `unread_only`
- `offset`
- `limit`

Response mismatch:

- backend returns a raw list
- `NotificationsPage.jsx` expects `{ notifications, unread_count }`

Additional note:

- the user's console showed `404` for `/api/v1/notifications` even though the route exists in code, which suggests runtime drift or a backend process that was not reloaded

Recommendation:

1. standardize on one query contract
2. choose one response shape
3. make dashboard polling and notifications page use the same parser

### 3. Meetings frontend expects routes that do not exist

Files:

- `backend/app/api/endpoints/meetings.py`
- `frontend/src/services/meetingService.js`

Frontend expects:

- `PUT /meetings/{id}`
- `POST /meetings/{id}/join`
- `POST /meetings/{id}/leave`
- `POST /meetings/{id}/recording/start`
- `POST /meetings/{id}/recording/stop`
- `GET /meetings/{id}/recording`

Backend currently exposes none of those.

Impact:

- meeting service is only partially backed by real API support

Recommendation:

- either implement the missing endpoints or trim the frontend service to match the real backend

### 4. Hyperledger CRUD in frontend is not backed by the backend

Files:

- `backend/app/api/endpoints/stubs.py`
- `frontend/src/services/hyperledger.js`

Frontend expects CRUD-style endpoints for:

- networks
- channels
- chaincodes

Backend currently has only:

- `GET /hyperledger/networks`
- `GET /hyperledger/channels`
- `GET /hyperledger/chaincodes`
- `POST /hyperledger/invoke`
- `POST /hyperledger/query`

And those are explicit stubs.

Impact:

- the frontend service advertises capabilities that the backend does not really provide

Recommendation:

- either mark the frontend service as stub/demo-only or implement the missing CRUD routes

### 5. Legacy admin recent-users page calls a missing endpoint

Files:

- `frontend/src/pages/admin/AdminNewRegistrationsPage.jsx`

Frontend calls:

- `GET /admin/recent-users`

Backend does not implement that route.

Impact:

- this page cannot be reliable without fallback behavior

Recommendation:

- either implement `/admin/recent-users` or retire the page and fold it into `/admin/users/pending-verification` or another existing admin list

## Important Medium-Priority Findings

### 6. Two verification namespaces exist

Files:

- `backend/app/api/register.py`
- `backend/app/api/endpoints/admin.py`
- `frontend/src/services/authService.js`
- `frontend/src/services/api.js`

Old verification routes:

- `/auth/unverified-users`
- `/auth/verify-user/{user_id}`

New admin routes:

- `/admin/users/pending-verification`
- `/admin/users/{user_id}/verify`
- `/admin/users/{user_id}/reject`

Impact:

- two ways to do the same job means more long-term drift

Recommendation:

- keep the admin routes as canonical
- migrate frontend callers away from the old auth-based verification flow

### 7. Admin roles are better now, but still split across two route files

Files:

- `backend/app/api/endpoints/admin.py`
- `backend/app/api/endpoints/admin_roles.py`

Current state:

- list roles in `admin.py`
- role detail and mutation in `admin_roles.py`

Impact:

- not broken, but harder to reason about and easier to regress

Recommendation:

- consolidate the whole role family in one module later

### 8. Response envelope style is still mixed

Observed patterns:

- raw arrays
- `{ items, meta }`
- `{ success, ... }`
- direct object payloads

Impact:

- frontend service layer needs lots of defensive parsing

Recommendation:

- standardize by family:
  - lists: `{ items, meta }` when paginated
  - simple list endpoints: raw arrays only when intentionally lightweight
  - actions: `{ success, ... }`

### 9. Some frontend code bypasses shared services

Files include:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/layouts/DashboardLayout.jsx`
- `frontend/src/pages/dashboard/NotificationsPage.jsx`
- `frontend/src/pages/admin/AdminProfilePage.jsx`
- `frontend/src/pages/admin/AdminNewRegistrationsPage.jsx`

Impact:

- endpoint logic, auth headers, and response parsing are duplicated

Recommendation:

- move direct `fetch` and direct `axios` page calls into shared service modules where practical

## Comparison Snapshot

Heuristic normalized comparison found:

- frontend call patterns without a backend match: `21`
- backend route patterns not referenced by the `api/axios` scan: `23`

Important caveat:

- this comparison normalizes path variables and does not fully understand direct `fetch` callers
- some "unused backend" routes are real and are used outside the main service layer

Still, the missing list is directionally useful. The highest-signal missing patterns were:

- `/auth/mfa/setup`
- `/auth/mfa/enable`
- `/admin/recent-users`
- meeting join/leave/recording routes
- Hyperledger network/channel/chaincode CRUD routes

## Recommended Cleanup Order

### Phase 1: Fix contract breaks

1. repair MFA routes and tests
2. unify notifications request/response contract
3. decide whether meetings API will be expanded or frontend meeting service reduced
4. decide whether Hyperledger CRUD is real or demo-only

### Phase 2: Remove duplicate paths

1. migrate remaining auth-based verification callers to admin verification routes
2. retire or replace `/admin/recent-users`
3. reduce use of alumni `simple` wrappers over time

### Phase 3: Improve maintainability

1. consolidate role routes into one backend module
2. move page-level direct API calls into shared services
3. standardize response envelopes by resource family

## Bottom Line

This backend is not small. It already has enough real surface area to feel like a serious system. The main weakness is not lack of endpoints; it is contract drift:

- the frontend advertises some capabilities the backend does not actually provide
- some backend routes are legacy duplicates
- some request and response shapes are inconsistent between modules

If the goal is to make the API feel production-shaped, the next wins are:

1. clean MFA
2. clean notifications
3. choose canonical verification routes
4. either finish or explicitly de-scope meetings and Hyperledger CRUD
