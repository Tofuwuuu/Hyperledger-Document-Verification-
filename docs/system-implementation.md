# CVSU Alumni Verification System — Implementation Documentation

**Project:** CVSU Carmona Alumni Profile with Blockchain Document Verification  
**Role context:** Full-stack implementation (frontend, backend API, database, blockchain integration)  
**Live demo:** [Frontend on Render](https://alumni-frontend-4r7o.onrender.com) · API (local): `http://localhost:8000`

This document describes **how the system was implemented** — architecture, modules, data flow, and key technical decisions. Use it as portfolio or resume support material.

---

## 1. Project Overview

The CVSU Alumni Verification System is a web platform for CVSU Carmona alumni to manage profiles, request official documents, register for events, and verify document authenticity using a blockchain-backed ledger.

### Core capabilities

| Module | What it does |
|---|---|
| **Authentication** | Registration, login, JWT sessions, MFA, password reset, security questions |
| **Alumni profiles** | Profile CRUD, directory listing, profile picture upload |
| **Document management** | Upload, preview, download, admin approval workflow |
| **Blockchain verification** | SHA-256 hashing, Hyperledger Fabric storage, public hash verification |
| **Document requests** | Alumni request official documents; admin review and generation |
| **Events & registrations** | Event CRUD, QR-based check-in, quick registration links |
| **Admin panel** | User verification, role management, verification queue, dashboard |
| **Meetings & notifications** | Virtual meeting scheduling (Jitsi), in-app notifications |

---

## 2. System Architecture

The application follows a **three-tier architecture** with a dedicated blockchain gateway layer.

```text
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                        │
│  AuthContext · Service layer · Protected routes · Lazy loading   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / JSON (axios)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Python)                        │
│  Routers · JWT auth · Pydantic schemas · Motor (async MongoDB)    │
│  BlockchainManager · File uploads · OpenAPI (/docs)               │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌─────────────────────────────────┐
│   MongoDB                │    │  Fabric Gateway (Node.js/Express) │
│   users, profiles,       │    │  @hyperledger/fabric-gateway SDK  │
│   documents, events,     │    │  gRPC → peer0.org1.example.com    │
│   registrations, etc.    │    └─────────────────────────────────┘
└──────────────────────────┘
```

### Deployment topology

Services are orchestrated with **Docker Compose**:

| Service | Port | Purpose |
|---|---:|---|
| `frontend` | 5173 | React SPA (Vite dev / production build) |
| `backend` | 8000 | FastAPI REST API |
| `mongodb` | 27017 | Primary data store |
| `fabric-gateway` | 3001 | Hyperledger Fabric chaincode bridge |
| `mongo-express` | 8081 | MongoDB admin UI (dev) |
| `blockchain-explorer` | 8080 | Static blockchain explorer mock |

Production frontend is deployed on **Render**; backend runs locally or in Docker depending on environment.

---

## 3. Technology Stack

### Frontend

| Technology | Usage |
|---|---|
| **React 18** | UI components and page routing |
| **Vite** | Build tool and dev server |
| **React Router v6** | Client-side routing with protected/admin routes |
| **Axios** | HTTP client with interceptors for JWT refresh |
| **Tailwind CSS + Chakra UI** | Styling and component library |
| **Formik + Yup** | Form validation |
| **react-toastify** | User feedback notifications |

### Backend

| Technology | Usage |
|---|---|
| **FastAPI** | Async REST API framework |
| **Uvicorn** | ASGI server |
| **Motor** | Async MongoDB driver |
| **Pydantic / pydantic-settings** | Request validation and configuration |
| **bcrypt** | Password hashing |
| **Custom JWT (HMAC-SHA256)** | Access and refresh tokens |
| **httpx** | Async HTTP client for Fabric Gateway |

### Blockchain

| Technology | Usage |
|---|---|
| **Hyperledger Fabric** | Permissioned blockchain network |
| **Node.js Fabric Gateway** | Express service wrapping `@hyperledger/fabric-gateway` |
| **Chaincode** | `final-smart-contract` on `alumni-channel` |
| **gRPC + TLS** | Secure peer communication |

### Database

| Collection | Purpose |
|---|---|
| `users` | Accounts, roles, verification status, MFA |
| `alumni_profiles` | Extended alumni profile data |
| `documents` | Uploaded files, hashes, verification status |
| `document_requests` | Official document request workflow |
| `events` | Alumni events and metadata |
| `event_registrations` | Registration and attendance records |
| `verification_requests` | Blockchain proof audit trail |
| `roles` | RBAC role definitions |

Indexes are created at startup via `initialize_database()` for email uniqueness, event dates, and registration lookups.

---

## 4. Backend Implementation

### 4.1 API structure

All routes are mounted under `/api/v1` in `backend/app/main.py`:

```text
backend/app/
├── main.py                    # FastAPI app, CORS, router registration
├── config.py                  # Environment settings (MongoDB, CORS, secrets)
├── api/
│   ├── register.py            # Auth: register, login, MFA, password reset
│   └── endpoints/
│       ├── alumni.py          # Profile CRUD and directory
│       ├── admin.py           # Admin dashboard, user verification
│       ├── admin_roles.py     # Role and permission management
│       ├── documents.py       # Upload, preview, download, reject
│       ├── document_requests.py
│       ├── events.py          # Event management and QR codes
│       ├── registrations.py   # Event registration and check-in
│       ├── verification.py    # Blockchain store/verify/history
│       ├── meetings.py        # Virtual meeting endpoints
│       └── notifications.py   # Notification endpoints
├── services/
│   └── blockchain_manager.py  # Unified blockchain interface
├── clients/
│   └── fabric_client.py       # HTTP client to Fabric Gateway
├── db/
│   ├── session.py             # Motor client singleton
│   ├── collections.py         # Collection accessors
│   └── bootstrap.py           # Index creation, seed data
└── utils/
    └── auth.py                # JWT create/decode, get_current_user
```

OpenAPI documentation is available at `/docs` and `/openapi.json`.

### 4.2 Authentication implementation

**Registration flow:**
1. User submits email, password, and full name via `POST /api/v1/auth/register`
2. Password is hashed with **bcrypt** before storage
3. User record is created with `is_verified: false`
4. Admin must approve the account before full access

**Login flow:**
1. `POST /api/v1/auth/login` validates credentials against bcrypt hash
2. Server issues a **JWT access token** (HMAC-SHA256, configurable expiry)
3. Refresh token support via `POST /api/v1/auth/refresh`
4. Protected routes use `get_current_user` dependency (Bearer token)

**Additional security features:**
- MFA setup/enable/disable (`/auth/mfa/*`)
- Password reset with token verification
- Security questions for account recovery
- Role-based access: `is_admin` flag and dedicated admin dependencies

### 4.3 Document workflow

```text
Alumni uploads document
        │
        ▼
POST /documents/upload  →  File saved to uploads/
        │                  SHA-256 hash computed
        │                  MongoDB record: status = pending
        ▼
Admin reviews in verification queue
        │
        ├── Approve → POST /admin/verifications/{id}/approve
        │              Optional: POST /verification/blockchain/store
        │              Hash written to Fabric ledger
        │
        └── Reject  → POST /documents/{id}/reject
```

**File handling:**
- Multipart upload via FastAPI `UploadFile`
- Files stored under `backend/uploads/` with UUID-based naming
- SHA-256 digest stored as `file_hash` on the document record
- Preview and download served via `FileResponse` with ownership checks

### 4.4 Blockchain integration

The blockchain layer uses a **manager pattern** with mock/real mode switching:

```text
verification.py (API)
        │
        ▼
BlockchainManager (Python)
        │
        ├── USE_REAL_BLOCKCHAIN=false  →  Mock in-memory ledger
        │
        └── USE_REAL_BLOCKCHAIN=true   →  FabricClient (httpx)
                                              │
                                              ▼
                                        Fabric Gateway (Node.js)
                                              │
                                              ▼
                                        Hyperledger Fabric peer
                                        Chaincode: StoreDocument,
                                                   VerifyDocument,
                                                   VerifyHash
```

**Key implementation details:**

1. **Hash-only on chain** — Only the SHA-256 hash is stored on the ledger, not the file itself (privacy + efficiency).
2. **Dual verification modes** — Verify by `document_id + hash` or by raw hash alone (public verify page).
3. **Audit trail** — `verification_requests` collection stores transaction IDs and metadata alongside chain records.
4. **Graceful fallback** — If Fabric Gateway is unavailable, the manager returns a clear error instead of silent failure.

**Fabric Gateway endpoints:**

| Method | Path | Chaincode function |
|---|---|---|
| POST | `/documents` | `StoreDocument` |
| POST | `/documents/verify` | `VerifyDocument` |
| POST | `/hashes/verify` | `VerifyHash` |
| GET | `/health` | Connection status |

### 4.5 Events and registrations

**Events** (`events.py`):
- CRUD for alumni events with start/end dates, capacity, and categories
- SVG-based QR code generation for registration and attendance
- Active/upcoming event filtering for the public events page

**Registrations** (`registrations.py`):
- Alumni register via `POST /registrations`
- Admin views attendees with statistics
- QR check-in: `POST /registrations/check-in-qr`
- Quick registration links: `POST /registrations/quick-register/{eventId}/{token}`
- Status transitions: `registered` → `attended` → `cancelled`

### 4.6 Document requests

Alumni can request official documents (transcripts, certificates, etc.):

1. `POST /document-requests/` — Submit request with document type and purpose
2. Admin reviews via `GET /document-requests/admin`
3. Admin updates status: `PUT /document-requests/{id}/update`
4. On approval, admin generates the document: `POST /document-requests/{id}/generate`
5. Alumni downloads: `GET /document-requests/{id}/download`

Document types are normalized via `app/constants/document_types.py` for consistent labeling across frontend and backend.

---

## 5. Frontend Implementation

### 5.1 Application structure

```text
frontend/src/
├── App.jsx                 # Router, lazy-loaded pages, route guards
├── context/
│   └── AuthContext.jsx     # Global auth state, token refresh, session
├── services/
│   ├── api.js              # Axios instance, interceptors, API modules
│   ├── authService.js      # Auth-specific API calls
│   ├── document.js         # Document verification helpers
│   └── eventService.js     # Event API calls
├── pages/
│   ├── auth/               # Login, Register
│   ├── dashboard/          # Alumni dashboard, documents, profile
│   ├── admin/              # Admin panel (15+ pages)
│   └── VerifyPage.jsx      # Public document verification
├── layouts/
│   ├── MainLayout.jsx      # Public pages
│   └── DashboardLayout.jsx # Authenticated shell
└── utils/
    ├── authUtils.js        # Token storage, validation, refresh logic
    └── profile-helpers.js  # Profile data normalization
```

### 5.2 Routing and access control

Routes are organized into three tiers:

| Tier | Guard | Examples |
|---|---|---|
| **Public** | None | `/`, `/about`, `/verify`, `/events` |
| **Protected** | `ProtectedRoute` (JWT required) | `/dashboard`, `/profile`, `/documents` |
| **Admin** | `AdminRoute` (JWT + `is_admin`) | `/admin`, `/admin/verifications`, `/admin/events` |

Pages are **lazy-loaded** with `React.lazy()` and `Suspense` to reduce initial bundle size.

### 5.3 Authentication state management

`AuthContext` provides global auth state:

- On mount: validates stored JWT, fetches `/auth/me`
- Token refresh: automatic refresh via axios interceptor when token nears expiry
- Session modes: "remember me" (localStorage) vs temporary (sessionStorage)
- Post-login redirect: saves attempted URL in `sessionStorage` and restores after login

### 5.4 API service layer

`services/api.js` centralizes all backend communication:

- Axios instance with `baseURL` from `config.js` (`VITE_API_URL`)
- Request interceptor: attaches `Authorization: Bearer <token>`
- Response interceptor: handles 401 → refresh token → retry queued requests
- Modular exports: `documentService`, `verificationService`, `eventService`, etc.

### 5.5 Key UI features

| Feature | Implementation |
|---|---|
| **Public verification** | `VerifyPage.jsx` — drag-and-drop file upload, hash computed client-side, verified against blockchain API |
| **Admin verification queue** | `AdminVerificationPage.jsx` — pending documents, approve/reject with blockchain tx details |
| **Event QR codes** | Generated server-side as SVG data URIs, displayed in event detail and admin pages |
| **Document requests** | `DocumentRequestForm.jsx` + admin review panel |
| **MFA setup** | `MFASetup.jsx` + `MFAVerification.jsx` components |
| **Virtual meetings** | `JitsiMeeting.jsx` + `MeetingScheduler.jsx` for admin-scheduled sessions |

---

## 6. End-to-End Data Flows

### 6.1 Alumni registration and verification

```text
User registers (frontend)
    → POST /auth/register (backend)
    → User stored in MongoDB (is_verified: false)
    → Admin sees user in verification queue
    → Admin approves via POST /auth/verify-user/{id}
    → User can log in and access dashboard
    → Alumni creates profile via POST /alumni/simple
```

### 6.2 Document upload and blockchain proof

```text
Alumni uploads PDF (frontend)
    → POST /documents/upload (multipart)
    → Backend saves file, computes SHA-256, stores in MongoDB
    → Admin reviews in AdminVerificationPage
    → Admin approves → POST /verification/blockchain/store
    → BlockchainManager → FabricClient → Fabric Gateway
    → Chaincode StoreDocument writes hash to ledger
    → MongoDB updated: verification_status = verified, blockchain_tx_id set
```

### 6.3 Public document verification

```text
Anyone visits /verify (no login required)
    → Uploads file or enters document ID
    → Frontend computes SHA-256 hash (js-sha256)
    → POST /verification/blockchain/verify-file
    → Backend queries Fabric ledger via VerifyDocument / VerifyHash
    → Returns VERIFIED or FAKE status with metadata
```

### 6.4 Event registration with QR check-in

```text
Admin creates event → QR code generated
    → Alumni registers via POST /registrations
    → At event: admin scans QR → POST /registrations/check-in-qr
    → Registration status updated to attended
    → Admin views attendee statistics
```

---

## 7. Configuration and Environment

Key environment variables (backend / Docker Compose):

| Variable | Purpose |
|---|---|
| `MONGODB_URL` | MongoDB connection string |
| `SECRET_KEY` | JWT signing secret |
| `CORS_ORIGINS` | Allowed frontend origins |
| `BLOCKCHAIN_ENABLED` | Enable blockchain features |
| `USE_REAL_BLOCKCHAIN` | Use Fabric vs mock ledger |
| `FABRIC_GATEWAY_URL` | Fabric Gateway service URL |
| `CHAINCODE_NAME` | Smart contract name |
| `CHANNEL_NAME` | Fabric channel name |

Frontend:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_BLOCKCHAIN_ENABLED` | Show blockchain UI features |

---

## 8. Testing and Quality

- **Smoke tests** in `backend/tests/test_smoke_workflows.py` cover end-to-end flows: registration, profile upload, document approval, and public verification.
- **API contract audit** documented in `docs/frontend-api-schema.md` — maps ~70 frontend-called endpoints to backend implementations.
- **OpenAPI** auto-generated at `/docs` for interactive API exploration.

---

## 9. Resume and Portfolio Highlights

### Skills demonstrated

- Full-stack web development (React + FastAPI)
- REST API design with OpenAPI documentation
- JWT authentication, MFA, and role-based access control
- MongoDB schema design with async Motor driver
- File upload handling and SHA-256 document hashing
- Hyperledger Fabric integration via gateway pattern
- Docker Compose multi-service orchestration
- Cloud deployment (Render)

### Example resume bullets

Adapt these with your specific contributions:

- *Built a full-stack alumni management platform (React, FastAPI, MongoDB) with JWT authentication, MFA, role-based admin panel, and 70+ REST API endpoints.*
- *Implemented blockchain-backed document verification using Hyperledger Fabric — SHA-256 hashes stored on-chain via a Node.js Fabric Gateway, with public verification page for tamper detection.*
- *Designed document lifecycle workflow: upload → admin review → blockchain proof → public hash verification, with audit trail in MongoDB.*
- *Developed event management module with QR-based registration and attendance check-in for alumni gatherings.*
- *Containerized the full stack (frontend, backend, MongoDB, Fabric gateway) with Docker Compose for reproducible local and deployment environments.*
- *Deployed frontend to Render; documented API contracts and conducted frontend-backend schema audit to resolve integration gaps.*

### Portfolio talking points

When presenting this project:

1. **Problem** — Alumni need a trusted way to verify official documents; manual verification is slow and forgeable.
2. **Solution** — Web platform with blockchain-anchored document hashes; anyone can verify authenticity without contacting the university.
3. **Architecture** — Separation of concerns: React SPA, FastAPI API layer, MongoDB for application data, Fabric for immutable proof.
4. **Trade-offs** — Hash-only on chain (not full files) for privacy; mock mode for development without a live Fabric network.
5. **Scale** — Async Motor driver, lazy-loaded frontend routes, indexed MongoDB collections.

---

## 10. Project Structure Reference

```text
FINAL/
├── frontend/              # React + Vite SPA
├── backend/               # FastAPI application
│   ├── app/               # Application code
│   ├── tests/             # Smoke and workflow tests
│   ├── uploads/           # Document file storage
│   └── run.py             # Uvicorn entry point
├── fabric-gateway/        # Node.js Hyperledger Fabric bridge
├── fabric-network/        # Fabric network crypto and config
├── blockchain-explorer/   # Static explorer UI
├── docs/                  # Project documentation
├── docker-compose.yml     # Multi-service orchestration
└── package.json           # Root scripts (start frontend + backend)
```

---

*Document version: 1.0 · CVSU Alumni Verification System · Implementation Documentation*
