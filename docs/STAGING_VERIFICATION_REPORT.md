# StudyNotion — Comprehensive Staging Deployment & External Integration Verification Report

> **Document Version:** 1.0.0  
> **Cycle:** Cycle #14.1 — Staging Deployment & External Integration Verification  
> **Date:** November 21, 2026  
> **Prepared by:** Senior DevOps Engineer, Site Reliability Engineer, MERN Stack Architect & Production Deployment Specialist  
> **Status:** AUDITED & STAGED (Awaiting External Provider Credential Provisioning & Human Migration Approval)  

---

## 1. Executive Summary

Following the completion of QA Cycle #14 (which resolved all 8 prioritized security findings, implemented database connection pooling, distributed rate limiting, binary magic-byte validation, Winston structured logging, Sentry APM, health check probes, and GitHub Actions CI), **Cycle #14.1** establishes the staging infrastructure verification framework and bridges local automated verification to live external cloud operations.

### Scope & Guardrails
- **Zero Production Mutations:** No production data was altered; no live database writes were initiated.
- **Zero Real Financial Transactions:** All payment flows are restricted strictly to Razorpay Test Mode (`rzp_test_*`).
- **Zero Spam Dispatches:** No real student or instructor email addresses were messaged; all transactional email paths utilize isolated test addresses or mock transports.
- **Strict Separation of Concerns:** Every external dependency (MongoDB Atlas, Redis cluster, Resend/SendGrid SMTP, Sentry APM, Cloudinary, and Razorpay) has been architecturally audited, locally verified, and cataloged with exact staging configuration manifests and explicit verification states.

---

## 2. Actual Deployment Architecture

### 2.1 Component & Infrastructure Topology

The application comprises a decoupled single-page frontend (React 18), a stateless REST API backend (Express 5 on Node.js 22), a durable background worker service, and six managed external cloud dependencies:

```mermaid
flowchart TD
    subgraph Client Tier
        UserBrowser["Student / Instructor Browser"]
        AdminBrowser["Platform Administrator"]
    end

    subgraph Edge & Static CDN Tier
        VercelEdge["Vercel Edge Network\n(React 18 + Redux Toolkit + HashRouter)\nStrict CORS & SameSite Cookie Jar"]
    end

    subgraph API Application Tier
        BackendAPI["Node.js 22 Express 5 API\n(/healthz, /readyz, Winston JSON Logger,\nSentry Node SDK, Rate Limiters)"]
    end

    subgraph Asynchronous Ingress & Processing
        RazorpayGateway["Razorpay Servers\n(Test Mode)"]
        WebhookEndpoint["POST /api/v1/payment/webhook\n(Raw Buffer Ingress + Dual-Secret HMAC)"]
        DurableInbox["MongoDB WebhookEvent Inbox\n(Unique eventId, Leases, Retries)"]
        WebhookWorker["Standalone Webhook Worker\n(claimNextEvent Lease Loop)"]
        EmailOutboxService["Durable Email Outbox\n(Exponential Backoff & Crash Recovery)"]
    end

    subgraph Managed Cloud Infrastructure
        MongoAtlas["MongoDB Atlas M10+\n(TLS/SSL, Connection Pool, Multi-AZ)"]
        RedisCluster["Redis Managed Instance\n(Shared Distributed Rate Limiting)"]
        EmailProvider["Transactional Email Provider\n(Resend / SendGrid / AWS SES)"]
        SentryAPM["Sentry Error Monitoring\n(Frontend & Backend Projects)"]
        CloudinaryCDN["Cloudinary Media Storage\n(Images & Video Lectures)"]
    end

    UserBrowser -->|HTTPS / WSS| VercelEdge
    AdminBrowser -->|HTTPS / WSS| VercelEdge
    VercelEdge -->|REST API Calls\nAuthorization: Bearer + Cookies| BackendAPI

    BackendAPI -->|Mongoose Pool\nmaxPoolSize: 20| MongoAtlas
    BackendAPI -->|Shared Store / RedisStore| RedisCluster
    BackendAPI -->|Exceptions & Traces| SentryAPM
    BackendAPI -->|Direct Enqueue| EmailOutboxService
    BackendAPI -->|Multipart Uploads\n(Magic Bytes Validated)| CloudinaryCDN

    RazorpayGateway -->|HTTPS S2S Webhook\nx-razorpay-signature| WebhookEndpoint
    WebhookEndpoint -->|HMAC-SHA256 Validated\nPersist RECEIVED Event| DurableInbox
    DurableInbox -.->|Atomic findOneAndUpdate\nstatus: PROCESSING| WebhookWorker
    WebhookWorker -->|Finalize Order & Enroll\nAuthoritative Price Check| MongoAtlas
    WebhookWorker -->|Enqueue Receipt| EmailOutboxService
    EmailOutboxService -->|SMTP / API Dispatch| EmailProvider
```

### 2.2 Hosting & Cloud Provider Architecture Summary
- **Frontend Hosting:** Vercel Edge Network (`vercel.json` SPA rewrite rule).
- **Backend API Hosting:** Containerized Node.js 22 Service (e.g., Render, Railway, AWS ECS, or Fly.io).
- **Database Provider:** MongoDB Atlas (M10+ recommended for continuous oplog Point-in-Time Recovery).
- **Rate Limiting / Distributed Cache:** Managed Redis (Upstash Redis, Redis Cloud, or AWS ElastiCache).
- **Transactional Email Provider:** Resend or SendGrid (swappable via `MAIL_PROVIDER` abstraction).
- **Observability & Error Tracking:** Sentry (Dual-project setup: `studynotion-frontend` and `studynotion-backend`).
- **Media Asset Storage:** Cloudinary (`studynotion_staging_uploads` folder).
- **Payment Gateway:** Razorpay (Test Mode keys `rzp_test_*` and dedicated staging webhook endpoint).
- **Worker Execution Model:** Dual-capable — runs embedded in single-process mode via `startWebhookWorker()` in `server/index.js`, or as an independent headless service via `npm --prefix server run worker:webhook`.

---

## 3. Staging Environment Variable Manifest

The following variables must be configured in the staging hosting environments. **No production credentials are used.**

### 3.1 Frontend Staging Manifest (Vercel Preview / Staging)
```bash
# Backend Ingress URL
REACT_APP_BASE_URL="https://staging-api.studynotion.com/api/v1"

# Razorpay Test Mode Key ID (Public)
REACT_APP_RAZORPAY_KEY_ID="rzp_test_placeholder_key"

# Observability
REACT_APP_SENTRY_DSN="https://placeholder_key@o000000.ingest.sentry.io/0000001"
REACT_APP_VERSION="studynotion-frontend@1.0.0-staging"
```

### 3.2 Backend Staging Manifest (Container / PaaS Environment)
```bash
# Application Runtime
NODE_ENV="staging"
PORT=4000
RELEASE_VERSION="studynotion@1.0.0-staging"

# CORS & Domain Isolation (SEC-001)
ALLOWED_ORIGINS="https://studynotion-staging.vercel.app,https://staging.studynotion.com"
FRONTEND_URL="https://studynotion-staging.vercel.app"

# Database Configuration (Phase 3)
MONGODB_URL="mongodb+srv://<staging_db_user>:<staging_db_password>@<staging_cluster>.mongodb.net/studynotion_staging?retryWrites=true&w=majority"
DB_MAX_POOL_SIZE=20
DB_MIN_POOL_SIZE=2
DB_SERVER_SELECTION_TIMEOUT_MS=5000
DB_SOCKET_TIMEOUT_MS=45000

# Authentication & Session Security (SEC-002, SEC-003, SEC-006)
JWT_SECRET="<staging_high_entropy_256bit_secret_openssl_rand_hex_32>"

# Distributed Rate Limiting (SEC-007)
REDIS_URL="rediss://default:<staging_redis_password>@<staging_redis_host>:<port>"
REQUIRE_DISTRIBUTED_RATE_LIMITING="true"

# Razorpay Test Mode Credentials (GAP-010, Phase 8)
RAZORPAY_KEY="rzp_test_placeholder_key"
RAZORPAY_SECRET="<staging_razorpay_test_secret>"
RAZORPAY_WEBHOOK_SECRET="<staging_razorpay_webhook_secret_32chars>"
RAZORPAY_WEBHOOK_OLD_SECRET=""

# Cloud Storage — Cloudinary (SEC-008)
CLOUD_NAME="<staging_cloudinary_cloud_name>"
API_KEY="<staging_cloudinary_api_key>"
API_SECRET="<staging_cloudinary_api_secret>"
FOLDER_NAME="studynotion_staging_uploads"

# Transactional Email Infrastructure (Phase 5)
MAIL_PROVIDER="resend" # Options: resend, sendgrid, smtp
RESEND_API_KEY="re_staging_placeholder_api_key"
MAIL_FROM="StudyNotion Staging <support@staging.studynotion.com>"

# Observability & APM (Phase 6 & 7)
LOG_LEVEL="info"
SENTRY_DSN="https://placeholder_key@o000000.ingest.sentry.io/0000002"
SENTRY_TRACES_SAMPLE_RATE=0.2
```

---

## 4. Phase-by-Phase Technical Verification

### Phase 4 — Redis & Distributed Rate Limiting Verification
- **Code Implementation:** Integrated `rate-limit-redis` and `ioredis` in `server/middlewares/rateLimiters.js`.
- **In-Memory Fallback Safety Analysis:**
  - *Risk Identified:* When multiple backend instances run behind a load balancer, silent in-memory fallback causes rate limit state to be isolated per node. An attacker sending traffic across 3 instances gets 3x the request quota.
  - *Mitigation Implemented:* Enhanced `getRateLimiterStatus()` and `GET /readyz`. If `REQUIRE_DISTRIBUTED_RATE_LIMITING=true` or in production when `REDIS_URL` is configured, a Redis disconnect transitions `/readyz` to `503 Service Unavailable` (`status: "degraded"`), preventing load balancers from routing traffic to nodes with broken distributed protection.
  - *Development & Test Isolation:* Development and local test suites cleanly operate without mandatory Redis (`NODE_ENV=test` and local dev without `REDIS_URL` report `mode: "in_memory"`, `isDistributed: false`, `status: "ready"`).
- **Status:** **TESTED LOCALLY & HARDENED IN CODE** (Awaiting external staging Redis cluster provisioning).

### Phase 5 — Transactional Email Verification
- **Code Implementation:** Multi-provider abstraction in `server/utils/mailSender.js` supporting Resend, SendGrid, and standard SMTP, combined with durable MongoDB outbox (`EmailOutbox.js` and `emailOutboxService.js`).
- **Resilience Capabilities:**
  - Idempotent upserts prevent duplicate dispatch for the same business event.
  - Exponential backoff retries (30s, 2m, 8m, 30m, 2h) across up to 5 attempts.
  - Permanent failure state (`FAILED`) when maximum attempts are exhausted.
  - Decoupled from database transactions so email delivery latency never delays payment finalization.
- **Verification Plan for Staging:**
  - Add DNS SPF (`v=spf1 include:... ~all`) and DKIM TXT records on staging domain.
  - Send controlled verification emails to synthetic test inbox (e.g. `test-staging@mailinator.com`).
- **Status:** **TESTED LOCALLY** (Awaiting DNS domain verification and staging provider API key).

### Phase 6 — Sentry APM & Redaction Verification
- **Code Implementation:** `server/config/sentry.js` and `src/utils/sentry.js`.
- **Privacy & Redaction Benchmarks:**
  - Authorization headers (`Authorization: Bearer ...`) and Cookie headers are stripped before dispatch in `beforeSend()`.
  - Passwords, `confirmPassword`, reset tokens, and OTP codes are redacted from request bodies.
  - Breadcrumb sanitization scrubs sensitive data on the frontend client.
  - Test mode suppresses all network dispatches to Sentry.
  - Controlled synthetic test route `GET /api/v1/sentry-test` is available in non-production environments to verify alert pipelines.
- **Status:** **TESTED LOCALLY** (Awaiting staging Sentry DSN configuration).

### Phase 7 — Health Checks & Webhook Worker Lifecycle Verification
- **Liveness Probe:** `GET /healthz` returns `200 OK` with service uptime, timestamp, and identifier without querying backing services.
- **Readiness Probe:** `GET /readyz` checks:
  - Database connection status via `database.getDatabaseHealth()` (`readyState === 1`).
  - Redis distributed rate limiter state (`isDistributed: true`).
- **Graceful Shutdown:** Process handlers for `SIGTERM` and `SIGINT` cleanly close HTTP server connections, stop the webhook worker leasing loop, and gracefully terminate the Mongoose connection pool (`database.closeDatabase()`).
- **Worker Recovery:** If the background worker process crashes mid-task, expired leases (`leaseUntil < Date.now()`) are automatically reclaimed by surviving worker instances.
- **Status:** **TESTED LOCALLY & VERIFIED IN REAL-DB INTEGRATION TESTS** (`BE-DB-29`).

### Phase 8 — Razorpay Test Mode Staging Verification
- **Ingress Architecture:**
  - Raw body buffer preserved via `express.raw({ type: "*/*", limit: "2mb" })` mounted on `/api/v1/payment/webhook` prior to `express.json()`.
  - Constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) with dual-secret rotation (`RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_OLD_SECRET`).
  - Durable persistence to `WebhookEvent` with unique index on `eventId` returning `200 OK` immediately for idempotent duplicate replays.
  - Asynchronous worker reconciliation via `finalizeCapturedPayment` guaranteeing atomic student enrollment, cart pruning, and receipt dispatch.
- **Razorpay Test Mode Runbook:** Staging setup documented in `docs/RAZORPAY_STAGING_RUNBOOK.md`.
- **Status:** **TESTED LOCALLY & VERIFIED IN REAL-DB INTEGRATION TESTS** (33 tests across `webhook.unit.test.js` and `BE-DB-21`–`30`).

### Phase 9 — Production Migration Dry-Run
- **Target Script:** `server/scripts/migrateInstructorApproval.js`.
- **Safety Hardening Applied:**
  - Script strictly defaults to **read-only dry-run reporting** (`dryRun: true`).
  - Write execution requires both the `--apply` CLI flag and the explicit environment variable `CONFIRM_MIGRATION_WRITE="CONFIRMED"`.
  - Script audits target database host/name and index presence before inspecting census.
  - Read-only census accurately tallies:
    - Total user population.
    - Students and Admins (guaranteed untouched).
    - Existing Approved, Pending, and Rejected instructors (guaranteed untouched).
    - Legacy instructors eligible for backfill.
- **Status:** **IMPLEMENTED IN CODE & TESTED LOCALLY** (Execution against production database is **PENDING HUMAN APPROVAL**).

### Phase 10 — Database Backups & Recovery Verification
- **Documented Procedure:** `docs/PRODUCTION_DISASTER_RECOVERY.md`.
- **Recovery Metrics:**
  - RPO: $\le 1$ Hour (backed by MongoDB Atlas continuous cloud backups and 1-minute oplog window).
  - RTO: $\le 30$ Minutes (new cluster restoration drill).
- **Atlas Audit Requirements:**
  - Verify continuous cloud backup is active on cluster.
  - Retain hourly snapshots for 24h, daily for 30d, weekly for 90d.
  - Restoration policy mandates restoring to a *new* cluster, running `server/scripts/verifyRestoredDatabase.js`, and switching the connection string — never restoring in-place.
- **Status:** **BLOCKED BY EXTERNAL CONFIGURATION** (Awaiting customer MongoDB Atlas admin dashboard access).

### Phase 11 — GitHub Actions CI Verification
- **Workflow File:** `.github/workflows/ci.yml`.
- **Pipeline Stages:**
  1. Frontend: Node 22 setup, `npm ci`, strict ESLint (`--max-warnings=0`), Jest unit tests (`npm test -- --watchAll=false --ci`), production build (`npm run build`).
  2. Backend: Node 22 setup, containerized service `mongo:8.0` on port 27017, `npm ci`, backend unit tests (`npm run test:unit`), real MongoDB integration tests (`npm run test:integration`).
- **Status:** **IMPLEMENTED IN CODE & TESTED LOCALLY** (Awaiting push to GitHub remote with user approval).

### Phase 12 — Security Review of Staging Configuration & SVG Handling
- **SVG Security Vulnerability Analysis:**
  - *Risk:* SVG is an XML document capable of embedding `<script>` tags, `<foreignObject>`, `onload` attributes, and external entities. Serving user-uploaded SVG avatars or thumbnails directly in browsers exposes users to Stored Cross-Site Scripting (XSS).
  - *Resolution Implemented:* Removed `.svg` from `ALLOWED_IMAGE_EXTS` in `server/utils/fileSignatureValidator.js`. The validator now explicitly detects `<svg` / `<?xml` magic headers and immediately rejects SVG uploads with an explicit security error: *"SVG image uploads are not permitted due to script execution (XSS) risks; please upload JPEG, PNG, GIF, or WebP."*
  - *Test Verification:* Verified with 2 new automated test cases in `server/__tests__/securityCycle14.test.js`.
- **Security Baseline:**
  - Strict CORS allowlisting (`corsConfig.js`).
  - SHA-256 token hashing for password resets (`tokenSecurity.js`).
  - Immediate JWT session revocation via `tokenVersion` (`User.js` & `auth.js`).
  - No reviewer PII in public ratings API (`RatingAndReview.js`).
  - Timing-neutral dummy bcrypt for missing users (`Auth.js`).
  - Tokens accepted strictly via `Authorization: Bearer` and secure `httpOnly` cookies.
- **Status:** **VERIFIED FIXED & TESTED LOCALLY**.

---

## 5. Master Verification Status Registry

Every platform component and integration is tracked under one of the 6 authorized states:

| Component / Subsystem | Category | Current Status | Notes / Blocker |
|---|---|---|---|
| **CORS Strict Allowlist** | Security | **TESTED LOCALLY** | Verified across 14 unit tests (`cors.test.js`) and live Playwright E2E (`E2E-42`). Ready for staging domain binding. |
| **Password Reset Token Hashing** | Security | **TESTED LOCALLY** | SHA-256 hashed storage verified in unit tests and real MongoDB integration (`BE-DB-16`). |
| **JWT Revocation (`tokenVersion`)** | Security | **TESTED LOCALLY** | Verified immediate invalidation upon password change in unit (`authMiddleware.test.js`) and E2E (`E2E-41`). |
| **Reviewer Email PII Exclusion** | Privacy | **TESTED LOCALLY** | Verified in `ratingReview.test.js`, `BE-DB-19`, and `E2E-42`. |
| **Timing-Neutral Auth Enumeration** | Security | **TESTED LOCALLY** | Dummy bcrypt comparison verified in `securityCycle14.test.js`. |
| **Header/Cookie Token Enforcement** | Security | **TESTED LOCALLY** | Request body tokens rejected; verified in `authMiddleware.test.js`. |
| **Binary Magic-Byte Upload Validation** | Security | **TESTED LOCALLY** | Verified in `securityCycle14.test.js` (JPEG, PNG, GIF, WebP, MP4, WebM). |
| **SVG Upload Rejection (Anti-XSS)** | Security | **TESTED LOCALLY** | Added in Cycle #14.1; verified in `securityCycle14.test.js`. |
| **Redis Distributed Rate Limiting** | Infrastructure | **BLOCKED BY EXTERNAL CONFIGURATION** | Fully implemented in code; tested locally with mock Redis and memory fallback. Awaiting staging Redis instance. |
| **Readiness Probe Redis Reporting** | Observability | **TESTED LOCALLY** | `/readyz` 503 gating verified in `securityCycle14.test.js`. |
| **Transactional Email Outbox** | Reliability | **TESTED LOCALLY** | Outbox schema, deduplication, and retry service verified in unit tests and real-DB tests. |
| **Staging Email Provider (Resend/SendGrid)**| Integration | **BLOCKED BY EXTERNAL CONFIGURATION** | Provider abstraction ready. Awaiting staging API key and domain SPF/DKIM verification. |
| **Sentry APM Frontend & Backend** | Observability | **BLOCKED BY EXTERNAL CONFIGURATION** | SDKs integrated with PII redaction and synthetic test route. Awaiting staging Sentry DSNs. |
| **Winston Structured JSON Logging** | Observability | **TESTED LOCALLY** | Implemented in `logger.js` and `requestLogger.js` with correlation IDs and deep PII/secret scrubbing. |
| **Liveness & Readiness Probes** | Reliability | **TESTED LOCALLY** | `/healthz` and `/readyz` mounted in `server/index.js` and tested via Supertest. |
| **Graceful Shutdown Handlers** | Reliability | **TESTED LOCALLY** | Handlers for SIGTERM/SIGINT verified in server lifecycle. |
| **Razorpay Test Mode Webhook Ingress** | Payments | **TESTED LOCALLY** | Raw buffer capture, HMAC verification, dual secrets verified across 23 unit tests (`webhook.unit.test.js`). |
| **Asynchronous Webhook Worker** | Payments | **TESTED LOCALLY** | Distributed lease acquisition and reconciliation verified across 10 real-DB tests (`BE-DB-21`–`30`). |
| **Live Staging Razorpay Delivery** | Payments | **BLOCKED BY EXTERNAL CONFIGURATION** | Runbook prepared (`RAZORPAY_STAGING_RUNBOOK.md`). Awaiting deployed HTTPS URL and Razorpay dashboard webhook registration. |
| **Instructor Approval Migration Dry-Run** | Database | **TESTED LOCALLY** | Read-only pre-flight runner verified in real-DB integration test (`BE-DB-13`). |
| **Production Migration Execution** | Database | **PENDING HUMAN APPROVAL** | Hardened with confirmation flag; awaiting human sign-off and backup verification. |
| **MongoDB Atlas Automated Backups** | Reliability | **BLOCKED BY EXTERNAL CONFIGURATION** | Disaster recovery runbook prepared (`PRODUCTION_DISASTER_RECOVERY.md`). Awaiting Atlas cluster dashboard verification. |
| **GitHub Actions CI Workflow** | CI/CD | **IMPLEMENTED IN CODE** | `.github/workflows/ci.yml` authored and validated locally. Awaiting push to GitHub remote with approval. |
| **Full Staging Regression** | QA Regression | **BLOCKED BY EXTERNAL CONFIGURATION** | Playwright test suites ready (`36/36` isolated E2E + `4/4` public regression pass locally). Awaiting deployed staging environment URL. |

---

## 6. Next Actions for Staging Deployment

To move the above items from **BLOCKED BY EXTERNAL CONFIGURATION** to **VERIFIED IN STAGING**:

1. **Host Backend on Staging PaaS:** Deploy container image or repository to staging backend host (e.g. Render / Railway).
2. **Configure Staging Environment Variables:** Input placeholder values from Section 3.2 into the host's secret management vault.
3. **Provision Staging Redis:** Spin up an instance (e.g. Upstash free tier) and set `REDIS_URL`.
4. **Deploy Frontend to Vercel Preview:** Set `REACT_APP_BASE_URL` pointing to the staging backend API.
5. **Configure Razorpay Test Webhook:** Follow `docs/RAZORPAY_STAGING_RUNBOOK.md` to register the HTTPS webhook endpoint in Razorpay Dashboard Test Mode.
6. **Trigger Sentry Synthetic Event:** Send a request to `GET /api/v1/sentry-test` and verify appearance in Sentry dashboard.
7. **Perform Migration Dry-Run:** Execute `node server/scripts/migrateInstructorApproval.js` against the staging MongoDB database.
8. **Execute Full Staging Regression:** Run automated regression suite against the deployed staging URL.
