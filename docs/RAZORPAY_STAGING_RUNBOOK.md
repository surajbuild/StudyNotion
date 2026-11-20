# StudyNotion — Razorpay Test-Mode Staging Webhook Verification Runbook

> **Document Version:** 1.0.0  
> **Environment:** Deployed Staging (HTTPS)  
> **Scope:** Server-to-Server Webhook Delivery, Raw Body Capture & Asynchronous Payment Reconciliation  
> **Classification:** STAGING TEST-MODE ONLY (Zero Real Financial Transactions)  

---

## 1. Webhook Verification Architecture & Separation of Environments

| Tier | Environment | Webhook URL | Secret Key | Status |
|---|---|---|---|---|
| **Tier 1** | Local Isolated Unit Tests | Internal Mock | `studynotion-isolated-test-webhook-secret` | **VERIFIED PASS** (`webhook.unit.test.js`: 23/23) |
| **Tier 2** | Local Real-DB Integration | `127.0.0.1:27018` | `studynotion-isolated-test-webhook-secret` | **VERIFIED PASS** (`BE-DB-21`–`BE-DB-30`: 10/10) |
| **Tier 3** | **Deployed HTTPS Staging** | `https://staging-api.studynotion.com/api/v1/payment/webhook` | `RAZORPAY_WEBHOOK_SECRET` (Staging Secret) | **READY FOR VERIFICATION** |
| **Tier 4** | Production Live | `https://api.studynotion.com/api/v1/payment/webhook` | Live Production Webhook Secret | **PENDING STAGING SIGN-OFF** |

---

## 2. Step-by-Step Staging Verification Runbook

### Step 1: Configure Razorpay Dashboard in Test Mode
1. Log into **Razorpay Dashboard** and ensure the environment toggle is set to **Test Mode** (orange badge in top navigation).
2. Go to **Settings $\rightarrow$ Webhooks $\rightarrow$ Add New Webhook**.
3. **Webhook URL:** Enter your HTTPS staging endpoint:
   ```text
   https://staging-api.studynotion.com/api/v1/payment/webhook
   ```
4. **Secret:** Generate a 32+ character high-entropy secret string and configure it as `RAZORPAY_WEBHOOK_SECRET` in your staging environment variables.
5. **Active Events to Subscribe:**
   - `payment.captured` (Primary enrollment trigger)
   - `payment.failed` (Failure tracking)
   - `order.paid` (Auxiliary reconciliation)

### Step 2: Verify Raw-Body Signature Ingress
1. Trigger a test event from the Razorpay Dashboard using the **Send Test Event** utility.
2. Check staging application logs:
   - Verify HTTP `200 OK` response within $\le 500$ ms.
   - Confirm HMAC-SHA256 signature was accepted via `verifyWebhookSignature`.
   - Confirm event was persisted to MongoDB `WebhookEvent` with status `RECEIVED`.

### Step 3: Verify Background Worker Lease & Enrollment
1. Observe background worker logs (`server/workers/webhookWorker.js`):
   - Worker claims event with atomic lease (`status: "PROCESSING"`).
   - Order reconciled against authoritative database record.
   - Student atomic enrollment executed in `CourseProgress` and `User.courses`.
   - Cart pruned of purchased course.
   - Event transitions to `PROCESSED`.

### Step 4: Verify Webhook Idempotency & Duplicate Replay Defense
1. In Razorpay Dashboard, select the test event and click **Resend Webhook**.
2. Verify:
   - Webhook ingress recognizes existing `eventId` via unique compound index.
   - Endpoint returns HTTP `200 OK` immediately without duplicate database writes.
   - Student is not enrolled twice; total revenue KPI remains unchanged.

### Step 5: Test Simulated Worker Crash Recovery
1. Enqueue a webhook while stopping the worker process.
2. Verify event remains safely in `RECEIVED` state in MongoDB.
3. Restart worker process.
4. Verify worker immediately claims the unhandled event and completes reconciliation cleanly without lost orders.
