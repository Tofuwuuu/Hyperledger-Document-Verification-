# Backend Schema And API Audit

## Purpose

This document has two jobs:

- describe the backend that is actually running today
- define the cleaner target contract the project should move toward

It reflects the code in `backend/app` and the local MongoDB database `cvsu_alumni` as inspected and updated on April 22, 2026.

## Implementation Checklist

### Core Foundation

- [x] normalize legacy `users.email` values to lowercase
- [x] standardize canonical password field to `password_hash`
- [x] preserve legacy `hashed_password` compatibility during login
- [x] create and use `alumni_profiles` collection
- [x] migrate profile-shaped fields from `users` into `alumni_profiles`
- [x] add Mongo indexes for `users` and `alumni_profiles`

### Auth

- [x] `POST /api/v1/auth/register`
- [x] `POST /api/v1/auth/login`
- [x] `GET /api/v1/auth/me`
- [x] `POST /api/v1/auth/refresh`
- [x] `POST /api/v1/auth/logout`
- [x] `GET /api/v1/auth/user/{user_id}`
- [x] `GET /api/v1/auth/unverified-users`
- [x] `POST /api/v1/auth/verify-user/{user_id}`
- [x] `GET /api/v1/auth/csrf-token`
- [x] password reset endpoints
- [x] MFA endpoints

### Alumni Profiles

- [x] `GET /api/v1/alumni/health`
- [x] `GET /api/v1/alumni/user/{user_id}`
- [x] `GET /api/v1/alumni/{alumni_id}`
- [x] `POST /api/v1/alumni`
- [x] `PUT /api/v1/alumni/{alumni_id}`
- [x] `POST /api/v1/alumni/simple`
- [x] `PUT /api/v1/alumni/{alumni_id}/simple`
- [x] `GET /api/v1/alumni`
- [x] `GET /api/v1/alumni/list`
- [x] `POST /api/v1/alumni/{alumni_id}/profile-picture`
- [x] `GET /api/v1/alumni/me`

### Admin

- [x] `GET /api/v1/admin/users`
- [x] `GET /api/v1/admin/users/{user_id}`
- [x] `POST /api/v1/admin/users`
- [x] `PUT /api/v1/admin/users/{user_id}`
- [x] `DELETE /api/v1/admin/users/{user_id}`
- [x] `PUT /api/v1/admin/users/{user_id}/role`
- [x] `GET /api/v1/admin/roles`
- [x] `GET /api/v1/admin/dashboard/stats`
- [x] `GET /api/v1/admin/dashboard/recent-activity`
- [x] admin verification review endpoints
- [x] admin permissions endpoints

### Documents And Requests

- [x] `POST /api/v1/documents/upload`
- [x] `GET /api/v1/documents/alumni/{alumni_id}`
- [x] `GET /api/v1/documents/{document_id}`
- [x] `DELETE /api/v1/documents/{document_id}`
- [x] `GET /api/v1/documents/search`
- [x] `GET /api/v1/documents/pending/all`
- [x] `GET /api/v1/documents/activities`
- [x] `POST /api/v1/document-requests/`
- [x] `GET /api/v1/document-requests/`
- [x] `GET /api/v1/document-requests/{request_id}`
- [x] `GET /api/v1/document-requests/admin`
- [x] `PUT /api/v1/document-requests/{request_id}/update`
- [x] `POST /api/v1/document-requests/{request_id}/generate`
- [x] `GET /api/v1/document-requests/{request_id}/download`
- [x] blockchain verification endpoints

### Events And Registrations

- [x] events CRUD endpoints
- [x] registrations endpoints
- [x] upcoming events endpoint
- [x] `GET /api/v1/registrations/event/{event_id}/attendees` returns event/statistics/attendees payload
- [x] `POST /api/v1/registrations/check-in-qr`
- [x] `POST /api/v1/registrations/quick-register/{event_id}/{token}`
- [x] `POST /api/v1/registrations/quick-attend/{token}`

### Reference Data

- [x] `/api/v1/references/courses`

## Current Backend Reality

### Active FastAPI modules

The local backend currently mounts:

- `app.api.register`
- `app.api.endpoints.alumni`
- `app.api.endpoints.admin`
- `app.api.endpoints.documents`
- `app.api.endpoints.document_requests`
- `app.api.endpoints.events`
- `app.api.endpoints.registrations`
- `app.api.endpoints.references`
- `app.api.endpoints.verification`

Source files:

- [backend/app/main.py](/e:/Projects/FINAL/backend/app/main.py)
- [backend/app/api/register.py](/e:/Projects/FINAL/backend/app/api/register.py)
- [backend/app/api/endpoints/alumni.py](/e:/Projects/FINAL/backend/app/api/endpoints/alumni.py)
- [backend/app/api/endpoints/admin.py](/e:/Projects/FINAL/backend/app/api/endpoints/admin.py)
- [backend/app/api/endpoints/events.py](/e:/Projects/FINAL/backend/app/api/endpoints/events.py)
- [backend/app/api/endpoints/registrations.py](/e:/Projects/FINAL/backend/app/api/endpoints/registrations.py)
- [backend/app/api/endpoints/references.py](/e:/Projects/FINAL/backend/app/api/endpoints/references.py)
- [backend/app/api/endpoints/verification.py](/e:/Projects/FINAL/backend/app/api/endpoints/verification.py)

### Registered routes today

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/user/{user_id}`
- `GET /api/v1/auth/unverified-users`
- `POST /api/v1/auth/verify-user/{user_id}`
- `GET /api/v1/alumni/health`
- `GET /api/v1/alumni/user/{user_id}`
- `GET /api/v1/alumni/{alumni_id}`
- `POST /api/v1/alumni`
- `PUT /api/v1/alumni/{alumni_id}`
- `POST /api/v1/alumni/simple`
- `PUT /api/v1/alumni/{alumni_id}/simple`
- `GET /api/v1/alumni`
- `GET /api/v1/alumni/list`
- `POST /api/v1/alumni/{alumni_id}/profile-picture`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{user_id}`
- `POST /api/v1/admin/users`
- `PUT /api/v1/admin/users/{user_id}`
- `DELETE /api/v1/admin/users/{user_id}`
- `PUT /api/v1/admin/users/{user_id}/role`
- `GET /api/v1/admin/roles`
- `GET /api/v1/admin/dashboard/stats`
- `GET /api/v1/admin/dashboard/recent-activity`
- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/alumni/{alumni_id}`
- `GET /api/v1/documents/search`
- `GET /api/v1/documents/{document_id}`
- `DELETE /api/v1/documents/{document_id}`
- `GET /api/v1/documents/pending/all`
- `POST /api/v1/document-requests/`
- `GET /api/v1/document-requests/`
- `GET /api/v1/document-requests/{request_id}`
- `GET /api/v1/document-requests/admin`
- `PUT /api/v1/document-requests/{request_id}/update`
- `POST /api/v1/document-requests/{request_id}/generate`
- `GET /api/v1/document-requests/{request_id}/download`
 - `GET /api/v1/events/upcoming`
 - `GET /api/v1/events`
 - `GET /api/v1/events/{event_id}`
 - `POST /api/v1/events`
 - `PUT /api/v1/events/{event_id}`
 - `DELETE /api/v1/events/{event_id}`
 - `GET /api/v1/events/{event_id}/qrcode`
 - `GET /api/v1/events/{event_id}/attendance-qrcode`
 - `POST /api/v1/registrations`
 - `GET /api/v1/registrations/user`
 - `GET /api/v1/registrations/event/{event_id}`
 - `GET /api/v1/registrations/all`
 - `POST /api/v1/registrations/{registration_id}/check-in`
 - `DELETE /api/v1/registrations/{registration_id}`
 - `PUT /api/v1/registrations/{registration_id}`
 - `GET /api/v1/registrations/event/{event_id}/attendees`
 - `GET /api/v1/references/courses`
 - `POST /api/v1/verification/blockchain/store`
 - `POST /api/v1/verification/blockchain/verify`
 - `POST /api/v1/verification/blockchain/verify-file`
 - `GET /api/v1/verification/blockchain/history/{document_id}`

## Canonical API Contract Conventions

The backend now follows these contract conventions for consistency:

- Resource list endpoints that are lightweight remain raw arrays.
  - example: `GET /api/v1/registrations/user` -> `list[registration]`
- Paginated/admin management endpoints use `{ items, meta }`.
  - example: `GET /api/v1/admin/users`
- Action endpoints return `{ success, ... }` with explicit status metadata.
  - example: approve/reject verification endpoints and delete/cancel actions
- Error responses use FastAPI `HTTPException` with canonical `detail` text.

Compatibility aliases retained for frontend stability:

- registration payloads expose both `email` and `user_email` where needed.
- registration timestamps expose `registration_date` alongside existing fields.

## Canonical State Semantics

- `documents.verification_status` is the canonical verification lifecycle field.
  - values in active use: `pending`, `approved`, `rejected`, `verified`
- `documents.status` is retained as a compatibility mirror during transition.
- `event_registrations.status` lifecycle:
  - `registered` -> `attended` or `cancelled`
  - cancelled registrations can be restored to `registered`

## Current MongoDB Reality

Collections present in local `cvsu_alumni`:

- `alumni`
- `alumni_profiles`
- `applications`
- `audit_logs`
- `document_requests`
- `documents`
- `event_registrations`
- `events`
- `jobs`
- `meetings`
- `notifications`
- `users`
- `verification_requests`

The backend now actively uses:

- `users`
- `alumni_profiles`

Other collections may exist but are still feature-dependent.

Observed legacy drift:

- `users` contains both `password_hash` and `hashed_password` depending on document age
- `users` may still contain old fields like `is_active` and `verification_pending`
- `alumni` exists as a separate collection from an older version, but the current backend uses `alumni_profiles`

## Current Data Model

Today the backend has been partially cleaned up:

- auth and admin data live in `users`
- alumni profile data lives in `alumni_profiles`
- legacy `users` profile fields may still exist on older records, but startup migration copies them into `alumni_profiles`

Current canonical `users` shape:

```json
{
  "_id": "ObjectId",
  "email": "string",
  "full_name": "string",
  "password_hash": "bcrypt hash",
  "is_admin": false,
  "is_verified": false,
  "is_active": true,
  "role_id": "string|null",
  "last_login_at": "datetime|null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Current canonical `alumni_profiles` shape:

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "email": "string",
  "full_name": "string",
  "student_id": "string|null",
  "phone": "string|null",
  "graduation_year": "string|number|null",
  "batch": "string|null",
  "course": "string|null",
  "department": "string|null",
  "sex": "string|null",
  "civil_status": "string|null",
  "birthday": "string|null",
  "region_of_origin": "string|null",
  "address": "string|null",
  "bio": "string|null",
  "profile_picture": "uploads/file.ext|null",
  "current_job": "string|null",
  "current_employer": "string|null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Main Problem

The project still has three competing sources of truth:

1. the live FastAPI backend
2. the legacy MongoDB collections
3. the frontend service layer

That mismatch is the reason some frontend routes still fail or rely on bypass behavior.

In practice:

- backend now implements auth, alumni profile CRUD, basic admin user management, dashboard stats/activity, and user verification
- backend now also implements basic documents and document-request workflows
- frontend still expects references, events, registrations, blockchain verification, and deeper admin APIs
- MongoDB still contains collections from an older, broader backend

## Recommended Canonical Design

The cleanest direction remains:

- `users` for identity, auth, and admin flags
- `alumni_profiles` for alumni data
- separate feature collections for documents, requests, verification, events, registrations, and notifications

Recommended canonical collections:

- `users`
- `alumni_profiles`
- `documents`
- `document_requests`
- `verification_requests`
- `events`
- `event_registrations`
- `notifications`
- `audit_logs`

### Why this shape is cleaner

- `users` stays focused on identity, auth, and role checks
- `alumni_profiles` holds profile and academic data without polluting auth records
- document and event features can grow independently
- admin dashboards become queryable without mixed document shapes
- future migrations and validation become much simpler

## Canonical Relationship Map

Recommended relationship model:

```text
users
  1 -> 1 alumni_profiles
  1 -> many documents
  1 -> many document_requests
  1 -> many verification_requests
  1 -> many event_registrations
  1 -> many notifications

alumni_profiles
  1 -> 1 users

documents
  many -> 1 users
  many -> 1 alumni_profiles
  1 -> many verification_requests

document_requests
  many -> 1 users
  0..1 -> 1 documents

events
  1 -> many event_registrations

event_registrations
  many -> 1 events
  many -> 1 users
```

This is the clean "all connections" view the backend is moving toward.

## Recommended API Contract

The API should mirror the canonical collections instead of leaking legacy storage decisions.

### Auth

Recommended stable endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/user/{user_id}`
- `GET /api/v1/auth/unverified-users`
- `POST /api/v1/auth/verify-user/{user_id}`

Minimal response contract for authenticated user:

```json
{
  "id": "string",
  "email": "user@example.com",
  "role": "admin",
  "is_admin": true,
  "is_verified": true,
  "profile_id": "string|null"
}
```

### Alumni Profiles

Recommended stable endpoints:

- `GET /api/v1/alumni/me`
- `GET /api/v1/alumni/{profile_id}`
- `POST /api/v1/alumni`
- `PUT /api/v1/alumni/{profile_id}`
- `GET /api/v1/alumni`
- `POST /api/v1/alumni/{profile_id}/profile-picture`

Important cleanup:

- `POST /alumni` should create a profile record, not patch `users`
- `GET /alumni/user/{user_id}` remains a compatibility helper
- `/simple` wrappers can be removed later after the frontend is updated

### Admin

Recommended stable endpoints:

- `GET /api/v1/admin/dashboard/stats`
- `GET /api/v1/admin/dashboard/recent-activity`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users/{user_id}`
- `PUT /api/v1/admin/users/{user_id}`
- `DELETE /api/v1/admin/users/{user_id}`
- `PUT /api/v1/admin/users/{user_id}/role`
- `GET /api/v1/admin/roles`
- `GET /api/v1/admin/verifications`
- `POST /api/v1/admin/verifications/{request_id}/approve`
- `POST /api/v1/admin/verifications/{request_id}/reject`

### Documents

Recommended stable endpoints:

- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/alumni/{user_id}`
- `GET /api/v1/documents/{document_id}`
- `GET /api/v1/documents/search`
- `DELETE /api/v1/documents/{document_id}`

### Document Requests

Recommended stable endpoints:

- `POST /api/v1/document-requests`
- `GET /api/v1/document-requests`
- `GET /api/v1/document-requests/{request_id}`
- `GET /api/v1/document-requests/admin`
- `PUT /api/v1/document-requests/{request_id}/update`
- `POST /api/v1/document-requests/{request_id}/generate`
- `GET /api/v1/document-requests/{request_id}/download`

### Events

Recommended stable endpoints:

- `GET /api/v1/events`
- `GET /api/v1/events/upcoming`
- `GET /api/v1/events/{event_id}`
- `POST /api/v1/events`
- `PUT /api/v1/events/{event_id}`
- `DELETE /api/v1/events/{event_id}`

### Event Registrations

Recommended stable endpoints:

- `POST /api/v1/registrations`
- `GET /api/v1/registrations/user`
- `GET /api/v1/registrations/event/{event_id}`
- `GET /api/v1/registrations/all`
- `POST /api/v1/registrations/{registration_id}/check-in`

## Current-to-Target Mapping

### Keep

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/unverified-users`
- `POST /api/v1/auth/verify-user/{user_id}`
- `GET /api/v1/alumni`
- `GET /api/v1/alumni/{id}`
- `PUT /api/v1/alumni/{id}`
- `POST /api/v1/alumni/{id}/profile-picture`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{user_id}`
- `POST /api/v1/admin/users`
- `PUT /api/v1/admin/users/{user_id}`
- `DELETE /api/v1/admin/users/{user_id}`
- `PUT /api/v1/admin/users/{user_id}/role`
- `GET /api/v1/admin/roles`
- `GET /api/v1/admin/dashboard/stats`
- `GET /api/v1/admin/dashboard/recent-activity`
- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/alumni/{alumni_id}`
- `GET /api/v1/documents/{document_id}`
- `DELETE /api/v1/documents/{document_id}`
- `GET /api/v1/documents/search`
- `GET /api/v1/documents/pending/all`
- `POST /api/v1/document-requests/`
- `GET /api/v1/document-requests/`
- `GET /api/v1/document-requests/{request_id}`
- `GET /api/v1/document-requests/admin`
- `PUT /api/v1/document-requests/{request_id}/update`
- `POST /api/v1/document-requests/{request_id}/generate`
- `GET /api/v1/document-requests/{request_id}/download`

### Change

- legacy `users` mixed document
  - split into `users` and `alumni_profiles`
- current `POST /api/v1/alumni`
  - keep it as profile create/update compatibility until frontend fully shifts
- current `GET /api/v1/alumni/user/{user_id}`
  - treat as convenience lookup, not canonical contract
- current `password_hash` vs `hashed_password`
  - standardize to `password_hash`

### Remove Later

- `/api/v1/alumni/simple`
- `/api/v1/alumni/{id}/simple`

Those wrappers add response-shape noise without solving a real modeling problem.

## Frontend Mismatch Summary

Current frontend-expected backend families are now implemented for:

- `/auth/csrf-token`
- password reset endpoints
- MFA endpoints
- `/admin/verifications*`
- `/admin/permissions`
- `/documents/*`
- `/document-requests/*`
- `/verification/blockchain/*`
- `/events/*`
- `/registrations/*`
- `/references/courses`

Known frontend/backend compatibility caveats still to watch:

- mixed response envelope styles remain by endpoint family (intentional compatibility during transition)
- legacy convenience wrappers (`/alumni/simple`, `/alumni/{id}/simple`) still exist
- several frontend pages rely on fallback parsing for older response keys

Recommended build order now:

1. stabilize auth contract
   status: mostly done
2. split `users` and `alumni_profiles`
   status: done with startup migration and route usage
3. add admin dashboard and verification flows
   status: basic version done
4. add documents and document requests
   status: basic version done
5. add events and registrations
   status: done
6. add notifications and audit logging polish
   status: pending

## Bottom Line

For a cleaner and more efficient backend:

- use `users` for auth and role checks
- use `alumni_profiles` for profile data
- keep one canonical password field: `password_hash`
- stop letting route contracts depend on legacy Mongo shapes
- build the API around domain resources, not around convenience patches on `users`

That gives the project one clear connection map:

- auth lives in `users`
- profile lives in `alumni_profiles`
- feature modules reference `user_id`
- admin and frontend both consume one stable API contract

## Cleanliness Verified (Current Pass)

Verification completed with backend tests in `backend/tests`:

- `test_register.py` (auth core)
- `test_api_cleanliness.py` (contract, authz matrix, token lifecycle, and feature flows)

Covered route groups in automated tests:

- references: `/references/courses`
- alumni: `/alumni/me`
- admin permissions and verifications
- registrations attendees + check-in QR + transition validation
- blockchain verification store/verify/history
- auth reset-password, verify-reset-token, reset-password-confirm
- MFA setup/enable/status/disable
- security-question recovery flow

Current residual risks:

- production-hardening for custom token implementation still recommended
- broader pagination/edge-case tests can be expanded for large datasets
- response-shape unification can be tightened further after frontend cleanup removes compatibility aliases
