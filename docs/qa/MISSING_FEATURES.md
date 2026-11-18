# StudyNotion — Missing Functionality & Feature Gap Analysis

> **Last Updated:** 2026-11-18  
> **Classification Rule:** Findings are strictly separated into **(1) Confirmed Project Requirements / Broken Expectations**, **(2) Inferred Core Ed-Tech Expectations**, and **(3) Optional Enhancements**. Optional recommendations are never labeled as bugs.

---

## Category A — Missing Confirmed / Directly Referenced Features

### `GAP-001` — Admin Dashboard & Category Management UI
- **Classification:** Confirmed Project Requirement (backend `POST /api/v1/course/createCategory` + `isAdmin` middleware + `ACCOUNT_TYPE.ADMIN` already exist)
- **What is missing:** There is zero Admin frontend UI to create, edit, or delete Categories, or manage platform users/instructors. Categories can currently only be added via direct API calls (Postman/curl) or MongoDB Compass.
- **Why it is important:** Instructors cannot categorize courses unless an Admin populates categories first.
- **What happens if not implemented:** Platform admins have no web UI to add new subjects or manage the catalog.
- **Required Changes:**
  - *Frontend:* Add Admin routes in `src/App.jsx`, Admin sidebar links in `src/data/dashboard-links.js`, and `src/components/core/Dashboard/Admin/CategoryManager.jsx`.
  - *Backend:* Add `PUT /updateCategory` and `DELETE /deleteCategory` in `server/controllers/Category.js` and `server/routes/Course.js`.
  - *Database:* No schema change required.
- **Priority:** High | **Complexity:** `MEDIUM`

### `GAP-002` — Instructor Approval Enforcement
- **Classification:** Confirmed Partial Implementation (`server/controllers/Auth.js` line 87 computes `const approved = accountType !== "Instructor"`)
- **What is missing:** `User.js` schema has no `approved` field (Mongoose silently drops it on signup), `login` does not check `approved`, and there is no Admin approval endpoint/UI.
- **What happens if not implemented:** Dead logic in `Auth.js` gives a false sense of instructor moderation.
- **Required Changes:**
  - *Backend:* Either add `approved: { type: Boolean, default: true }` to `server/models/User.js` + admin approval routes, OR remove the dead `approved` flag if self-serve instructor onboarding is intended.
  - *Database:* Minor schema addition on `User` if kept.
- **Priority:** Medium | **Complexity:** `LOW`

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

### `GAP-007` — Password Policy Consistency Across Signup, Settings, and Reset
- **What is missing:** `Settings/UpdatePassword.jsx` enforces `minLength: 8`, while `SignupForm.jsx`, `pages/UpdatePassword.jsx`, and backend `Auth.js`/`ResetPassword.js` accept 1-character passwords like `"a"`.
- **Required Changes:** Enforce consistent minimum password length (e.g., ≥ 8 chars) on both frontend forms and backend controllers (`Auth.js`, `ResetPassword.js`).
- **Priority:** Medium | **Complexity:** `LOW`

### `GAP-008` — Database-Backed Shopping Cart & Order History
- **What is missing:** Cart lives exclusively in browser `localStorage` (`cartSlice.js`), and there is no `Order` / `Payment` MongoDB collection recording transaction history, receipts, or refunds.
- **Why it is important:** Clearing browser storage loses cart items; students and admins cannot view past invoices/payments; duplicate Razorpay webhook/callback protection has no idempotency record.
- **Required Changes:** Add `Order` model in `server/models/Order.js`, persist verified payment IDs in `Payments.js` (checking `razorpay_payment_id` uniqueness to prevent replay), and add a "Purchase History" tab in Student Dashboard.
- **Priority:** Medium | **Complexity:** `MEDIUM`

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
| `OPT-004` | **Enrolled Student Roster View for Instructors** | Shows student names, join date, and individual completion % per course | `LOW` |
| `OPT-005` | **Review Editing & Deletion** | Allows students to update/delete their own submitted rating & review | `LOW` |
| `OPT-006` | **Swagger / OpenAPI Documentation** | Auto-documents all 30+ backend REST endpoints | `LOW` |
