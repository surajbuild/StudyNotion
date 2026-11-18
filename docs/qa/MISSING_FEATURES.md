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

### `GAP-003` — Footer Destination Pages (Legal, Support, Career/Resource Links)
- **Classification:** Confirmed Broken Expectation (`Footer.jsx` displays 60+ internal links that all 404)
- **What is missing:** Routes for `/privacy`, `/terms`, `/cookies`, `/help-center`, `/careers`, `/blog`, etc.
- **What happens if not implemented:** Users clicking any footer link hit the 404 Upside Down screen, hurting credibility.
- **Required Changes:**
  - *Frontend:* Map subject/language links in `src/data/footer-links.js` to active `/catalog/:slug` pages, add simple pages for Privacy/Terms/Cookies/Help, and remove unbuilt placeholder links.
  - *Backend / Database:* None.
- **Priority:** High | **Complexity:** `LOW`

---

## Category B — Missing Inferred Core Ed-Tech Features

### `GAP-004` — Global Course Search & Multi-Criteria Filtering
- **Classification:** Inferred Core Expectation for an Online Learning Platform
- **What is missing:** No search input in `Navbar.jsx` or `Catalog.jsx`; no filtering by price range, rating, free vs. paid, or keyword; no pagination on `getAllCourses` or `categoryPageDetails`.
- **Why it is important:** As the catalog grows beyond a few courses, users cannot find specific topics (e.g., "React", "Docker") without clicking through every category.
- **Required Changes:**
  - *Backend:* Add `GET /api/v1/course/search?q=&category=&minPrice=&maxPrice=&minRating=&page=&limit=` in `server/controllers/Course.js` with MongoDB text index on `courseName`, `courseDescription`, `tag`.
  - *Frontend:* Add search bar in `Navbar.jsx` + `src/pages/SearchResults.jsx` with filter sidebar & pagination.
  - *Database:* Add compound/text index on `Course`.
- **Priority:** High | **Complexity:** `MEDIUM`

### `GAP-005` — Free Course (₹0) Direct Enrollment Flow
- **Classification:** Missing Integration / Business Logic Gap
- **What is missing:** `CourseInformationForm.jsx` explicitly allows `min="0"` price ("Set the Course Price option or make it free"), yet:
  1. `CoursesTable.jsx` line 116 blocks publishing if `course.price <= 0`.
  2. `Payments.js` sends `amount: totalAmount * 100` (0 paise) to Razorpay, which Razorpay rejects (minimum order is ₹1 / 100 paise).
- **What happens if not implemented:** Instructors cannot publish or let students enroll in free courses despite the UI advertising free courses.
- **Required Changes:**
  - *Backend:* In `Payments.js` (`capturePayment`), if `totalAmount === 0`, bypass Razorpay and call `enrollStudents(courses, userId)` directly, returning `{ freeEnrollment: true }`.
  - *Frontend:* Allow `price >= 0` in `CoursesTable.jsx` validation and handle `freeEnrollment` response in `studentFeatureAPI.js`.
  - *Database:* None.
- **Priority:** Medium | **Complexity:** `LOW`

### `GAP-006` — Server-Side Logout & Global Expired-Token Handling
- **Classification:** Missing Integration / Security Hygiene
- **What is missing:**
  1. `authAPI.js` (`logout`) clears `localStorage` & Redux, but never calls a backend endpoint to clear the `httpOnly` `token` cookie set during login (`Auth.js` line 181).
  2. `apiconnector.js` has no Axios response interceptor to auto-logout and redirect to `/login` when a 24h JWT expires (`BUG-025`).
- **Required Changes:**
  - *Backend:* Add `POST /api/v1/auth/logout` that calls `res.clearCookie("token")`.
  - *Frontend:* Call `/auth/logout` in `authAPI.js` and add a 401 response interceptor in `apiconnector.js`.
  - *Database:* None.
- **Priority:** Medium | **Complexity:** `LOW`

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

### `GAP-009` — Dedicated Isolated MongoDB Test Environment + Authenticated E2E Seed Script
- **What is missing:** Backend tests currently mock Mongoose models (fast and deterministic, but do not exercise live MongoDB aggregation pipelines or real indexes), and Playwright E2E cannot test authenticated Student/Instructor journeys without non-production seed accounts.
- **Required Changes:** Add `docker-compose.test.yml` (MongoDB 7 container) or local test DB URI (`MONGODB_TEST_URL`) + seed script to run full-stack authenticated Playwright journeys safely.
- **Priority:** Medium | **Complexity:** `MEDIUM`

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
