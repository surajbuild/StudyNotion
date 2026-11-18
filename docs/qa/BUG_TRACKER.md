# StudyNotion — Bug Tracker & Root Cause Analysis

> **Last Updated:** 2026-11-18  
> **Audit Cycle:** Cycle #11 (`F-INS-11` Instructor Student Roster & Progress Tracking + `BUG-036`)  
> **Severity Levels:** `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`  
> **Total Logged:** 34 (`BUG-001`–`BUG-036`, excluding unused gap) | **Fixed & Verified:** 34 | **Open:** 0

---

## Open Bugs

*None — all tracked bugs across Cycles #1–#11 have been fixed and verified.*

---

## Cycle #11 — Newly Discovered & Fixed Bug + Feature Delivery (`F-INS-11`)

### `BUG-036` — `Profile.getEnrolledCourses` Reported `100%` Completion on 0-Lecture Courses and Did Not Deduplicate or Validate Deleted Subsections
- **Module:** Course Progress Calculation (`Profile.js` / `courseProgressHelper.js`)
- **Severity:** `LOW` | **Priority:** P2 | **Status:** `FIXED & VERIFIED`
- **Location:** [`server/controllers/Profile.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/controllers/Profile.js#L250-L285), [`server/utils/courseProgressHelper.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/utils/courseProgressHelper.js)
- **How Discovered:** Phase 4 progress calculation audit while aligning instructor-facing roster progress with student-facing `getEnrolledCourses`.
- **Root Cause:** `Profile.js` previously returned `progressPercentage = 100` when `totalSubSections === 0`, used `completedVideos.length` directly without intersecting against existing course subsections or deduplicating multiple `CourseProgress` records, and did not guard null/deleted section or subsection references.
- **Resolution:** Extracted shared [`server/utils/courseProgressHelper.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/utils/courseProgressHelper.js) (`extractCourseLectureIds` + `calculateCourseProgress`) used by both `Profile.getEnrolledCourses` and `Course.getCourseEnrolledStudents`: returns `0%` for 0-lecture courses, deduplicates `completedVideos` across all matching `CourseProgress` documents, ignores deleted/unrelated subsections, and clamps completion to `[0, 100]`.
- **Regression Verification:** [`server/__tests__/courseRoster.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/courseRoster.test.js) (8/8) and real-MongoDB integration test `BE-DB-15` (verifies exact parity between student `getEnrolledCourses` and instructor roster progress).

### `F-INS-11` / `OPT-004` *(Tracked Separately)* — Instructor Enrolled Student Roster & Course Progress Tracking
- **Module:** Instructor Course Management & Progress Tracking
- **Status:** `RESOLVED & VERIFIED`
- **Implementation Summary:**
  - Added `enrolledAt` and `{ timestamps: true }` to `CourseProgress.js`, populating `enrolledAt` on new enrollments in `Payments.js` (`enrollStudents`) while falling back to authoritative `PAID` `Order` timestamps and returning `null` (never fabricated) for historical records without timestamps.
  - Added `GET /api/v1/course/:courseId/enrolled-students` (`auth, isApprovedInstructor`) in `server/routes/Course.js` & `server/controllers/Course.js` with strict JWT-derived ownership check (`403` cross-instructor), ObjectId & query-injection validation (`400`), safe user projections, server-side search & pagination, and real course-level completion summary KPIs.
  - Built responsive `CourseStudents.jsx` (`/dashboard/course-students/:courseId` behind `<ApprovedInstructorRoute>`) wired from `CoursesTable.jsx` ("Manage Students" button with enrolled count badge), featuring KPI cards, search, pagination, desktop table + mobile 375px cards, progress bars, `"Not recorded"` legacy enrollment date handling, and loading/empty/error/retry states.
- **Verification:** `courseRoster.test.js` (8/8), `BE-DB-15` (real MongoDB 8.0), `CourseStudents.test.jsx` (3/3), `courseDetailsAPI.roster.test.js` (2/2), Playwright `E2E-39` & `E2E-40` (2/2).

---

## Cycle #10 — Newly Discovered & Fixed Security Bugs + Feature Delivery (`GAP-002`)

### `BUG-034` — Public Signup Endpoint Accepted Arbitrary `accountType` (Including `"Admin"`)
- **Module:** Authentication & Security (`Auth.js`)
- **Severity:** `HIGH` | **Priority:** P1 | **Status:** `FIXED & VERIFIED`
- **Location:** [`server/controllers/Auth.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/controllers/Auth.js#L43-L56)
- **How Discovered:** Phase 1–2 security audit of `POST /api/v1/auth/signup` during Cycle #10 (`GAP-002`).
- **Root Cause:** `exports.signUp` passed client-supplied `req.body.accountType` directly into `User.create(...)`. Because `User.js` defines `enum: ["Admin", "Student", "Instructor"]`, any unauthenticated user submitting `{ accountType: "Admin" }` with a valid OTP could self-register an Administrator account.
- **Resolution:** Enforced strict `ALLOWED_SIGNUP_ROLES = new Set(["Student", "Instructor"])` in `Auth.js`: explicitly returns `403 Forbidden` when `accountType === "Admin"` and `400 Bad Request` for any other unrecognized role. Backend also unconditionally assigns initial approval state (`PENDING` / `approved: false` for Instructors; `approved: true` for Students) while ignoring any client-supplied approval fields.
- **Regression Verification:** [`server/__tests__/auth.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/auth.test.js) and real-MongoDB integration test `BE-DB-13`.

### `BUG-035` — Profile Endpoints Returned Raw Mongoose `User` Documents Including `password`, `token` & `resetPasswordExpires`
- **Module:** Profile API (`Profile.js`)
- **Severity:** `MEDIUM` | **Priority:** P1 | **Status:** `FIXED & VERIFIED`
- **Location:** [`server/controllers/Profile.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/controllers/Profile.js#L75-L209)
- **How Discovered:** Phase 3–6 audit of `GET /api/v1/profile/getUserDetails`, `PUT /api/v1/profile/updateProfile`, and `PUT /api/v1/profile/updateDisplayPicture` when adding hard-refresh user hydration.
- **Root Cause:** `Profile.js` returned Mongoose `User` documents directly in JSON responses without projecting out `password`, `token`, or `resetPasswordExpires`.
- **Resolution:** Applied `sanitizeUserForClient()` from [`server/utils/instructorApproval.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/utils/instructorApproval.js) to all three profile responses, guaranteeing sensitive fields are stripped while normalizing authoritative `approvalStatus` and `approved` fields for Instructors.
- **Regression Verification:** [`server/__tests__/profile.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/profile.test.js) and `BE-DB-13` (asserts `password` and `token` are `undefined`).

### `GAP-002` *(Tracked Separately)* — Instructor Approval Enforcement & Admin User Management
- **Module:** Authentication, Instructor RBAC, Admin Dashboard & User Management, Notifications
- **Status:** `RESOLVED & VERIFIED`
- **Implementation Summary:**
  - Added authoritative `approvalStatus` (`PENDING` | `APPROVED` | `REJECTED`), `approved`, `approvalReviewedAt`, `approvalReviewedBy`, `rejectionReason` & compound index to `User.js`, plus backward-compatible legacy resolution & idempotent migration script (`server/scripts/migrateInstructorApproval.js`).
  - Added DB-backed `isApprovedInstructor` middleware gating all restricted instructor endpoints (`createCourse`, `editCourse`, `deleteCourse`, `getInstructorCourses`, section/subsection CRUD, `instructorDashboard`, and DB check in `getFullCourseDetails`) without affecting student course access.
  - Built Admin User Management APIs (`/api/v1/admin/*`) and responsive `UserManagement.jsx` UI (`/dashboard/admin/users`) with 7 real-DB KPIs, search, filter tabs, pagination, details modal, confirmation dialogs, optional rejection reason, and best-effort lifecycle emails (`instructorApprovalEmail.js`).
  - Built `ApprovedInstructorRoute.jsx`, `InstructorApprovalNotice.jsx`, `MyProfile.jsx` status banners, sidebar/drawer filtering, and `App.jsx` hard-refresh hydration defeating `localStorage` spoofing.
- **Verification:** `adminUsers.test.js` (14), `authMiddleware.test.js` (+7), `auth.test.js` (+5), `course.test.js` (+2), `profile.test.js` (+2), `section.test.js` (+1), `BE-DB-13`–`BE-DB-14` (real MongoDB 8.0), `ApprovedInstructorRoute.test.jsx` (5), `InstructorApprovalNotice.test.jsx` (3), `UserManagement.test.jsx` (4), `adminAPI.test.js` (+3), Playwright `E2E-35`–`E2E-38` (4/4).

---

## Cycle #9 — Newly Discovered & Fixed Bugs + Feature Delivery (`GAP-007`)

### `BUG-032` — `resetPassword` Queried `User.findOne({ token })` Without Validating Missing/Empty/`null` Token
- **Module:** Authentication & Password Reset (`ResetPassword.js`)
- **Severity:** `MEDIUM` | **Priority:** P1 | **Status:** `FIXED & VERIFIED`
- **Location:** [`server/controllers/ResetPassword.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/controllers/ResetPassword.js#L61-L108)
- **How Discovered:** Security audit of all password-handling controllers during Cycle #9 (`GAP-007`).
- **Root Cause:** `exports.resetPassword` passed `req.body.token` directly into `User.findOne({ token })` without validating presence or string type. Because completed resets clear `token: null`, sending `{ token: null }` or omitting `token` queried MongoDB for users with `token: null` (and allowed NoSQL operator objects such as `{ $ne: null }` to reach Mongoose if unguarded).
- **Resolution:** Added strict pre-query validation requiring `token` to be a non-empty trimmed string (`400 "Password reset token is required"`), validated required `password` & `confirmPassword` (`400`), enforced `validateNewPassword(password)` (`400`), checked `!userDetails.resetPasswordExpires || userDetails.resetPasswordExpires < Date.now()`, and updated the user atomically by `{ _id: userDetails._id, token: trimmedToken }`.
- **Regression Verification:** [`server/__tests__/auth.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/auth.test.js) (asserts `undefined`, `null`, `""`, `"   "`, and `{ $ne: null }` return `400` without calling `User.findOne`), `BE-DB-12`, and Playwright `E2E-34`.

### `BUG-033` — `CourseDetailsCard` Ignored Redux `user.courses` When Determining Enrolled State
- **Module:** Student Course Details (`CourseDetailsCard.jsx`)
- **Severity:** `LOW` | **Priority:** P3 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/components/core/Course/CourseDetailsCard.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Course/CourseDetailsCard.jsx#L31-L36)
- **How Discovered:** Diagnosing an intermittent `E2E-22` navigation timing check right after free course enrollment.
- **Root Cause:** `CourseDetailsCard` computed `isAlreadyEnrolled` solely from `course?.studentEnrolled`, ignoring `user?.courses` which `enrollFreeCourse` already updates immediately in Redux/`localStorage`. If the user returned to a still-mounted or cached `CourseDetails` instance immediately after enrolling, the CTA briefly showed `"Enroll Now"` instead of `"Go To Course"`.
- **Resolution:** Updated `isAlreadyEnrolled` to check both `course?.studentEnrolled` and `user?.courses`, and updated `E2E-22` to await `ViewCourse`'s `/course/getFullCourseDetails` + `<video>` mount cleanly.
- **Regression Verification:** [`src/components/core/Course/__tests__/CourseDetailsCard.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Course/__tests__/CourseDetailsCard.test.jsx) (4/4 PASS) + Playwright `E2E-22` (`PASS`).

### `GAP-007` *(Tracked Separately)* — Consistent Minimum Password Policy Enforcement (≥ 8 Characters)
- **Module:** Authentication & Security (Signup, Reset Password, Change Password, Login)
- **Status:** `RESOLVED & VERIFIED`
- **Implementation Summary:**
  - Created shared backend & frontend policy modules (`server/utils/passwordPolicy.js`, `src/utils/passwordPolicy.js`) enforcing a minimum of 8 characters and rejecting non-string or whitespace-only new passwords.
  - Enforced consistently across Student & Instructor signup (`SignupForm.jsx` + `Auth.js`), Reset Password (`pages/UpdatePassword.jsx` + `ResetPassword.js`), and Settings Change Password (`Settings/UpdatePassword.jsx` + `Auth.js`), blocking invalid client submissions with zero API calls and rejecting direct API/Postman bypasses with `400`.
  - Preserved legacy user login (`POST /api/v1/auth/login` intentionally does NOT reject `< 8`-char historical passwords), kept `oldPassword` unrestricted on `changePassword` so legacy users can upgrade, and guarded accounts without a local password hash (`401` on login / `400` on changePassword).
- **Verification:** `auth.test.js` (+16 tests), `BE-DB-12` (real MongoDB 8.0), `passwordPolicy.test.js` (3/3), `SignupForm.test.jsx` (3/3), `pages/UpdatePassword.test.jsx` (3/3), `Settings/UpdatePassword.test.jsx` (2/2), Playwright `E2E-33` & `E2E-34` (2/2).

---

## Cycle #8 — Newly Discovered & Fixed Bug + Feature Delivery (`GAP-008`)

### `BUG-031` — Isolated Ephemeral `mongod` Deadlocked After ~64 KB of JSON Logs Due to Unconsumed `stdout` Pipe
- **Module:** Backend Test Infrastructure (`mongoInstance.js`)
- **Severity:** `HIGH` | **Priority:** P1 | **Status:** `FIXED & VERIFIED`
- **Location:** [`server/test-env/mongoInstance.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/test-env/mongoInstance.js#L120-L125)
- **How Discovered:** Expanding `integration.realdb.test.js` to 11 real-MongoDB integration tests (`BE-DB-10`, `BE-DB-11`) caused `afterAll` (`dropDatabase()`) to time out at 45s despite all 11 tests passing in ~5s.
- **Root Cause:** `ensureIsolatedMongo` spawned `mongod` with `stdio: ["ignore", "pipe", "pipe"]` and attached a listener only to `child.stderr` while never draining `child.stdout`. MongoDB 8.0 writes structured JSON log lines to `stdout`; once logs exceeded the Windows OS pipe buffer (~64 KB), the kernel blocked `mongod`'s main thread, deadlocking subsequent DB operations and teardown.
- **Resolution:** Changed `stdio` to `["ignore", "ignore", "pipe"]` so `mongod` stdout logs never fill an unread pipe buffer while `stderr` remains captured for startup error diagnostics.
- **Regression Verification:** `server/__tests__/integration.realdb.test.js` dropped from 50s timeout to **5.8s** (`11/11 PASS`); all 20 isolated Playwright E2E journeys passed cleanly (`20/20 PASS`).

### `GAP-008` *(Tracked Separately)* — Database-Backed Shopping Cart, Order Security & Order History
- **Module:** Student Shopping Cart, Razorpay Payment Verification & Order History
- **Status:** `RESOLVED & VERIFIED`
- **Additional Payment Hygiene Fixed:**
  1. `src/services/operations/studentFeatureAPI.js` previously fired `sendPaymentSuccessEmail` inside Razorpay's frontend `handler` *before* backend `verifyPayment` succeeded; moved receipt email dispatch strictly *after* confirmed `200` backend verification (and skipped on duplicate idempotent replays).
  2. `src/components/core/Dashboard/Cart/renderCartCourses.jsx` previously displayed a hardcoded `4.5` rating on every cart item; updated to compute actual ratings via `GetAvgRating(course?.ratingAndReviews)`.
- **Verification:** `cart.test.js` (6/6), `payment.test.js` (18/18), `integration.realdb.test.js` (`BE-DB-10` & `BE-DB-11`), `cartAPI.test.js` (3/3), `OrderHistory.test.jsx` (2/2), Playwright `E2E-30`–`E2E-32` (3/3).

---

## Cycle #7 — Newly Discovered & Fixed Bug + Admin Feature Delivery (`GAP-001`)

### `BUG-030` — `OpenRoute` Redirect Race Condition Overrode Admin Login Destination
- **Module:** Authentication & Routing (`OpenRoute` / `authAPI`)
- **Severity:** `MEDIUM` | **Priority:** P2 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/components/core/Auth/OpenRoute.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Auth/OpenRoute.jsx), [`src/services/operations/authAPI.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/operations/authAPI.js#L122-L140)
- **How Discovered:** Running live Playwright `E2E-28` (Admin login) against the isolated environment timed out waiting for `#/dashboard/admin`.
- **Root Cause:** `login()` in `authAPI.js` dispatched `setToken(...)` before `setUser(...)`, and `<Login>` is wrapped in `<OpenRoute>`. The instant `token` became non-null, `OpenRoute` re-rendered and unconditionally redirected to `<Navigate to="/dashboard/my-profile" />`, hijacking the Admin redirect before `navigate("/dashboard/admin")` could take effect.
- **Resolution:** Updated `OpenRoute.jsx` to read `state.profile?.user?.accountType` safely and redirect `ACCOUNT_TYPE.ADMIN` to `/dashboard/admin` (preserving `/dashboard/my-profile` for Students, Instructors, and partial stores), and updated `authAPI.js` to dispatch `setUser` before `setToken`.
- **Regression Verification:** [`src/components/core/Auth/__tests__/AdminRoute.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Auth/__tests__/AdminRoute.test.jsx) (+1 regression test), `RouteGuards.test.jsx` (4/4), and live Playwright `E2E-28` (`PASS`).

### `GAP-001` *(Tracked Separately)* — Admin Dashboard & Category Management UI/API
- **Module:** Admin Dashboard, Category CRUD & RBAC Security
- **Status:** `RESOLVED & VERIFIED`
- **Additional UI Hygiene Fixed:** Restricted the Navbar Shopping Cart icon in `Navbar.jsx` from `user?.accountType !== "Instructor"` to `user?.accountType === ACCOUNT_TYPE.STUDENT` so Admins never see a Student cart link.
- **Verification:** `category.test.js` (+6), `integration.realdb.test.js` (+1 full real-DB suite), `AdminRoute.test.jsx` (5/5), `adminAPI.test.js` (3/3), `CategoryManagement.test.jsx` (3/3), Playwright `E2E-27`–`E2E-29` (3/3), and `PUB-01`–`PUB-04` (4/4).

---

## Cycle #6 — Feature Delivery & Hardening (`GAP-004`, Tracked Separately)

### `GAP-004` *(Tracked Separately)* — Global Course Search, Filtering, Sorting & Server-Side Pagination
- **Module:** Student Discovery, Navbar Search & Course Catalog
- **Status:** `RESOLVED & VERIFIED`
- **Hardening & Quality Findings Caught & Resolved During Implementation:**
  1. **Express 5 Query Parser Operator Injection Hardening:** Express 5 defaults to `simple` (`querystring`) query parsing, turning `?q[$ne]=1` into literal key `"q[$ne]"` instead of nested objects. Added explicit key regex rejection (`/[$[\]]/`) alongside scalar string checks in `parseSearchParams` (`server/controllers/Course.js`) to reject operator injection under both Express 5 and `qs` parsers with `400 Bad Request`.
  2. **React 18.2 `<search>` DOM Warning Prevention:** React 18.2's DOM tag whitelist emits a console warning for `<search>`. Used `<form role="search">` directly in `NavbarSearch.jsx` and `Courses.jsx` to preserve the ARIA search landmark with zero React/browser console warnings.
- **Verification:** `course.test.js` (+6), `integration.realdb.test.js` (+1 real-DB suite verifying indexes, filters, sorts, pagination & draft exclusion), `courseDetailsAPI.search.test.js` (2/2), `NavbarSearch.test.jsx` (2/2), `Courses.test.jsx` (2/2), Playwright `E2E-24`–`E2E-26` (3/3), and `PUB-01`–`PUB-04` (4/4).

---

## Cycle #5 — Feature Delivery & Hardening (`GAP-005`, Tracked Separately)

### `GAP-005` *(Tracked Separately)* — Free Course (₹0) Direct Enrollment & Pricing Validation
- **Module:** Student Enrollment, Payments & Instructor Pricing
- **Status:** `RESOLVED & VERIFIED`
- **Defects Resolved While Implementing `GAP-005`:**
  1. `server/controllers/Course.js` (`createCourse` line 43) used `!price`, which falsely rejected `price === 0` and did not block negative prices in `createCourse`/`editCourse`.
  2. `src/components/core/Dashboard/InstructorCourses/CoursesTable.jsx` (line 116) used `!course.price || course.price <= 0`, blocking instructors from publishing free courses.
  3. `server/controllers/Payments.js` (`enrollStudents`) did not invalidate the 2-minute `getCourseDetails:<courseId>` cache after enrollment, which could display stale `studentEnrolled` state immediately after enrolling.
- **Verification:** `payment.test.js` (+8), `course.test.js` (+2), `integration.realdb.test.js` (+1), `CourseDetailsCard.test.jsx` (4/4), `studentFeatureAPI.freeEnroll.test.js` (2/2), Playwright `E2E-22` & `E2E-23` (PASS, 0 Razorpay hits).

---

## Cycle #4 — Newly Discovered & Fixed Bug + Isolated Test Infrastructure (`GAP-009`)

### `BUG-029` — Edit Course Form Silently Blocked Submission & Omitted Existing Thumbnail Preview
- **Module:** Instructor Module (`EditCourse` / `CourseInformationForm`)
- **Severity:** `HIGH` | **Priority:** P1 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/components/core/Dashboard/AddCourse/CourseInformation/CourseInformationForm.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Dashboard/AddCourse/CourseInformation/CourseInformationForm.jsx#L34-L105)
- **How Discovered:** Unblocking live authenticated Playwright `E2E-20` against the isolated MongoDB environment revealed that clicking `Save Changes` after editing a course title never fired `POST /api/v1/course/editCourse`.
- **Root Cause:**
  1. `CourseInformationForm` called `setValue("courseCategory", course.category?._id)` on mount *before* async `fetchCourseCategories()` populated the `<select>` `<option>` list, while registering `courseCategory` with `{ required: true }` on a `<select disabled={editCourse || loading}>`. React Hook Form validation rejected the empty/disabled `<select>` silently, preventing every course edit submission.
  2. When `data.courseCategory` was `undefined` on a disabled `<select>`, `data.courseCategory !== course.category?._id` could also append `"undefined"` as `category` to `FormData`.
  3. `<Upload>` was passed `thumbnail={editCourse ? course.thumbnail : null}` instead of its expected prop `editData`, hiding the existing thumbnail preview during edits.
- **Resolution:** Re-synced `courseCategory` after async categories load, set `required: !editCourse` on the disabled edit-mode select, guarded `if (data.courseCategory && ...)` before appending `category`, and passed `editData={editCourse ? course.thumbnail : null}` to `<Upload>`.
- **Regression Verification:** Live Playwright `E2E-20` (edit course title -> `POST /api/v1/course/editCourse` HTTP 200 -> persisted updated title visible in `/dashboard/my-courses`) + `npx eslint src --max-warnings=0` + `npm run build`.

### `GAP-009` *(Tracked Separately)* — Isolated MongoDB Testing Environment & Safety Guardrails
- **Module:** Backend Infrastructure & QA Automation
- **Status:** `RESOLVED & VERIFIED`
- **Location:** [`server/config/testSafety.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/config/testSafety.js), [`server/config/database.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/config/database.js), [`server/test-env/mongoInstance.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/test-env/mongoInstance.js), [`server/test-env/seed.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/test-env/seed.js), [`server/test-env/startIsolatedEnv.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/test-env/startIsolatedEnv.js), [`e2e/authenticated.e2e.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/e2e/authenticated.e2e.js), [`docker-compose.test.yml`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/docker-compose.test.yml)
- **Verification:** `server/__tests__/testSafety.test.js` (10/10 PASS), `server/__tests__/integration.realdb.test.js` (6/6 PASS against real isolated MongoDB 8.0 on `127.0.0.1:27018`), and `e2e/authenticated.e2e.js` (9/9 PASS — all 6 previously blocked tests `E2E-16`–`E2E-21` + 3 regressions).

---

## Cycle #3 — Fixed & Verified Bugs (5 Bugs + 1 Separately Tracked Integration Change)

### `BUG-023` — 60+ Broken Internal Links in Footer Lead to 404 Page
- **Module:** Common UI (`Footer`)
- **Severity:** `HIGH` | **Priority:** P2 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/components/common/Footer.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/common/Footer.jsx), [`src/data/footer-links.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/data/footer-links.js)
- **Root Cause:** `Footer.jsx` and `footer-links.js` were copied from a static template referencing ~60 routes (`/careers`, `/blog`, `/al`, `/hi`, `/privacy-policy`, `/terms`, `/cookies`, static language/subject slugs) that were never registered in `src/App.jsx`.
- **Classification & Resolution:**
  - **External destinations (kept):** 4 social links (Facebook, Google, Twitter, YouTube) preserved with `target="_blank" rel="noopener noreferrer"` and accessible `aria-label`s.
  - **Valid internal routes (mapped):** Platform links mapped to `/`, `/about`, `/contact`, `/signup`, `/login`; Help Center / Support mapped to `/contact`.
  - **Catalog links (dynamic):** Replaced hardcoded unrouted subject/language lists with live categories fetched from `GET /api/v1/course/showAllCategories` mapped to `/catalog/<slug>` using the same `slugifyCategory` helper as `Navbar.jsx`.
  - **Unbuilt placeholders & unconfirmed legal links (removed):** Removed template placeholders (`/careers`, `/blog`, `/docs`, `/forum`, etc.) and dead legal links (`/privacy`, `/terms`, `/cookies`) without inventing unapproved legal copy.
- **Regression Tests:** [`src/components/common/__tests__/Footer.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/common/__tests__/Footer.test.jsx) (2/2 PASS) + Live Playwright `C3-E2E-01` (verified all 8 unique internal footer routes — 0 broken links).

### `BUG-024` — `VideoDetails` Next/Prev Navigation Crashes on Empty Sections
- **Module:** Student Module (`ViewCourse`)
- **Severity:** `MEDIUM` | **Priority:** P2 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/utils/videoNavigation.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/videoNavigation.js), [`src/components/core/ViewCourse/VideoDetails.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/ViewCourse/VideoDetails.jsx)
- **Root Cause:** `goToNextVideo`, `goToPrevVideo`, `isFirstVideo`, and `isLastVideo` directly indexed `courseSectionData[idx + 1].subSection[0]._id` and `courseSectionData[idx - 1].subSection[len - 1]._id`, assuming every section contained at least one subsection. Empty leading, middle, or trailing sections threw `TypeError: Cannot read properties of undefined (reading '_id')`.
- **Resolution:** Extracted pure utility [`flattenCourseLectures` / `getLectureNavigation`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/videoNavigation.js#L6-L51) that flattens only playable `(sectionId, subSectionId)` entries across non-empty sections, computes `isFirst`/`isLast`/`prev`/`next` safely by flat index, and handles invalid/missing IDs without throwing. Updated `VideoDetails.jsx` to consume `getLectureNavigation` via `useMemo`.
- **Regression Tests:** [`src/utils/__tests__/videoNavigation.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/__tests__/videoNavigation.test.js) (5/5 PASS covering empty leading, middle, trailing, all-empty, and unknown IDs).

### `BUG-025` — No Global Axios 401 Interceptor for Expired JWT Tokens
- **Module:** Authentication (`API Connector`)
- **Severity:** `MEDIUM` | **Priority:** P2 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/services/apiconnector.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/apiconnector.js#L13-L92), [`src/index.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/index.js)
- **Root Cause:** `axiosInstance` attached `Authorization: Bearer <token>` on outgoing requests but defined no response error interceptor. When a user's 24h JWT expired, protected requests returned HTTP 401 while Redux and `localStorage` kept stale `token`/`user` state, leaving the user appearing logged in across broken dashboard pages.
- **Resolution:**
  - Added `shouldTriggerSessionExpiry`, `registerUnauthorizedHandler`, and a debounced (1000ms) Axios response 401 interceptor in `src/services/apiconnector.js`.
  - Explicitly excluded expected credential/validation 401 endpoints (`/auth/login`, `/auth/signup`, `/auth/sendotp`, `/auth/logout`, `/auth/changepassword`, `/auth/reset-password-token`, `/auth/reset-password`) and unauthenticated visitors (when `localStorage.getItem("token")` is absent), as well as 403/500 errors.
  - Registered the unauthorized handler in `src/index.js` to dispatch `setToken(null)`, `setUser(null)`, `resetCart()`, show `"Session expired. Please log in again."` toast, and redirect to `#/login`.
- **Regression Tests:** [`src/services/__tests__/apiconnector.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/__tests__/apiconnector.test.js) (6/6 PASS) + Live Playwright `C3-E2E-03` (Student expired JWT), `C3-E2E-04` (Instructor expired JWT), and `C3-E2E-05` (negative check: `/auth/login` 401 does NOT trigger session expiry).

### `GAP-006` *(Tracked Separately from `BUG-025`)* — Server-Side Logout Endpoint & Cookie Clearing
- **Module:** Authentication (`Logout`)
- **Severity:** `MEDIUM` (Security Hygiene / Integration Gap) | **Status:** `FIXED & VERIFIED`
- **Location:** [`server/controllers/Auth.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/controllers/Auth.js), [`server/routes/User.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/routes/User.js), [`src/services/apis.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/apis.js), [`src/services/operations/authAPI.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/operations/authAPI.js)
- **Root Cause:** `server/middlewares/auth.js` checks `req.cookies?.token` before `Authorization: Bearer`. Client-only `logout()` cleared `localStorage` and Redux, leaving the 3-day `httpOnly` `token` cookie intact so subsequent browser requests with `withCredentials: true` remained authenticated server-side.
- **Resolution:** Added `POST /api/v1/auth/logout` (`exports.logout`) calling `res.clearCookie("token", { httpOnly: true })` and updated frontend `logout()` in `authAPI.js` to invoke `LOGOUT_API` (best-effort `try/catch`) before wiping Redux + `localStorage`.
- **Regression Tests:** [`server/__tests__/auth.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/auth.test.js) (+2 Supertest tests proving cookie clearing and that subsequent protected Student `/profile/getUserDetails` and Instructor `/profile/instructorDashboard` calls return `401`) + [`src/services/__tests__/authAPI.logout.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/__tests__/authAPI.logout.test.js) (2/2 PASS).

### `BUG-026` — 404 Error Page `navigate(-1)` Fails on Direct Landing & Mutates Global Body Overflow
- **Module:** Common UI (`Error Page`)
- **Severity:** `LOW` | **Priority:** P3 | **Status:** `FIXED & VERIFIED`
- **Location:** [`src/pages/Error.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/pages/Error.jsx)
- **Root Cause:** `<Link to="/">` intercepted clicks with `e.preventDefault(); navigate(-1);`, which did nothing when landing directly on a bad URL in a new tab with empty history. The component also used `fixed inset-0` (hiding the Navbar) and injected global `html, body, #root { overflow: hidden !important; background: #000000 !important; }` CSS rules.
- **Resolution:** Removed the `useNavigate` / `e.preventDefault()` override so `<Link to="/">` always navigates reliably to Homepage; scoped styling to `.error-page-container`; replaced `fixed inset-0` with `min-h-[calc(100vh-3.5rem)] w-full` so the Navbar remains accessible.
- **Regression Tests:** [`src/pages/__tests__/Error.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/pages/__tests__/Error.test.jsx) (1/1 PASS) + Live Playwright `C3-E2E-02` (fresh tab direct 404 landing: `bodyOverflow !== "hidden"`, Navbar visible, CTA navigates to Homepage).

### `BUG-027` — 15 ESLint Warnings Across Frontend Components
- **Module:** Frontend Code Quality
- **Severity:** `LOW` | **Priority:** P3 | **Status:** `FIXED & VERIFIED`
- **Location:** 13 files — `CourseAccordionBar.jsx`, `CourseDetailsCard.jsx`, `CourseBuilderForm.jsx`, `Upload.jsx`, `Cart/index.jsx`, `SidebarLink.jsx`, `EnrolledCourses.jsx`, `Instructor.jsx`, `CourseReviewModal.jsx`, `VideoDetails.jsx`, `VideoDetailsSidebar.jsx`, `UpdatePassword.jsx`, `ViewCourse.jsx`
- **Root Cause:** Unused variables/imports (`courseId`, `getValues`, `course`, `total`, `dispatch`, `setPreviewSource`, `navigate`, `totalItems`) and incomplete `react-hooks/exhaustive-deps` dependency arrays.
- **Resolution:** Fixed every warning at its root cause (removed unused bindings, stabilized `useEffect` / `useCallback` dependencies, and removed a pre-existing `eslint-disable-next-line` in `Upload.jsx` by adding `name` to deps). Zero `eslint-disable` comments added.
- **Verification:** `npx eslint src --max-warnings=0` exits with code **0** (0 errors, 0 warnings); `npm run build` compiles with **0 ESLint warnings**.

---

## Cycles #1 & #2 — Historical Fixed & Verified Bugs (21 Total)

| Bug ID | Severity | Title | Root Cause & File | Fix Status | Regression Test |
|--------|----------|-------|-------------------|------------|-----------------|
| `BUG-001` | `MEDIUM` | Case-sensitive model ref `"user"` in `CourseProgress` | `server/models/CourseProgress.js` line 9 used lowercase `"user"` instead of `"User"` | `FIXED & VERIFIED` | `server/__tests__/courseProgress.test.js` |
| `BUG-002` | `CRITICAL` | `User` model field mismatch (`coursesProgress` vs `courseProgress`) + missing `contactNumber` | `Payments.js` pushed to `courseProgress`, dropped by strict mode; `User.js` lacked `contactNumber` | `FIXED & VERIFIED` | `server/__tests__/payment.test.js`, `auth.test.js` |
| `BUG-003` | `CRITICAL` | IDOR vulnerability on `POST /api/v1/course/editCourse` | `server/controllers/Course.js` `editCourse` lacked `course.instructor.toString() !== req.user.id` check | `FIXED & VERIFIED` | `server/__tests__/course.test.js` |
| `BUG-004` | `HIGH` | Dangling `Course` ObjectIds on `deleteCourse` | `server/controllers/Course.js` `deleteCourse` did not `$pull` deleted course from Instructor, Category, or enrolled Students | `FIXED & VERIFIED` | `server/__tests__/course.test.js` |
| `BUG-005` | `HIGH` | Empty category returned 404 causing infinite spinner | `server/controllers/Category.js` threw 404 when `selectedCategory.courses.length === 0` | `FIXED & VERIFIED` | `server/__tests__/category.test.js` |
| `BUG-006` | `MEDIUM` | `GET /getAverageRating` only read `req.body.courseId` | HTTP GET drops request body; `RatingAndReview.js` ignored `req.query.courseId` | `FIXED & VERIFIED` | `server/__tests__/ratingReview.test.js` |
| `BUG-007` | `MEDIUM` | Unhandled CastError when `courseId`/`subsectionId` omitted | `server/controllers/courseProgress.js` lacked required parameter validation | `FIXED & VERIFIED` | `server/__tests__/courseProgress.test.js` |
| `BUG-008` | `HIGH` | Subsection edit video upload silently ignored + wrong return shape | `SubSectionModal.jsx` sent field `"video"`, controller only checked `req.files?.videoFile` | `FIXED & VERIFIED` | `server/__tests__/section.test.js` |
| `BUG-009` | `CRITICAL` | Razorpay checkout received `currency: undefined`, `amount: "undefined"` | `src/services/operations/studentFeatureAPI.js` lines 53-54 read `orderResponse.data.currency/amount` instead of `orderResponse.data.message.currency/amount` | `FIXED & VERIFIED` | Verified in code + build |
| `BUG-010` | `HIGH` | Raw JSON brackets `["WEB DEV"]` rendered in "This Course Includes" | `server/controllers/Course.js` `createCourse` did not `JSON.parse` `tag`/`instructions`; `CourseDetailsCard.jsx` rendered raw JSON strings | `FIXED & VERIFIED` | `server/__tests__/course.test.js` + live `E2E-06` / `C3-E2E-06` |
| `BUG-011` | `HIGH` | Infinite loading spinner on invalid `/courses/:courseId` | `src/pages/CourseDetails.jsx` checked `!courseData` before `if (!courseData?.courseDetails) return <Error />` | `FIXED & VERIFIED` | Live Playwright `E2E-07` |
| `BUG-012` | `HIGH` | `getUserDetails` crashed and forced logout on every call | `src/services/operations/profileAPI.js` read `response.data.data` instead of `response.data.userDetails` | `FIXED & VERIFIED` | Verified against `Profile.js` contract |
| `BUG-013` | `HIGH` | Profile updates lost on refresh + failed password change still navigated away | `SettingsAPI.js` never synced `localStorage.setItem("user")` & swallowed errors in `changePassword` | `FIXED & VERIFIED` | Verified in `SettingsAPI.js` & `Settings/UpdatePassword.jsx` |
| `BUG-014` | `HIGH` | Missing frontend role-based guards on Student/Instructor Dashboard routes | `src/App.jsx` exposed Cart/EnrolledCourses to Instructors and AddCourse/Instructor to Students | `FIXED & VERIFIED` | Verified in `App.jsx` + build |
| `BUG-015` | `HIGH` | One-click irreversible account deletion with no confirmation | `DeleteAccount.jsx` immediately dispatched `deleteProfile()` without a confirmation modal | `FIXED & VERIFIED` | Verified `ConfirmationModal` integration |
| `BUG-016` | `HIGH` | `InstructorChart` crashed with `TypeError` when `courses` is `null` | `InstructorChart.jsx` called `courses.map()` without null guard + regenerated random colors every render | `FIXED & VERIFIED` | Verified in `InstructorChart.jsx` |
| `BUG-017` | `MEDIUM` | Catalog tabs didn't sort, API error caused infinite spinner, Navbar slug mismatch | `Catalog.jsx` never sorted by `active` tab or handled errors; `Navbar.jsx` didn't strip special chars | `FIXED & VERIFIED` | Live Playwright `E2E-05`, `E2E-05b` |
| `BUG-018` | `MEDIUM` | Contact form showed zero feedback & reset inputs even on API failure | `ContactUsForm.jsx` lacked toast notifications and relied on `isSubmitSuccessful` | `FIXED & VERIFIED` | Live Playwright `E2E-09` |
| `BUG-019` | `MEDIUM` | Signup form wiped all user inputs before `sendOtp` succeeded | `SignupForm.jsx` called `setFormData({ ...empty })` synchronously on submit | `FIXED & VERIFIED` | Live Playwright `E2E-11` |
| `BUG-020` | `MEDIUM` | 0-star / out-of-range ratings accepted by frontend & backend | `CourseReviewModal.jsx` defaulted rating to `0` with no check; `RatingAndReview.js` lacked `1..5` bounds | `FIXED & VERIFIED` | `server/__tests__/ratingReview.test.js` |
| `BUG-021` | `MEDIUM` | Swiper loop console warnings + empty box when 0 reviews | `ReviewSlider.jsx` set `loop={true}` unconditionally | `FIXED & VERIFIED` | Live Playwright `E2E-04` (0 warnings) |
| `BUG-022` | `MEDIUM` | `EnrolledCourses` navigated to `undefined` lecture + `MyProfile` hid saved About/DOB/Gender | Missing null guards in `EnrolledCourses.jsx` & missing fields in `MyProfile.jsx` | `FIXED & VERIFIED` | Verified in code + build |
| `BUG-028`* | `HIGH` | Password reset email pointed to dead Vercel URL & lacked `/#/` for `HashRouter`, plus `UpdatePassword` showed false success on error | `server/.env` had dead Vercel URL; `ResetPassword.js` omitted `/#/`; `UpdatePassword.jsx` didn't await thunk result | `FIXED & VERIFIED` | `server/__tests__/auth.test.js` |
