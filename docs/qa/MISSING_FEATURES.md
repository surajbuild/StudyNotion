# StudyNotion — Missing Functionality & Feature Gap Analysis

> **Last Updated:** 2026-11-18  
> **Classification Rule:** Findings are strictly separated into **(1) Confirmed Project Requirements / Broken Expectations**, **(2) Inferred Core Ed-Tech Expectations**, and **(3) Optional Enhancements**. Optional recommendations are never labeled as bugs.

---

## Category A — Missing Confirmed / Directly Referenced Features

### `GAP-001` — Admin Dashboard & Category Management UI — `RESOLVED (Cycle #7)`
- **Classification:** Confirmed Project Requirement (backend `POST /api/v1/course/createCategory` + `isAdmin` middleware + `ACCOUNT_TYPE.ADMIN`)
- **Resolution (Cycle #7):**
  - **Backend & Database:** Added `timestamps: true` and `trim: true` to `server/models/Category.js`; hardened `isAdmin` (`!req.user` check); hardened `POST /api/v1/course/createCategory` with name/length/slug validation and case-insensitive + slug-collision duplicate prevention (`409`); added `PUT /api/v1/course/updateCategory` (preserving course relationships & invalidating category/course-detail caches), `DELETE /api/v1/course/deleteCategory` (safe deletion blocking categories with associated courses via authoritative `Course.countDocuments` check returning `409`), and `GET /api/v1/course/adminDashboard` (`auth, isAdmin`, returning platform KPIs & categories enriched with live course counts).
  - **Frontend:** Built strict `AdminRoute.jsx` guard (redirecting unauthenticated users to `/login` and Student/Instructor users away to `/dashboard/my-profile`), `AdminDashboard.jsx`, `CategoryManagement.jsx` (search, pagination, desktop table + mobile card layout, Create/Edit modal with inline validation & server error display, safe-delete guard & `ConfirmationModal`, loading/empty/error/retry states), and `adminAPI.js` with `"categories-updated"` live refresh for `Navbar.jsx` & `Footer.jsx`. Fixed `Navbar.jsx` so Student Cart icon is restricted to `ACCOUNT_TYPE.STUDENT`, added Admin-only links in `dashboard-links.js` & mobile drawer, and fixed `BUG-030` (`OpenRoute.jsx` + `authAPI.js` Admin login redirect).
  - **Verification:** `category.test.js` (+6), `integration.realdb.test.js` (+1 full real-DB RBAC/CRUD/consistency test), `AdminRoute.test.jsx` (5/5), `adminAPI.test.js` (3/3), `CategoryManagement.test.jsx` (3/3), and Playwright `E2E-27`–`E2E-29` (3/3).
- **Remaining Optional Scope:** Full Admin User/Instructor management UI (covered separately under `GAP-002`).

### `GAP-002` — Instructor Approval Enforcement & Admin User Management — `RESOLVED (Cycle #10)`
- **Classification:** Confirmed Partial Implementation (`server/controllers/Auth.js` previously computed `approved = accountType !== "Instructor"` without schema persistence or enforcement)
- **Resolution (Cycle #10):**
  - **Schema, Policy & Safe Migration:** Added `approved`, `approvalStatus` (`PENDING` | `APPROVED` | `REJECTED`), `approvalReviewedAt`, `approvalReviewedBy`, `rejectionReason`, and compound index `{ accountType: 1, approvalStatus: 1, createdAt: -1 }` to `server/models/User.js`. Created `server/utils/instructorApproval.js` (authoritative resolution treating legacy pre-migration instructors without `approvalStatus` as `APPROVED`) and idempotent `server/scripts/migrateInstructorApproval.js`.
  - **Backend Enforcement & Security:** Hardened `Auth.js` `signUp` to allow only `"Student"` / `"Instructor"` (fixing `BUG-034`, blocking `"Admin"` self-signup with `403`), unconditionally assign `approvalStatus: "PENDING"` & `approved: false` for new instructors regardless of client payload, and send best-effort application-received email. Added DB-backed `isApprovedInstructor` middleware in `server/middlewares/auth.js` gating ALL restricted instructor endpoints (`createCourse`, `editCourse`, `deleteCourse`, `getInstructorCourses`, `add/update/deleteSection`, `add/update/deleteSubSection`, `instructorDashboard`, plus DB check in `getFullCourseDetails`) while preserving student course access. Fixed `BUG-035` by sanitizing `Profile.js` user responses.
  - **Admin User Management APIs & UI:** Added `/api/v1/admin` (`server/routes/Admin.js`, `server/controllers/AdminUsers.js`) behind `auth, isAdmin`: `GET /users/stats`, `GET /users`, `GET /users/:userId`, `GET /instructors`, `PUT /instructors/:userId/approve`, `PUT /instructors/:userId/reject` (safe projections, ObjectId/query-injection guards, duplicate/invalid transition `409`, anti-self-action `403`, no role mutation, best-effort approval/rejection emails). Built responsive `UserManagement.jsx` (`/dashboard/admin/users`) with 7 real-DB KPI cards, filter tabs, search, server-side pagination, details modal, confirmation dialogs, and AdminDashboard callout; added `ApprovedInstructorRoute.jsx`, `InstructorApprovalNotice.jsx`, `MyProfile.jsx` status banners, sidebar/drawer filtering, and `App.jsx` hard-refresh DB hydration.
  - **Verification:** `adminUsers.test.js` (14), `authMiddleware.test.js` (+7), `auth.test.js` (+5), `course.test.js` (+2), `profile.test.js` (+2), `section.test.js` (+1), `BE-DB-13` & `BE-DB-14` (real MongoDB 8.0), `ApprovedInstructorRoute.test.jsx` (5), `InstructorApprovalNotice.test.jsx` (3), `UserManagement.test.jsx` (4), `adminAPI.test.js` (+3), and Playwright `E2E-35`–`E2E-38` (4/4).
- **Separate Future Scope:** Account suspension/banning & admin-initiated user deletion remain intentionally decoupled from onboarding approval.

### `GAP-003` — Legal & Policy Pages (Pending User-Approved Copy) *(Partially Resolved in Cycle #3)*
- **Classification:** Confirmed Requirement Pending Content Confirmation
- **Status Update (Cycle #3):** All 60+ broken template links in `Footer.jsx` (`BUG-023`) were resolved by mapping active routes (`/`, `/about`, `/contact`, `/signup`, `/login`), dynamically linking real `/catalog/:slug` categories, and preserving the 4 external social links. Dead `/privacy`, `/terms`, and `/cookies` links were removed instead of inventing unapproved legal text.
- **What remains:** Create Privacy Policy, Terms of Service, and Cookie Policy routes once the product owner confirms the exact legal text/requirements.
- **Priority:** Low | **Complexity:** `LOW`

---

## Category B — Missing Inferred Core Ed-Tech Features

### `GAP-004` — Global Course Search, Filtering, Sorting & Pagination — `RESOLVED (Cycle #6)`
- **Classification:** Inferred Core Expectation for an Online Learning Platform
- **Resolution (Cycle #6):**
  - **Backend & Database:** Added `GET /api/v1/course/search` in `server/controllers/Course.js` & `server/routes/Course.js` with strict scalar/type/bounds query validation, Express 5 + `qs` operator-key injection protection, escaped multi-token case-insensitive regex matching across `courseName`, `courseDescription`, `whatYouWillLearn`, and `tag`, unconditional `{ status: "Published" }` visibility enforcement (excluding all `Draft` courses), MongoDB aggregation filtering (`category`, `priceType: all|free|paid`, `minPrice`, `maxPrice`, real `RatingAndReview` `minRating`, `tag`), 5 DB-backed sorts (`newest`, `popular`, `price_asc`, `price_desc`, `rating`), server-side `$facet` pagination with `MAX_LIMIT = 50` clamping, and compound/text indexes on `server/models/Course.js`.
  - **Frontend:** Added `SEARCH_COURSES_API` & `searchCourses` in `src/services/apis.js` & `src/services/operations/courseDetailsAPI.js`; built debounced `NavbarSearch.jsx` integrated into desktop Navbar, mobile top search toggle, and mobile drawer (`Navbar.jsx`); built full URL-synchronized `src/pages/Courses.jsx` (`/courses` & `/search`) with filter sidebar, inline price-range validation, active filter chips, 5 sort options, pagination, loading/empty/error/retry states, and linked `Catalog.jsx` categories directly to pre-filtered `/courses?category=...`.
  - **Verification:** `course.test.js` (+6), `integration.realdb.test.js` (+1 full real-DB search/filter/sort/pagination/index suite), `courseDetailsAPI.search.test.js` (2/2), `NavbarSearch.test.jsx` (2/2), `Courses.test.jsx` (2/2), Playwright `E2E-24`–`E2E-26` (3/3), and Public Regression `PUB-01`–`PUB-04` (4/4, 0 console/page/network errors).

### `GAP-005` — Free Course (₹0) Direct Enrollment Flow — `RESOLVED (Cycle #5)`
- **Classification:** Missing Integration / Business Logic Gap
- **Resolution (Cycle #5):**
  - **Backend:** Added `POST /api/v1/payment/enrollFreeCourse` (`auth`, `isStudent`) in `server/controllers/Payments.js` & `server/routes/Payment.js`. Strictly derives `userId` from JWT, fetches authoritative `price` & `status` from MongoDB, allows enrollment ONLY when `price === 0` and `status === "Published"`, rejects paid-course bypass (`400`), negative prices (`400`), malformed IDs (`400`), missing courses (`404`), and duplicates (`409`), and reuses `enrollStudents` (with duplicate `CourseProgress` guard & `getCourseDetails` cache invalidation). Hardened `createCourse` & `editCourse` (`Course.js`) + `Course` schema (`min: 0`) to allow `0` and reject negative/NaN prices. Hardened `capturePayment` to reject ₹0 orders cleanly.
  - **Frontend:** Added `ENROLL_FREE_COURSE_API` & `enrollFreeCourse` in `studentFeatureAPI.js`; updated `CourseDetails.jsx`, `CourseDetailsCard.jsx`, `CourseCard.jsx`, `RenderCartCourses.jsx`, `RenderTotalAmount.jsx`, `CoursesTable.jsx`, and `CourseInformationForm.jsx` to display `"Free"`, show `"Enroll Now"` (hiding `"Add to Cart"` / Razorpay for free courses), prevent double submissions, and permit publishing ₹0 courses.
  - **Verification:** `payment.test.js` (+8), `course.test.js` (+2), `integration.realdb.test.js` (+1 full real-DB security/enrollment test), `CourseDetailsCard.test.jsx` (4/4), `studentFeatureAPI.freeEnroll.test.js` (2/2), and Playwright `E2E-22` & `E2E-23` (PASS, 0 Razorpay hits).

### `GAP-006` — Server-Side Logout & Global Expired-Token Handling — `RESOLVED (Cycle #3)`
- **Classification:** Missing Integration / Security Hygiene
- **Resolution (Cycle #3):**
  1. Added `POST /api/v1/auth/logout` in `server/controllers/Auth.js` + `server/routes/User.js` calling `res.clearCookie("token", { httpOnly: true })` and updated frontend `logout()` in `src/services/operations/authAPI.js` to invoke it before clearing Redux/`localStorage`.
  2. Added debounced global 401 Axios response interceptor in `src/services/apiconnector.js` wired in `src/index.js` (`BUG-025`), excluding expected credential/public 401s.
- **Remaining Security Note:** JWT tokens remain stateless until their 24h `exp` claim if a token is manually copied outside the cookie jar; token denylisting/refresh-token rotation can be considered later if stricter revocation is required.

---

## Category C — Missing Validations & UX Gaps

### `GAP-007` — Password Policy Consistency Across Signup, Settings, and Reset — `RESOLVED (Cycle #9)`
- **Resolution (Cycle #9):**
  - **Shared Policy Utility:** Created [`server/utils/passwordPolicy.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/utils/passwordPolicy.js) and [`src/utils/passwordPolicy.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/passwordPolicy.js) defining `MIN_PASSWORD_LENGTH = 8` and `validateNewPassword()` (rejecting non-strings, empty/whitespace-only strings, and passwords `< 8` characters with `"Password must be at least 8 characters long"`).
  - **Backend Enforcement:** Enforced `validateNewPassword()` in `POST /api/v1/auth/signup` (Student & Instructor), `POST /api/v1/auth/changepassword` (on `newPassword` only — `oldPassword` unrestricted so legacy users can upgrade), and `POST /api/v1/auth/reset-password` (also fixing `BUG-032` by rejecting missing/empty/`null` reset tokens before querying MongoDB). Verified `POST /api/v1/auth/login` intentionally does NOT enforce `minLength: 8` (preventing legacy user lockout) and safely rejects accounts without a local password hash (`401`).
  - **Frontend Enforcement:** Updated `SignupForm.jsx`, `src/pages/UpdatePassword.jsx`, and `src/components/core/Dashboard/Settings/UpdatePassword.jsx` with consistent inline `role="alert"` validation, helper text, and network-request blocking for `< 8`-char passwords while preserving confirm-password match checks, visibility toggles, and loading/error states.
  - **Verification:** `auth.test.js` (+16 tests, 38/38), `integration.realdb.test.js` (`BE-DB-12`), `passwordPolicy.test.js` (3/3), `SignupForm.test.jsx` (3/3), `pages/UpdatePassword.test.jsx` (3/3), `Settings/UpdatePassword.test.jsx` (2/2), and Playwright `E2E-33`–`E2E-34` (2/2).

### `GAP-008` — Database-Backed Shopping Cart & Order History — `RESOLVED (Cycle #8)`
- **Resolution (Cycle #8):**
  - **Persistent Cart (`User.cart` + `/api/v1/cart`):** Added `cart` course references on `server/models/User.js`, created `server/controllers/Cart.js` & `server/routes/Cart.js` (`GET /`, `POST /add`, `DELETE /remove/:courseId`, `POST /sync` strictly behind `auth, isStudent`), with authoritative DB price calculation, duplicate prevention (`409`), Draft/unpublished blocking (`400`), self-healing pruning of unavailable/already-enrolled courses, automatic `$pull` on enrollment & course deletion, and login merge via `syncCartOnLogin` without erasing server carts on logout.
  - **Order Management & Payment Security (`Order.js` + `Payments.js`):** Created `server/models/Order.js` with historical `courseSnapshots`, `PENDING`/`PAID`/`FAILED`/`CANCELLED`/`REFUNDED` lifecycle, and unique partial indexes on `razorpayOrderId` & `razorpayPaymentId`. Hardened `capturePayment` (creates `PENDING` order charging ONLY paid course amounts, supporting mixed Free+Paid carts), `verifyPayment` (timing-safe HMAC-SHA256, server-side Order ownership/amount/currency/course validation, duplicate payment ID `409` replay protection, atomic `PENDING -> PAID` transition, idempotent repeated-callback handling & interrupted-enrollment recovery), `markPaymentFailed`, `GET /payment/orders` (paginated), and `GET /payment/orders/:orderId` (strict owner check `403`).
  - **Frontend Order History & Cart Sync:** Added `src/services/operations/cartAPI.js`, `src/components/core/Dashboard/OrderHistory.jsx` (`/dashboard/order-history`), Redux `setCartState`/loading/error states, `App.jsx` reload hydration, `authAPI.js` login merge, real `GetAvgRating` in `renderCartCourses.jsx`, mixed-cart breakdown in `renderTotalAmount.jsx`, and post-verification receipt emails + cancel/failure reporting in `studentFeatureAPI.js`.
  - **Verification:** `cart.test.js` (6/6), `payment.test.js` (18/18), `integration.realdb.test.js` (`BE-DB-10` & `BE-DB-11`), `cartAPI.test.js` (3/3), `OrderHistory.test.jsx` (2/2), and Playwright `E2E-30`–`E2E-32` (3/3).

### `GAP-009` — Dedicated Isolated MongoDB Test Environment + Authenticated E2E Seed Script — `RESOLVED (Cycle #4)`
- **Resolution (Cycle #4):**
  - Implemented strict safety guardrails (`server/config/testSafety.js` + `testSafety.test.js`, 10/10 PASS) rejecting production/Atlas URIs, missing `NODE_ENV=test`, non-local hosts, and non-`test` database names, while preventing `server/.env` from being read in test mode.
  - Added automated ephemeral local MongoDB 8.0 lifecycle manager (`server/test-env/mongoInstance.js`, port `27018`), repeatable seeder/teardown (`server/test-env/seed.js`), isolated test backend launcher (`server/test-env/startIsolatedEnv.js`, port `4001`), `docker-compose.test.yml`, and `server/.env.test.example`.
  - Added real-MongoDB integration test suite (`server/__tests__/integration.realdb.test.js`, 6/6 PASS) and unblocked all 6 previously blocked authenticated Playwright E2E journeys (`e2e/authenticated.e2e.js`, `E2E-16`–`E2E-21` + `REG-01`–`REG-03`, 9/9 PASS).

---

## Category D — Optional Recommended Enhancements (Not Required for Core Scope)

| ID | Enhancement | Value | Complexity |
|----|-------------|-------|------------|
| `OPT-001` | **Course Announcements / In-App Notifications** (referenced in `EditCourse` tips) | Allows instructors to message enrolled students | `MEDIUM` |
| `OPT-002` | **Quizzes, Assignments & Q&A Discussion Threads** (referenced in Homepage copy) | Increases learner engagement & interactive coding practice | `HIGH` |
| `OPT-003` | **Auto-Generated PDF Completion Certificates** | Awarded when `CourseProgress` reaches 100% | `MEDIUM` |
| `OPT-004` | **Enrolled Student Roster View for Instructors (`F-INS-11`)** — `RESOLVED (Cycle #11)` | Shows student names, emails, authoritative enrollment date, and individual lecture completion % per course (`GET /api/v1/course/:courseId/enrolled-students`, `CourseStudents.jsx`) | `LOW` |
| `OPT-005` | **Review Editing & Deletion** | Allows students to update/delete their own submitted rating & review | `LOW` |
| `OPT-006` | **Swagger / OpenAPI Documentation** | Auto-documents all 30+ backend REST endpoints | `LOW` |
