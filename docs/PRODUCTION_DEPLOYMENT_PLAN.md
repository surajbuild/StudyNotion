# StudyNotion — Master Production Deployment & Staging Verification Plan

> **Document Version:** 1.0.0  
> **Prepared by:** Senior DevOps Engineer, Full-Stack Architect & Production Reliability Lead  
> **Status:** READY FOR STAGING VERIFICATION  

---

## 1. System Architecture & Topology

```
                  ┌───────────────────────────────┐
                  │       Vercel Edge Network      │
                  │   React 18 + Redux + Router   │
                  │ (Strict CORS, SameSite Cookies)│
                  └───────────────┬───────────────┘
                                  │ HTTPS
                                  ▼
                  ┌───────────────────────────────┐
                  │       Node.js 22 Runtime       │
                  │    Express 5 API Application   │
                  │ (/healthz, /readyz, Winston,   │
                  │     Sentry SDK, Rate Limiter)  │
                  └──────┬─────────┬─────────┬────┘
                         │         │         │
          MongoDB Atlas  │         │ Redis   │ Webhook Ingress
       (M10+, Multi-AZ)  │         │ (Store) │ (Raw Body HMAC)
                         ▼         ▼         ▼
                ┌────────────┐┌─────────┐┌───────────────┐
                │ MongoDB    ││ Redis   ││ Razorpay S2S  │
                │ Database   ││ Cluster ││ Webhook Worker│
                │ & Outbox   ││ (Limits)││ & Recovery    │
                └────────────┘└─────────┘└───────────────┘
```

---

## 2. Staging Deployment Sequence

### Step 1: Pre-Flight Environment Setup
1. Deploy Backend API to Staging Host (e.g., Render / Railway / AWS ECS).
2. Configure staging environment variables adhering to `server/.env.production.example`.
3. Verify liveness probe:
   ```bash
   curl -i https://staging-api.studynotion.com/healthz
   # Expect: HTTP 200 OK, {"status": "ok", ...}
   ```
4. Verify readiness probe:
   ```bash
   curl -i https://staging-api.studynotion.com/readyz
   # Expect: HTTP 200 OK, {"status": "ready", "database": {"healthy": true}, ...}
   ```

### Step 2: Database Migration Verification (Dry-Run Mode)
Execute the instructor approval migration in read-only dry-run mode against the staging database:
```bash
node server/scripts/migrateInstructorApproval.js --dry-run
```
- Verify summary census matches staging user distribution.
- Confirm 0 unexpected mutations.

### Step 3: Webhook Worker Launch & Background Processing
Start the background webhook worker process:
```bash
npm --prefix server run worker:webhook
```
- Verify worker connects to MongoDB and acquires heartbeat leases.
- Confirm expired lease recovery loop is operational.

### Step 4: Frontend Deployment & CORS Binding
1. Deploy frontend to Vercel preview/staging domain (`studynotion-staging.vercel.app`).
2. Add the exact preview origin to `ALLOWED_ORIGINS` in backend configuration.
3. Test preflight OPTIONS request:
   ```bash
   curl -i -X OPTIONS https://staging-api.studynotion.com/api/v1/auth/login \
     -H "Origin: https://studynotion-staging.vercel.app" \
     -H "Access-Control-Request-Method: POST"
   ```
   Confirm `Access-Control-Allow-Origin: https://studynotion-staging.vercel.app` and `Access-Control-Allow-Credentials: true`.

---

## 3. Production Rollout & Migration Safety Rules

### CRITICAL PRODUCTION GO/NO-GO GATES
1. **Never run writes against Atlas production without verified, restorable backup snapshot.**
2. **Never deploy live production credentials before successful staging webhook reconciliation verification.**
3. **Always execute `migrateInstructorApproval.js --dry-run` and review census before applying writes.**
4. **Obtain explicit human architectural sign-off before modifying production database.**

---

## 4. Rollback & Contingency Procedures

In the event of an unexpected regression during production launch:
1. **Frontend Rollback:** In the Vercel dashboard, click **Instant Rollback** to revert to the previous verified deployment.
2. **Backend Rollback:** Revert container image or Git deployment to the last stable release tag (`cycle-13-checkpoint`).
3. **Database State Recovery:**
   - For migration issues: Legacy accounts remain valid; default fallback logic in `server/utils/instructorApproval.js` seamlessly treats legacy instructors as approved.
   - For database corruption: Follow `docs/PRODUCTION_DISASTER_RECOVERY.md` to restore a Point-in-Time snapshot into a new cluster within 30 minutes (RTO $\le 30$m).
