# StudyNotion — Production Database Backup & Disaster Recovery Runbook

> **Document Version:** 1.0.0  
> **Target Environment:** MongoDB Atlas M10+ Production Cluster  
> **Prepared by:** Database Administrator, Senior DevOps Engineer & Security Architect  
> **Last Updated:** Cycle #14 Production Readiness Preparation  

---

## 1. Executive Disaster Recovery Objectives

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | $\le$ **1 Hour** | Maximum acceptable data loss duration. Powered by MongoDB Atlas continuous cloud backups with 1-minute granularity oplog stream. |
| **RTO (Recovery Time Objective)** | $\le$ **30 Minutes** | Maximum acceptable downtime to restore operations on an alternate cluster or rollback snapshot. |
| **Backup Redundancy** | Multi-Region / Cross-AZ | Snapshots replicated across availability zones to prevent loss during single-region cloud outage. |
| **Responsible Operator** | Lead DevOps / Production DBA | Single accountable authority for snapshot validation and live restore execution. |

---

## 2. Backup Strategy & Retention Schedule

### 2.1 Continuous Cloud Backup (Atlas Oplog Tail)
- **Oplog Window:** Continuous oplog capture enabling Point-In-Time Recovery (PITR) to any second within the rolling 7-day retention window.
- **Granularity:** 1 second point-in-time restore capability.

### 2.2 Scheduled Snapshot Policy
- **Hourly Snapshots:** Taken every 1 hour, retained for 24 hours.
- **Daily Snapshots:** Taken at 00:00 UTC, retained for 30 days.
- **Weekly Snapshots:** Taken every Sunday at 00:00 UTC, retained for 90 days.
- **Monthly Snapshots:** Taken on the 1st of each month, retained for 365 days.

---

## 3. Disaster Recovery & Restoration Procedures

### 3.1 Point-in-Time Recovery via Atlas UI / API
1. Navigate to **Atlas Dashboard $\rightarrow$ Clusters $\rightarrow$ Production Cluster $\rightarrow$ Backup**.
2. Select **Restore $\rightarrow$ Point-in-Time Restore**.
3. Choose the target restoration timestamp (e.g., 5 minutes prior to incident occurrence).
4. **Target Destination:** ALWAYS select **"Restore to a new cluster"** (e.g., `studynotion-restored-prod`).
   > [!CAUTION]
   > NEVER restore directly over an existing production cluster in-place. Restoring to a new cluster allows data verification and sanity auditing before redirecting application traffic.
5. Once the restored cluster transitions to `ACTIVE`, run the sanity verification script:
   ```bash
   node server/scripts/verifyRestoredDatabase.js --uri "<RESTORED_CLUSTER_URI>"
   ```
6. Update backend environment variable `MONGODB_URL` to point to the restored cluster and restart backend services.

### 3.2 CLI Cold-Backup & Manual Restoration (`mongodump` / `mongorestore`)
In the event of an external emergency or multi-region failover:
```bash
# Export encrypted cold snapshot
mongodump --uri="$MONGODB_URL" --archive=studynotion_backup_$(date +%F).archive.gz --gzip

# Test restoration into an isolated sandbox database (NEVER production)
mongorestore --uri="mongodb://127.0.0.1:27018/studynotion_restore_test" --archive=studynotion_backup_*.archive.gz --gzip --drop
```

---

## 4. Post-Restoration Verification Checklist

- [ ] Confirm total User document count matches expected pre-incident census.
- [ ] Confirm Order records (`PAID`, `PENDING`) maintain financial integrity.
- [ ] Verify Course enrollment references and student `CourseProgress` continuity.
- [ ] Verify WebhookEvent durable inbox state and lease expirations.
- [ ] Check unique compound indexes on `User.email`, `Order.razorpayOrderId`, `WebhookEvent.eventId`.
- [ ] Execute health check endpoint `GET /readyz` to ensure `readyState === 1`.
