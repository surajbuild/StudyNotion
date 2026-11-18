# StudyNotion — QA Changelog

> Chronological audit trail of every defect fixed, test added, and verification run during continuous QA tracking.

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
