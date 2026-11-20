# StudyNotion — Master Production Launch Checklist & Go/No-Go Gates

> **Document Version:** 1.0.0  
> **Prepared by:** Senior DevOps Engineer, Site Reliability Engineer & MERN Stack Architect  
> **Target Environment:** Production (Vercel Edge + Node 22 API Cluster + MongoDB Atlas M10+ + Redis)  
> **Release Target:** `studynotion@1.0.0`  
> **Sign-off Status:** PENDING STAGING INTEGRATION SIGN-OFF & HUMAN MIGRATION APPROVAL  

---

## 1. Executive Go/No-Go Decision Criteria

Production deployment will be executed **ONLY** if all gates pass with unanimous sign-off. A single failure or blocker in any gate triggers an immediate **NO-GO** and deployment postponement.

| Gate ID | Verification Domain | Requirement | Responsible Authority | Sign-off Status |
|---|---|---|---|---|
| **GATE-01** | **Quality & Test Assurance** | 455/455 tests passing; strict ESLint with 0 warnings; clean production frontend build. | QA Lead / Lead SRE | **GO (PASS)** |
| **GATE-02** | **Security Baseline** | All 8 security findings resolved (`SEC-001`–`SEC-008`); SVG upload rejected; timing-safe HMAC verified; JWT revocation enforced. | Security Architect | **GO (PASS)** |
| **GATE-03** | **Staging Payment Webhooks** | Real Razorpay Test Mode webhook reconciliation verified on deployed HTTPS staging endpoint. | Payments Engineer | **BLOCKED BY EXTERNAL CONFIGURATION** |
| **GATE-04** | **Observability & Health Probes** | `/healthz` and `/readyz` operational; Winston JSON logging active; Sentry alerting verified. | DevOps Engineer | **BLOCKED BY EXTERNAL CONFIGURATION** |
| **GATE-05** | **Database Backup Verification** | Verified MongoDB Atlas point-in-time snapshot with recovery drill successfully completed. | Production DBA | **BLOCKED BY EXTERNAL CONFIGURATION** |
| **GATE-06** | **Migration Dry-Run Sign-Off** | `migrateInstructorApproval.js --dry-run` executed against production replica; census audited; zero student/admin mutation confirmed. | System Architect | **PENDING HUMAN APPROVAL** |
| **GATE-07** | **Live Migration Execution** | Production database backfill executed with `CONFIRM_MIGRATION_WRITE="CONFIRMED"`. | Human Stakeholder / Architect | **PENDING HUMAN APPROVAL** |

---

## 2. Phase-by-Phase Launch Execution Sequence

```
                                PRODUCTION LAUNCH PIPELINE
                                
 ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
 │   PHASE 1: FREEZE    │ ──> │  PHASE 2: PRE-FLIGHT │ ──> │   PHASE 3: BACKUP    │
 │ Code Freeze & Tag    │     │ Staging Verification │     │ Atlas Snapshot PITR  │
 └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
                                                                       │
                                                                       ▼
 ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
 │   PHASE 6: INGRESS   │ <── │  PHASE 5: DEPLOYMENT │ <── │  PHASE 4: MIGRATION  │
 │ Live Razorpay Webhook│     │ Backend + Worker + FE│     │ Approved Atlas Write │
 └──────────────────────┘     └──────────────────────┘     └──────────────────────┘
            │
            ▼
 ┌──────────────────────┐     ┌──────────────────────┐
 │   PHASE 7: SMOKE     │ ──> │    PHASE 8: GO-LIVE  │
 │ End-to-End Smoke Test│     │ Monitoring & Sign-off│
 └──────────────────────┘     └──────────────────────┘
```

---

## 3. Detailed Stage Checklist

### Stage 1: Pre-Deployment Code & Infrastructure Audit
- [x] **Git Repository State Clean:** All working tree modifications committed in clean checkpoints; zero untracked scratch files.
- [x] **Local Test Baseline Re-verified:**
  - Frontend Jest: 120/120 tests pass.
  - Backend Unit: 240/240 tests pass.
  - Real MongoDB Integration: 30/30 tests pass.
  - Playwright Authenticated E2E: 36/36 tests pass.
  - Public Regression: 4/4 tests pass.
  - Total cumulative registry: 455/455 passing (100% pass rate).
- [x] **Strict Lint & Compilation:**
  - `npx eslint src --max-warnings=0` exits 0.
  - `npm run build` exits 0 with zero compilation errors.
- [x] **Secret Audit:** Verify that no `.env` files, private API keys, or database credentials are committed to Git.
- [ ] **GitHub Actions Remote Pipeline:** CI workflow triggered on remote repository and confirmed green. *(Status: PENDING PUSH APPROVAL)*

### Stage 2: External Infrastructure Provisioning
- [ ] **MongoDB Atlas Production Cluster:**
  - Cluster tier $\ge$ M10 provisioned in primary target region.
  - IP Access List restricted strictly to production backend container egress IPs.
  - TLS/SSL enforced; database username and password generated with 32+ character entropy.
  - Connection pooling configured: `DB_MAX_POOL_SIZE=20`, `DB_MIN_POOL_SIZE=2`.
- [ ] **Managed Redis Cluster:**
  - Redis 7+ instance provisioned with TLS (`rediss://`).
  - Auth token / password configured; maximum memory eviction policy configured (`volatile-lru`).
- [ ] **Transactional Email Provider (Resend / SendGrid / AWS SES):**
  - Production sending domain verified with SPF (`include:...`), DKIM, and DMARC TXT records.
  - Sender identity `support@studynotion.com` verified.
  - Provider API keys provisioned with send-only permissions.
- [ ] **Sentry APM Projects:**
  - Project `studynotion-backend` created; DSN generated.
  - Project `studynotion-frontend` created; DSN generated.
  - Alert rules configured for HTTP 500 errors and unhandled worker exceptions.
- [ ] **Cloudinary Production Storage:**
  - Dedicated production folder `studynotion_production_uploads` created.
  - Upload presets configured with image compression and strict format transformations.
- [ ] **Razorpay Production Account:**
  - Business KYC approved; production mode activated.
  - Production API Key ID (`rzp_live_*`) and Secret Key generated.
  - Webhook secret generated (high-entropy 32+ characters).

### Stage 3: Pre-Migration Safety & Backup Gate
- [ ] **Trigger On-Demand Atlas Snapshot:**
  - In MongoDB Atlas Dashboard, take a manual named snapshot: `pre-migration-launch-studynotion-v1`.
  - Confirm snapshot state transitions to `COMPLETED`.
- [ ] **Audit Backup Retention & PITR:**
  - Confirm continuous oplog backup stream is active.
  - Record the latest restorable timestamp (UTC).
- [ ] **Run Read-Only Migration Dry-Run:**
  ```bash
  node server/scripts/migrateInstructorApproval.js --dry-run
  ```
  - Verify census matches expected production user distribution.
  - Confirm zero mutations on Student and Admin records.
  - Confirm existing `APPROVED`, `PENDING`, and `REJECTED` accounts remain unchanged.
- [ ] **Obtain Formal Human Approval:** Present dry-run report to lead stakeholders and obtain explicit written sign-off before proceeding to Stage 4.

### Stage 4: Production Database Migration Execution
- [ ] **Execute Live Migration Backfill:**
  ```bash
  CONFIRM_MIGRATION_WRITE="CONFIRMED" node server/scripts/migrateInstructorApproval.js --apply
  ```
- [ ] **Validate Execution Output:**
  - Confirm `approvedBackfilled` matches `eligibleForBackfill.toApprove` from dry-run report.
  - Confirm `pendingBackfilled` matches `eligibleForBackfill.toPending`.
  - Re-run with `--dry-run` to confirm full idempotency (0 remaining to backfill).

### Stage 5: Backend API & Worker Deployment
- [ ] **Deploy Backend API Container:**
  - Provision container with Node.js 22 runtime.
  - Configure production environment variables adhering to `server/.env.production.example`.
  - Mount `/healthz` on container orchestrator liveness probe (initial delay: 10s, period: 10s).
  - Mount `/readyz` on container orchestrator readiness probe (initial delay: 5s, period: 5s).
- [ ] **Deploy Standalone Webhook Worker:**
  - Start worker service: `npm --prefix server run worker:webhook`.
  - Verify worker logs confirm MongoDB connection, active heartbeat, and lease recovery loop.

### Stage 6: Frontend CDN Deployment & CORS Whitelist Binding
- [ ] **Deploy Frontend to Vercel Production:**
  - Set production environment variable `REACT_APP_BASE_URL="https://api.studynotion.com/api/v1"`.
  - Set production environment variable `REACT_APP_RAZORPAY_KEY_ID="rzp_live_..."`.
  - Set production environment variable `REACT_APP_SENTRY_DSN`.
  - Trigger production build and deploy to primary domain `https://studynotion.com`.
- [ ] **Verify CORS Allowlist:**
  - Execute preflight OPTIONS request:
    ```bash
    curl -i -X OPTIONS https://api.studynotion.com/api/v1/auth/login \
      -H "Origin: https://studynotion.com" \
      -H "Access-Control-Request-Method: POST"
    ```
  - Confirm `Access-Control-Allow-Origin: https://studynotion.com` and `Access-Control-Allow-Credentials: true`.
  - Confirm requests from unlisted origins receive `403 Forbidden` or origin omission.

### Stage 7: Razorpay Live Webhook Configuration
- [ ] **Register Production Webhook in Razorpay Dashboard:**
  - Webhook URL: `https://api.studynotion.com/api/v1/payment/webhook`.
  - Secret: Enter `RAZORPAY_WEBHOOK_SECRET` from production environment.
  - Subscribed Events: `payment.captured`, `payment.failed`, `order.paid`.
- [ ] **Send Live Test Ping:**
  - Use Razorpay Dashboard **Test Webhook** utility.
  - Confirm HTTP 200 response in $\le 500$ ms.
  - Confirm event recorded in MongoDB `WebhookEvent` with status `PROCESSED`.

### Stage 8: Post-Launch Smoke Testing & Verification
- [ ] **Student Flow Smoke Test:**
  - User signup with real email OTP verification.
  - Password login and cookie issuance.
  - Course search, catalog filtering, and navigation.
  - Direct ₹0 free course enrollment (`/enrollFreeCourse`) and video playback.
  - Review and rating submission.
- [ ] **Instructor Flow Smoke Test:**
  - Onboard new instructor (verifying `PENDING` notice banner).
  - Admin approves instructor via `/dashboard/admin/users`.
  - Instructor creates course with thumbnail and video lecture upload.
  - Instructor publishes course.
- [ ] **Admin Flow Smoke Test:**
  - Category creation and update.
  - User directory search and details modal.
  - Webhook event inspection log check.
- [ ] **Observability & Error Watch:**
  - Monitor Sentry dashboard for 60 minutes; verify 0 unexpected unhandled exceptions.
  - Monitor Winston application logs for request throughput, latency ($p_{95} \le 300$ ms), and database pool saturation.

---

## 4. Rollback & Emergency Contingency Plan

If an unexpected production incident occurs during or immediately after launch:

### Incident Level 1: Frontend Defect or UI Regression
- **Action:** In Vercel Dashboard, navigate to **Deployments $\rightarrow$ Instant Rollback** and activate the previous verified release.
- **RTO:** $< 1$ minute. Zero database impact.

### Incident Level 2: Backend API Regression
- **Action:** Roll back backend container image to the prior stable image tag or revert Git commit to `fd82540`.
- **RTO:** $< 5$ minutes.

### Incident Level 3: Database Migration or Data Integrity Failure
- **Action:**
  1. Set backend to read-only or maintenance mode.
  2. In MongoDB Atlas, initiate a **Point-in-Time Restore to a NEW cluster** using the snapshot taken in Stage 3 (`pre-migration-launch-studynotion-v1`).
  3. Verify data integrity on the new cluster using `server/scripts/verifyRestoredDatabase.js`.
  4. Update `MONGODB_URL` in backend environment to point to the restored cluster and restart backend services.
- **RPO:** $\le 1$ hour.
- **RTO:** $\le 30$ minutes.
