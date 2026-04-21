# Backend Schema And API Audit

## Snapshot

This document reflects the code currently mounted by the local FastAPI backend in `backend/app` and the local MongoDB database `cvsu_alumni` on April 21, 2026.

The current backend is a small FastAPI service with:

- one active MongoDB database: `cvsu_alumni`
- one collection actively used by code paths: `users`
- two active route modules:
  - `app.api.register`
  - `app.api.endpoints.alumni`

Important caveat:

- the frontend still expects a much larger API surface than the backend currently implements
- the database already contains legacy collections and mixed user document shapes from an older backend

## Runtime Route Map

Registered routes in the current FastAPI app:

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
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

Route sources:

- [backend/app/main.py](/e:/Projects/FINAL/backend/app/main.py)
- [backend/app/api/register.py](/e:/Projects/FINAL/backend/app/api/register.py)
- [backend/app/api/endpoints/alumni.py](/e:/Projects/FINAL/backend/app/api/endpoints/alumni.py)

## Current Data Model

### Implemented Domain Model

The current backend does not separate auth users and alumni profiles into different collections.

Instead, it stores both in the same `users` document.

Effective current model:

```json
{
  "_id": "ObjectId",
  "full_name": "string",
  "email": "string",
  "password_hash": "bcrypt hash",
  "is_admin": false,
  "is_verified": false,
  "created_at": "datetime",
  "updated_at": "datetime",

  "student_id": "string",
  "phone": "string",
  "graduation_year": "string",
  "batch": "string",
  "course": "string",
  "department": "string",
  "sex": "string",
  "civil_status": "string",
  "birthday": "string",
  "region_of_origin": "string",
  "address": "string",
  "bio": "string",
  "profile_picture": "uploads/file.ext",
  "current_job": "string",
  "current_employer": "string"
}
```

### Auth Fields Used In Code

Used by `register.py`:

- `full_name`
- `email`
- `password_hash`
- `is_admin`
- `is_verified`
- `created_at`

Returned to clients:

- `id`
- `email`
- `full_name`
- `student_id`
- `graduation_year`
- `is_admin`
- `is_verified`

### Alumni/Profile Fields Used In Code

Declared in [backend/app/schemas/alumni_profile.py](/e:/Projects/FINAL/backend/app/schemas/alumni_profile.py):

- `user_id`
- `full_name`
- `email`
- `student_id`
- `phone`
- `graduation_year`
- `batch`
- `course`
- `department`
- `sex`
- `civil_status`
- `birthday`
- `region_of_origin`
- `address`
- `bio`
- `profile_picture`
- `current_job`
- `current_employer`

Also important:

- `extra = "allow"` means additional undeclared fields can still be accepted and written into the `users` document

## MongoDB Collections

Collections currently present in local `cvsu_alumni`:

- `alumni`
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

Only `users` is actively used by the current backend code.

### Sample Collection Shapes

Observed first-document keys in local MongoDB:

- `alumni`
  - `_id, created_at, email, full_name, graduation_year, profile_completed, student_id, updated_at, user_id`
- `users`
  - `_id, created_at, email, full_name, hashed_password, is_active, is_admin, is_verified, password_hash, updated_at, verification_pending`

This is a strong sign that the database contains legacy records from an older application version.

## Schema Drift

### Mixed Password Fields

The current code reads:

- `password_hash`

But local MongoDB already contains legacy user docs with:

- `hashed_password`

Some documents currently contain both fields.

Impact:

- users created by the old backend may not authenticate correctly in the new backend
- users created by the new backend may look inconsistent in MongoDB Compass
- code that assumes one password field will behave unpredictably against legacy records

### Mixed User Shapes

Legacy-style user fields seen in MongoDB:

- `hashed_password`
- `is_active`
- `verification_pending`

Current-code user fields:

- `password_hash`
- `is_verified`
- no explicit `is_active`

### Parallel Legacy Collections

There is a separate `alumni` collection in MongoDB, but the current backend does not use it.

Impact:

- some older UI or scripts may still expect alumni profiles in `alumni`
- current FastAPI code reads and writes alumni profile data into `users`

## API Reference

### Auth API

#### `POST /api/v1/auth/register`

Purpose:

- create a new user in `users`

Request body:

```json
{
  "full_name": "string",
  "email": "user@example.com",
  "password": "string",
  "confirm_password": "string"
}
```

Behavior:

- normalizes email to lowercase
- validates password confirmation
- hashes password with `bcrypt`
- inserts into `users`

Response shape:

```json
{
  "success": true,
  "user": {
    "id": "string",
    "email": "string",
    "full_name": "string",
    "student_id": null,
    "graduation_year": null,
    "is_admin": false,
    "is_verified": false
  }
}
```

#### `POST /api/v1/auth/login`

Purpose:

- authenticate by `email` and `password`

Request body:

```json
{
  "email": "user@example.com",
  "password": "string",
  "remember": false
}
```

Behavior:

- normalizes email
- looks up user in `users`
- validates `password_hash` via `bcrypt.checkpw`
- returns simplified user payload

Response shape:

```json
{
  "success": true,
  "user": {
    "id": "string",
    "email": "string",
    "full_name": "string",
    "student_id": "string|null",
    "graduation_year": "string|null",
    "is_admin": false,
    "is_verified": false
  }
}
```

Current limitations:

- no JWT
- no refresh token
- no `/auth/me`
- no logout endpoint
- no password reset flow

### Alumni API

#### `GET /api/v1/alumni/health`

- simple health check for alumni routes

#### `GET /api/v1/alumni/user/{user_id}`

- fetches a `users` document by `_id` or `user_id`
- returns `200 null` if not found

#### `GET /api/v1/alumni/{alumni_id}`

- fetches a `users` document by `_id`
- returns `404` if not found or if `alumni_id` is invalid

#### `POST /api/v1/alumni`

- updates an existing user document using `payload.user_id`
- does not insert a separate alumni record
- acts like "complete profile for an existing user"

#### `PUT /api/v1/alumni/{alumni_id}`

- partial update of an existing user document
- strips sensitive fields like `password_hash`, `hashed_password`, and `is_admin`

#### `POST /api/v1/alumni/simple`

- wrapper around `POST /api/v1/alumni`
- returns `{ success, id, profile }`

#### `PUT /api/v1/alumni/{alumni_id}/simple`

- wrapper around `PUT /api/v1/alumni/{alumni_id}`
- returns `{ success, id, profile }`

#### `GET /api/v1/alumni`

- lists documents from `users`

Query params:

- `offset`
- `limit`

Response:

```json
{
  "results": [],
  "total": 0,
  "offset": 0,
  "limit": 25
}
```

#### `GET /api/v1/alumni/list`

- alias for `GET /api/v1/alumni`

#### `POST /api/v1/alumni/{alumni_id}/profile-picture`

- saves file into local `backend/uploads`
- updates `profile_picture` in the matching `users` document

## Frontend To Backend Mismatch

The frontend still expects many endpoints that do not exist in the current backend.

### Route Families Expected By Frontend

Observed in frontend code:

- `/auth/me`
- `/auth/refresh`
- `/auth/logout`
- `/auth/csrf-token`
- `/auth/reset-password`
- `/auth/verify-reset-token`
- `/auth/reset-password-confirm`
- `/auth/mfa/status`
- `/auth/mfa/setup`
- `/auth/mfa/enable`
- `/auth/mfa/disable`
- `/auth/set-security-questions`
- `/auth/verify-security-questions`
- `/auth/unverified-users`
- `/auth/verify-user/{userId}`
- `/admin/users`
- `/admin/roles`
- `/admin/permissions`
- `/admin/verifications`
- `/admin/dashboard/*`
- `/documents/*`
- `/document-requests/*`
- `/verification/blockchain/*`
- `/references/courses`

Relevant frontend files:

- [frontend/src/context/AuthContext.jsx](/e:/Projects/FINAL/frontend/src/context/AuthContext.jsx)
- [frontend/src/services/api.js](/e:/Projects/FINAL/frontend/src/services/api.js)
- [frontend/src/services/authService.js](/e:/Projects/FINAL/frontend/src/services/authService.js)

### What This Means

The frontend was built against a larger platform backend, but the current FastAPI app only implements:

- basic register/login
- basic alumni profile CRUD
- profile picture upload

Everything else is currently either:

- missing
- stale
- or only present as old database artifacts

## ERD-Style Map

Current implemented model:

```text
users
  _id (ObjectId) PK
  full_name
  email
  password_hash
  is_admin
  is_verified
  created_at
  updated_at
  student_id
  graduation_year
  phone
  batch
  course
  department
  sex
  civil_status
  birthday
  region_of_origin
  address
  bio
  profile_picture
  current_job
  current_employer
```

Legacy / intended model suggested by database + frontend:

```text
users
  1 -> 1 alumni_profiles
  1 -> many document_requests
  1 -> many documents
  1 -> many notifications
  1 -> many event_registrations

events
  1 -> many event_registrations

documents
  1 -> many verification_requests
```

That larger model is not implemented in the current backend code yet.

## Cleanup Recommendations

### Immediate

- choose one canonical password field:
  - prefer `password_hash`
- write a one-time migration to convert legacy `hashed_password` documents
- choose one canonical place for alumni profile data:
  - either keep it embedded in `users`
  - or move it into `alumni`
- make backend and frontend agree on the same auth contract

### Recommended Short-Term Backend Shape

- `users`
  - auth and role fields only
- `alumni_profiles`
  - profile and academic fields
- `documents`
- `document_requests`
- `verification_requests`
- `events`
- `event_registrations`
- `notifications`

### Recommended API Stabilization Order

1. finalize auth contract
   - `register`
   - `login`
   - `me`
   - `logout`
2. finalize user/profile contract
   - `users`
   - `alumni_profiles`
3. reintroduce admin and document endpoints only after schema is stable

## Current Truth Table

Implemented now:

- basic register
- basic login
- basic alumni profile CRUD
- profile picture upload

Present in MongoDB but not implemented by current backend:

- `alumni`
- `documents`
- `document_requests`
- `events`
- `event_registrations`
- `notifications`
- `verification_requests`

Expected by frontend but missing from current backend:

- most `/auth/*` beyond login/register
- all `/admin/*`
- all `/documents/*`
- all `/document-requests/*`
- all `/verification/*`
- `/references/courses`

