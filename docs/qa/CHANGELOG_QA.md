# StudyNotion — QA Changelog

> Chronological audit trail of every defect fixed, test added, and verification run during continuous QA tracking.

---

## 2026-11-18 — QA Cycle #4 (`GAP-009`: Isolated MongoDB Testing Environment & Unblocking All 6 Authenticated E2E Tests)

| Task / Bug ID | Files Modified / Added | Changes Made | Tests Executed | Verification Status |
|---------------|------------------------|--------------|----------------|---------------------|
| `CHECKPOINT` | Cycle #3 commit `c5281b9` (local only) | Created clean local checkpoint commit preserving all Cycle #3 fixes and QA docs (unpushed) | `git status` | `VERIFIED` |
| `GAP-009` (Safety) | `server/config/testSafety.js` (new), `server/__tests__/testSafety.test.js` (new), `server/config/database.js`, `server/index.js`, `server/middlewares/auth.js`, `server/controllers/Auth.js`, `server/controllers/ResetPassword.js`, `.gitignore` | Implemented strict `MONGODB_TEST_URL` isolation: blocks production/Atlas URIs, non-local hosts, non-`test` DB names, missing test flags, and matching `MONGODB_URL`; prevents reading production `server/.env` in test mode; masks credentials in logs | `server/__tests__/testSafety.test.js` (10/10 PASS) | `VERIFIED` |
| `GAP-009` (Test DB & Mocks) | `server/test-env/mongoInstance.js` (new), `server/test-env/seed.js` (new), `server/test-env/startIsolatedEnv.js` (new), `docker-compose.test.yml` (new), `server/.env.test.example` (new), `server/utils/mailSender.js`, `server/utils/imageUploader.js`, `server/config/razorpay.js`, `server/middlewares/rateLimiters.js`, `package.json`, `server/package.json` | Built ephemeral local MongoDB 8.0 lifecycle manager (port `27018`), repeatable synthetic seeding/cleanup/teardown, and test-only stubs for SMTP, Cloudinary, and Razorpay orders (zero production data or external side effects) | `npm run test:server:integration` (6/6 PASS) | `VERIFIED` |
| `GAP-009` (Integration) | `server/__tests__/integration.realdb.test.js` (new) | Added real-MongoDB full-stack Supertest suite verifying auth/OTP/cookies/logout, profile/password persistence, payment enrollment + progress + `$avg` rating aggregation, instructor CRUD + cascade delete, RBAC/IDOR, and profile delete cascade | `npm run test:all` (15 FE suites / 61 tests + 13 BE suites / 104 tests PASS) | `VERIFIED` |
| `GAP-009` (Auth E2E) | `e2e/authenticated.e2e.js` (new) | Unblocked and executed all 6 previously blocked live Playwright E2E journeys (`E2E-16` through `E2E-21`) plus 3 regressions (`REG-01`–`REG-03`) against isolated frontend (`3001`), backend (`4001`), and MongoDB (`27018`) | `node e2e/authenticated.e2e.js` (9/9 PASS, 0 page errors, 0 Swiper warnings) | `VERIFIED` |
| `BUG-029` | `src/components/core/Dashboard/AddCourse/CourseInformation/CourseInformationForm.jsx` | Fixed genuine defect uncovered by `E2E-20`: re-synced `courseCategory` after async fetch, set `required: !editCourse` on disabled select, guarded undefined `category` in `FormData`, and fixed `<Upload editData={...}>` prop | Playwright `E2E-20` + `npx eslint src --max-warnings=0` + `npm run build` | `VERIFIED` |
| `QA-SYS` | `docs/qa/*` (7 tracking files) | Updated QA tracking system for Cycle #4 (199/199 executed tests PASS, 0 blocked, 0 open bugs) while preserving Cycles #1–#3 history | All suites + ESLint + Build | `VERIFIED` |

---

## 2026-11-18 — QA Cycle #3 (Close All Remaining Bugs & Full Regression Verification)

| Task / Bug ID | Files Modified / Added | Changes Made | Tests Executed | Verification Status |
|---------------|------------------------|--------------|----------------|---------------------|
| `BUG-024` | `src/utils/videoNavigation.js` (new), `src/components/core/ViewCourse/VideoDetails.jsx`, `src/utils/__tests__/videoNavigation.test.js` (new) | Extracted `flattenCourseLectures` / `getLectureNavigation` to skip empty leading/middle/trailing sections and guard invalid IDs without crashing | `npm test` (`videoNavigation.test.js`: 5/5 PASS) | `VERIFIED` |
| `BUG-026` | `src/pages/Error.jsx`, `src/pages/__tests__/Error.test.jsx` (new) | Removed `e.preventDefault(); navigate(-1)` override so `<Link to="/">` works on direct entry; scoped CSS to `.error-page-container` and preserved Navbar layout | `npm test` (`Error.test.jsx`: 1/1 PASS) + Playwright `C3-E2E-02` | `VERIFIED` |
| `BUG-023` | `src/components/common/Footer.jsx`, `src/data/footer-links.js`, `src/components/common/__tests__/Footer.test.jsx` (new) | Removed dead template placeholders & unconfirmed legal links, kept 4 external social links (`rel="noopener noreferrer"`), mapped Support -> `/contact`, dynamically fetched live categories into `/catalog/<slug>` | `npm test` (`Footer.test.jsx`: 2/2 PASS) + Playwright `C3-E2E-01` (8/8 routes valid, 0 broken) | `VERIFIED` |
| `BUG-027` | 13 frontend files (`VideoDetails.jsx`, `CourseAccordionBar.jsx`, `CourseDetailsCard.jsx`, `CourseBuilderForm.jsx`, `Upload.jsx`, `Cart/index.jsx`, `SidebarLink.jsx`, `EnrolledCourses.jsx`, `Instructor.jsx`, `CourseReviewModal.jsx`, `VideoDetailsSidebar.jsx`, `UpdatePassword.jsx`, `ViewCourse.jsx`) | Resolved all 15 ESLint warnings at root cause (removed unused bindings, stabilized `useEffect`/`useCallback` deps, removed existing `eslint-disable` in `Upload.jsx`; 0 new `eslint-disable` comments) | `npx eslint src --max-warnings=0` (0 errors, 0 warnings) + `npm run build` | `VERIFIED` |
| `BUG-025` | `src/services/apiconnector.js`, `src/index.js`, `src/services/__tests__/apiconnector.test.js` (new) | Added `shouldTriggerSessionExpiry`, `registerUnauthorizedHandler`, and debounced Axios 401 response interceptor (excluding credential/public 401 endpoints); wired Redux clear + toast + `#/login` redirect in `src/index.js` | `npm test` (`apiconnector.test.js`: 6/6 PASS) + Playwright `C3-E2E-03` (Student), `C3-E2E-04` (Instructor), `C3-E2E-05` (Login 401 negative) | `VERIFIED` |
| `GAP-006` *(Tracked Separately)* | `server/controllers/Auth.js`, `server/routes/User.js`, `server/__tests__/auth.test.js`, `src/services/apis.js`, `src/services/operations/authAPI.js`, `src/services/__tests__/authAPI.logout.test.js` (new) | Added `POST /api/v1/auth/logout` (`res.clearCookie("token", { httpOnly: true })`) and updated client `logout()` to call `LOGOUT_API` before wiping Redux/`localStorage` | `npm run test:server` (+2 logout & post-logout 401 tests in `auth.test.js`, 88/88 PASS) + `npm test` (`authAPI.logout.test.js`: 2/2 PASS) | `VERIFIED` |
| `QA-SYS` | `docs/qa/*` (7 tracking files) | Updated all QA tracking docs for Cycle #3 (0 open bugs, 174/174 executed tests passing) while preserving Cycle #1 & #2 history | `npm run test:all` (149/149) + Playwright (7/7) + ESLint + Build | `VERIFIED` |

---

## 2026-11-18 — QA Cycle #2 (Full Codebase Audit, Live Playwright E2E & High-Impact Fixes)

| Task / Bug ID | Files Modified | Changes Made | Tests Executed | Verification Status |
|---------------|---------------|--------------|----------------|---------------------|
| `BUG-009` | `src/services/operations/studentFeatureAPI.js` | Fixed Razorpay `options.currency` and `options.amount` reading from `orderResponse.data.message` instead of `orderResponse.data` (was `undefined`) | `npm run build` | `VERIFIED` |
| `BUG-010` | `server/controllers/Course.js`, `src/components/core/Course/CourseDetailsCard.jsx`, `server/__tests__/course.test.js` | Added JSON array parsing for `tag`/`instructions` in `createCourse` and safe legacy JSON unpacking in `CourseDetailsCard.jsx` | `npm run test:server` + Playwright `E2E-06` | `VERIFIED` |
| `BUG-011` | `src/pages/CourseDetails.jsx` | Added dedicated `isLoadingCourse` state so failed/invalid course ID fetches render `<Error />` instead of infinite spinner | Playwright `E2E-07` | `VERIFIED` |
| `BUG-012` | `src/services/operations/profileAPI.js` | Fixed `getUserDetails` to read `response.data.userDetails || response.data.data` and sync `localStorage` | `npm run build` | `VERIFIED` |
| `BUG-013` | `src/services/operations/SettingsAPI.js`, `src/components/core/Dashboard/Settings/UpdatePassword.jsx` | Synced `localStorage.setItem("user")` on profile/avatar updates; returned boolean from `changePassword` so failed attempts stay on form | `npm run build` | `VERIFIED` |
| `BUG-014` | `src/App.jsx` | Added role-based conditional routing for Student (`cart`, `enrolled-courses`) and Instructor (`my-courses`, `add-course`, `edit-course`, `instructor`) routes | `npm run build` + `npm test` | `VERIFIED` |
| `BUG-015` | `src/components/core/Dashboard/Settings/DeleteAccount.jsx` | Added `ConfirmationModal` guard before executing permanent account deletion | `npm run build` | `VERIFIED` |
| `BUG-016` | `src/components/core/Dashboard/InstructorDashboard/InstructorChart.jsx` | Added `Array.isArray(courses)` null guard and `useMemo` color stabilization | `npm run build` | `VERIFIED` |
| `BUG-017` | `src/pages/Catalog.jsx`, `src/components/common/Navbar.jsx` | Implemented actual `Most Popular` / `New` sorting, error UI fallback (no infinite spinner), and consistent category `slugify` in Navbar | Playwright `E2E-05`, `E2E-05b` | `VERIFIED` |
| `BUG-018` | `src/components/ContactPage/ContactUsForm.jsx` | Added loading/success/error toasts and reset form only on confirmed API success | Playwright `E2E-09` | `VERIFIED` |
| `BUG-019` | `src/components/core/Auth/SignupForm.jsx` | Stopped clearing form inputs prematurely before `sendOtp` completes | Playwright `E2E-11` | `VERIFIED` |
| `BUG-020` | `src/components/core/ViewCourse/CourseReviewModal.jsx`, `server/models/RatingAndReview.js`, `server/controllers/RatingAndReview.js`, `server/__tests__/ratingReview.test.js` | Enforced 1–5 star rating validation on frontend and backend; updated button text to `"Submit Review"` | `npm run test:server` (8/8 rating tests) | `VERIFIED` |
| `BUG-021` | `src/components/common/ReviewSlider.jsx` | Set `loop={reviews.length > 3}` and added empty-state message to eliminate Swiper console warnings | Playwright `E2E-04` (0 warnings) | `VERIFIED` |
| `BUG-022` | `src/components/core/Dashboard/EnrolledCourses.jsx`, `src/components/core/Dashboard/MyProfile.jsx` | Guarded empty course navigation & null description in `EnrolledCourses`; rendered Gender, DOB, and About in `MyProfile` | `npm run build` | `VERIFIED` |
| `QA-SYS` | `docs/qa/*` (7 tracking files) | Created permanent centralized QA tracking system (`QA_DASHBOARD.md`, `FEATURE_MATRIX.md`, `TEST_CASES.md`, `BUG_TRACKER.md`, `MISSING_FEATURES.md`, `TEST_REPORT.md`, `CHANGELOG_QA.md`) | All 131 Jest tests + 18 Playwright checks | `VERIFIED` |

---

## 2026-11-18 — QA Cycle #1 (Initial Audit, Test Infrastructure & Password Reset Fix — Pushed `600b07d..9e14040`)

| Task / Bug ID | Files Modified | Changes Made | Tests Executed | Verification Status |
|---------------|---------------|--------------|----------------|---------------------|
| `BUG-001`, `BUG-002` | `server/models/CourseProgress.js`, `User.js`, `Profile.js` | Fixed `ref: "User"`, added `courseProgress` & `contactNumber` to `User`, changed `Profile.contactNumber` to `String` | `npm run test:server` | `VERIFIED` |
| `BUG-003`, `BUG-004` | `server/controllers/Course.js` | Enforced instructor ownership in `editCourse`; cascade-pulled deleted courses from Instructor, Category, and Students | `server/__tests__/course.test.js` | `VERIFIED` |
| `BUG-005`, `BUG-006`, `BUG-007`, `BUG-008` | `Category.js`, `RatingAndReview.js`, `courseProgress.js`, `Section.js`, `Subsection.js` | Fixed empty-category 404, GET query param for average rating, progress input validation, and subsection video upload field mismatch | `npm run test:server` | `VERIFIED` |
| `BUG-028` | `server/controllers/ResetPassword.js`, `server/.env`, `src/pages/UpdatePassword.jsx`, `src/services/operations/authAPI.js`, `vercel.json`, `server/index.js` | Fixed `404 DEPLOYMENT_NOT_FOUND` and `HashRouter` `/#/update-password/` reset URL; added SPA rewrites; fixed false success screen on failed reset | `server/__tests__/auth.test.js` (20/20) | `VERIFIED` |
| `TEST-INFRA` | `package.json`, `server/package.json`, `server/__tests__/*`, `src/**/__tests__/*` | Built 21 automated test suites (130 initial tests → 131 after Cycle #2) | `npm run test:all` + `npm run build` | `VERIFIED` |
