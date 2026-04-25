# Frontend API Schema Audit

Purpose: map what the frontend calls to what the backend currently provides, surface gaps, and propose a prioritized plan to complete missing work.

Scope audited
- Frontend: `frontend/src/services/*` (primary callers)
- Backend: `backend/app/api/*` and routers registered in `backend/app/main.py`

Status legend
- working — endpoint exists and response shape matches frontend expectations
- pending — endpoint exists but response shape or semantics require small compatibility fixes
- broken — frontend calls an endpoint that the backend does not implement

Quick summary
- Total frontend-called endpoints audited: ~70
- Working: majority (auth, alumni, documents, events, registrations)
- Pending: some admin pagination / shape mismatches
- Broken / missing: admin roles CRUD, change-password, meetings, notifications, hyperledger surfaces

Readability note: this document focuses on the contract (path, method, request, response) rather than implementation details. Missing endpoints are prioritized below.

## Missing endpoints (summary)

The backend was missing or differs for a small set of frontend-expected APIs. Lightweight stub endpoints have been added to the backend under `/api/v1/*` to reduce frontend errors during development. Exact gaps:

- `POST /api/v1/auth/change-password`
- Admin roles management (roles CRUD + permissions):
  - `GET /api/v1/admin/roles/{roleId}`
  - `POST /api/v1/admin/roles`
  - `PUT /api/v1/admin/roles/{roleId}`
  - `DELETE /api/v1/admin/roles/{roleId}`
  - `POST /api/v1/admin/roles/{roleId}/permissions`
  - `DELETE /api/v1/admin/roles/{roleId}/permissions/{permissionId}`
- `POST /api/v1/documents/{documentId}/reject`
- Meetings endpoints (examples):
  - `GET/POST /api/v1/meetings`
  - `GET /api/v1/meetings/{meetingId}`
  - `GET /api/v1/events/{eventId}/meetings`
  - `POST /api/v1/meetings/generate-token`
- Notifications:
  - `GET/POST /api/v1/notifications`
- Hyperledger / Fabric admin endpoints (examples):
  - `GET /api/v1/hyperledger/networks`
  - `GET /api/v1/hyperledger/channels`
  - `GET /api/v1/hyperledger/chaincodes`
  - `POST /api/v1/hyperledger/invoke`
  - `POST /api/v1/hyperledger/query`

These stubs return a lightweight JSON payload indicating they are placeholders; replace with production logic as needed.

## Auth

| Endpoint | Method | Request Shape (body/headers/params) | Frontend Expected Response Shape | Backend Actual / Mismatch | Status |
|---|---|---|---|---|---|
| `/auth/register` | POST | body: `userData` | `response.data` with success + user payload | Implemented in backend | working |
| `/auth/login` | POST | body: `{ email, password, remember }` | expects `access_token`; also stores user metadata | Implemented; returns `success/access_token/token_type/user` | working |
| `/auth/me` | GET | headers: `Authorization: Bearer <token>`; sometimes `?t=<ts>` | user object | Implemented; returns user + role/profile info | working |
| `/auth/refresh` | POST | body: `{ refresh_token }` | expects new tokens | Implemented; returns `access_token/refresh_token/token_type` | working |
| `/auth/logout` | POST | auth context | success indicator | Implemented | working |
| `/auth/csrf-token` | GET | `withCredentials: true` | `{ csrf_token }` | Implemented | working |
| `/auth/unverified-users?limit=10` | GET | headers auth + `X-Admin-Access` | array of users | Implemented; ignores extra header | working |
| `/auth/verify-user/{userId}?db=...&collection=...` | POST | body: `{ notes }`; auth + csrf | verification result object | Implemented route; query params are unused but harmless | pending |
| `/auth/user/{userId}` | GET | auth headers | user object | Implemented | working |
| `/auth/reset-password` | POST | body: `{ email }` | success/message (+ token in current impl) | Implemented | working |
| `/auth/verify-reset-token` | POST | body: `{ token }` | `{ success, valid, ... }` | Implemented | working |
| `/auth/reset-password-confirm` | POST | body: `{ token, password, confirm_password }` | success/message | Implemented | working |
| `/auth/mfa/status` | GET | auth headers | `{ enabled, method, configured }` | Implemented | working |
| `/auth/mfa/setup` | POST | body: `{ type }`; auth headers | setup result (currently includes verification code) | Implemented | working |
| `/auth/mfa/enable` | POST | body: `{ verification_code }`; auth headers | success/message | Implemented | working |
| `/auth/mfa/disable` | POST | auth headers | success/message | Implemented | working |
| `/auth/set-security-questions` | POST | body: question list; auth headers | success/message | Implemented | working |
| `/auth/security-questions/{email}` | GET | path param email | `{ questions: [{index, question}] }` | Implemented | working |
| `/auth/verify-security-questions` | POST | body: `{ email, answers[] }` | expects success + `reset_token` | Implemented | working |
| `/auth/change-password` | POST | body: `passwordData`; auth headers | success/message | Not implemented in backend | broken |

## Alumni

| Endpoint | Method | Request Shape (body/headers/params) | Frontend Expected Response Shape | Backend Actual / Mismatch | Status |
|---|---|---|---|---|---|
| `/alumni/simple` | POST | body: profile payload (prepared by service) | `{ success, id, profile }` | Implemented | working |
| `/alumni/{alumniId}/simple` | PUT | body: profile payload | `{ success, id, profile }` | Implemented | working |
| `/alumni` | POST | body: profile payload | profile object | Implemented | working |
| `/alumni/{alumniId}` | PUT | body: profile payload | updated profile object | Implemented | working |
| `/alumni/{alumniId}` | GET | path param | profile object | Implemented | working |
| `/alumni/user/{userId}` | GET | path param | profile object or null | Implemented (null-style compatibility behavior retained) | working |
| `/alumni/me` | GET | auth headers | current user profile | Implemented | working |
| `/alumni/list` and fallback `/alumni` | GET | query params `offset,limit` | expects paginated shape: `{ results,total,offset,limit }` | Implemented | working |
| `/alumni/{alumniId}/profile-picture` | POST | multipart: `profile_picture`; auth headers | upload result | Implemented | working |

## Admin

| Endpoint | Method | Request Shape (body/headers/params) | Frontend Expected Response Shape | Backend Actual / Mismatch | Status |
|---|---|---|---|---|---|
| `/admin/users` | GET | query: `{ page, limit }` | `{ items, meta }` | Implemented | working |
| `/admin/users/{id}` | GET | path param | admin user object | Implemented | working |
| `/admin/users` | POST | body: admin user payload | created admin user | Implemented | working |
| `/admin/users/{id}` | PUT | body: admin user payload | updated admin user | Implemented | working |
| `/admin/users/{id}` | DELETE | path param | success indicator | Implemented | working |
| `/admin/users/{id}/role` | PUT | body: role payload | updated admin user | Implemented | working |
| `/admin/roles` | GET | query: pagination | `{ items, meta }` | Implemented (currently static/basic role list) | working |
| `/admin/permissions` | GET | no body | permission array | Implemented | working |
| `/admin/verifications?status=...` | GET | status filter query | array for verification queue (documentType, studentName, etc.) | Implemented | working |
| `/admin/verifications/{documentId}/approve` | POST | body: `{ admin_notes }` | action result | Implemented | working |
| `/admin/verifications/{documentId}/reject` | POST | body: `{ admin_notes }` | action result | Implemented | working |
| `/admin/roles/{roleId}` | GET | path param | role detail object | Not implemented | broken |
| `/admin/roles` | POST | body: role payload | created role | Not implemented | broken |
| `/admin/roles/{roleId}` | PUT | body: role payload | updated role | Not implemented | broken |
| `/admin/roles/{roleId}` | DELETE | path param | success indicator | Not implemented | broken |
| `/admin/roles/{roleId}/permissions` | POST | body: permission assignment | updated permissions | Not implemented | broken |
| `/admin/roles/{roleId}/permissions/{permissionId}` | DELETE | path params | success indicator | Not implemented | broken |
| `/admin/dashboard/recent-activity` | GET | sometimes `_force_refresh=true` query | recent activity list | Implemented | working |

## Documents

| Endpoint | Method | Request Shape (body/headers/params) | Frontend Expected Response Shape | Backend Actual / Mismatch | Status |
|---|---|---|---|---|---|
| `/documents/upload` | POST | multipart: `alumni_id, document_type, title, description?, file` | success + created document info | Implemented | working |
| `/documents/alumni/{alumniId}` | GET | path param | document list | Implemented | working |
| `/documents/{documentId}` | GET | path param | document object | Implemented | working |
| `/documents/{documentId}` | DELETE | path param | success indicator | Implemented | working |
| `/documents/search` | GET | query: optional `verification_status` | filtered document list | Implemented | working |
| `/documents/pending/all` | GET | no body | pending docs list | Implemented | working |
| `/documents/activities` | GET | optional cache-buster query | activity list | Implemented | working |
| `/document-requests/` | POST | body: `{ document_type, purpose }` | created request object | Implemented | working |
| `/document-requests/` | GET | optional query `status` | request list | Implemented | working |
| `/document-requests/{requestId}` | GET | path param | request detail | Implemented | working |
| `/document-requests/admin` | GET | optional query `status` | admin request list | Implemented | working |
| `/document-requests/{requestId}/update` | PUT | body: `{ status, admin_notes?, rejection_reason? }` | updated request | Implemented | working |
| `/document-requests/{requestId}/generate` | POST | no body | generation result | Implemented | working |
| `/document-requests/{requestId}/download` | GET | binary file response | blob download | Implemented | working |
| `/verification/blockchain/store` | POST | body: `{ document_id, hash, metadata }` | `{ success, verified, message, metadata }` | Implemented | working |
| `/verification/blockchain/verify` | POST | body: `{ document_id, hash }` | verification result | Implemented | working |
| `/verification/blockchain/verify-file` | POST | multipart: `document_id, file` | verification result | Implemented | working |
| `/verification/blockchain/history/{documentId}` | GET | path param + auth | `{ document_id, history[] }` | Implemented | working |
| `/documents/{documentId}/reject` | POST | body: `{ reason }` | reject action result | Not implemented; frontend code itself notes this gap | broken |

## Events

| Endpoint | Method | Request Shape (body/headers/params) | Frontend Expected Response Shape | Backend Actual / Mismatch | Status |
|---|---|---|---|---|---|
| `/events/upcoming?limit={n}` | GET | query `limit` | events array | Implemented | working |
| `/events?active_only={bool}` | GET | query `active_only` | events array | Implemented | working |
| `/events/{eventId}` | GET | path param | event object | Implemented | working |
| `/events` | POST | normalized event body; auth + csrf handling in client | created event object | Implemented | working |
| `/events/{eventId}` | PUT | event body; auth + csrf handling | updated event object | Implemented | working |
| `/events/{eventId}` | DELETE | path param; auth + csrf handling | success indicator | Implemented | working |
| `/events/{eventId}/qrcode?type=...` | GET | query `type` | `{ qr_code_url }` | Implemented | working |
| `/events/{eventId}/attendance-qrcode` | GET | path param | `{ qr_code_url }` | Implemented | working |

## Registrations

| Endpoint | Method | Request Shape (body/headers/params) | Frontend Expected Response Shape | Backend Actual / Mismatch | Status |
|---|---|---|---|---|---|
| `/registrations` | POST | body: `{ event_id, user_id }` | registration object | Implemented | working |
| `/registrations/user` | GET | auth headers | registration list | Implemented | working |
| `/registrations/event/{eventId}` | GET | path param; admin auth | registration list with user info | Implemented | working |
| `/registrations/all` | GET | admin auth | list (frontend tolerates wrapped fallback) | Backend returns array; frontend normalization handles this | pending |
| `/registrations/{registrationId}/check-in` | POST | path param | updated registration | Implemented | working |
| `/registrations/check-in-qr` | POST | body: `{ qr_data }` | check-in result | Implemented | working |
| `/registrations/{registrationId}` | PUT | body: `{ status }` | updated registration | Implemented with validated transitions | working |
| `/registrations/{registrationId}` | DELETE | path param | success indicator | Implemented | working |
| `/registrations/event/{eventId}/attendees` | GET | path param; admin auth | `{ event, statistics, attendees }` plus attendee fields for UI | Implemented and aligned | working |
| `/registrations/quick-register/{eventId}/{token}` | POST | empty body `{}` | registration result | Implemented | working |
| `/registrations/quick-attend/{token}` | POST | empty body `{}` | attendance result | Implemented | working |

## Other Frontend-Called Endpoints (Outside Requested Feature Groups)

These are included to satisfy the "every endpoint frontend currently calls" requirement:

| Endpoint Family | Examples | Backend Status |
|---|---|---|
| Meetings | `/meetings/*`, `/events/{eventId}/meetings`, `/api/meetings/generate-token` | broken (not implemented in current backend API) |
| Notifications | `/notifications?...` | broken (not implemented in current backend API) |
| Hyperledger | `/hyperledger/networks*`, `/hyperledger/channels*`, `/hyperledger/chaincodes*`, `/hyperledger/invoke`, `/hyperledger/query` | broken (not implemented in current backend API) |

