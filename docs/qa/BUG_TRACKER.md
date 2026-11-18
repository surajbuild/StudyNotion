# StudyNotion — Bug Tracker & Root Cause Analysis

> **Last Updated:** 2026-11-18  
> **Severity Levels:** `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`  
> **Total Logged:** 25 | **Fixed & Verified:** 20 | **Open:** 5

---

## Open Bugs (Require Future Action)

### `BUG-023` — 60+ Broken Internal Links in Footer Lead to 404 Page
- **Module:** Common UI (`Footer`)
- **Severity:** `HIGH` | **Priority:** P2
- **Status:** `OPEN`
- **Location:** [`src/components/common/Footer.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/common/Footer.jsx#L38-L80), [`src/data/footer-links.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/data/footer-links.js)
- **Steps to Reproduce:** Scroll to the footer on any page and click `Careers`, `Blog`, `Docs`, `Privacy Policy`, `Terms of Service`, `Cookie Policy`, or any Subject/Language link.
- **Expected:** Valid destination page or relevant Catalog category.
- **Actual:** All links except `About` (`/about`) navigate to unmatched routes and display the 404 Error page (verified live in `E2E-14` for `/#/careers`).
- **Root Cause:** `Footer.jsx` and `footer-links.js` were copied from a static template referencing ~60 routes that were never registered in `src/App.jsx`.
- **Suggested Solution:** Map subject/language links to real `/catalog/<slug>` routes (or `/`), create lightweight legal/info pages for Privacy/Terms/Help, and remove unbuilt placeholder links.

### `BUG-024` — `VideoDetails` Next/Prev Navigation Crashes on Empty Sections
- **Module:** Student Module (`ViewCourse`)
- **Severity:** `MEDIUM` | **Priority:** P2
- **Status:** `OPEN`
- **Location:** [`src/components/core/ViewCourse/VideoDetails.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/ViewCourse/VideoDetails.jsx#L66-L92)
- **Expected:** Clicking `Next →` or `← Prev` skips empty sections or disables cleanly.
- **Actual:** `nextSection.subSection[0]._id` / `prevSection.subSection[prevSubsLength - 1]._id` throws `TypeError: Cannot read properties of undefined (reading '_id')` if an adjacent section has 0 subsections.
- **Root Cause:** Code assumes every section in `courseSectionData` has `subSection.length >= 1`.
- **Suggested Solution:** Flatten all `(sectionId, subSectionId)` pairs into an ordered list of playable lectures and navigate by flat index.

### `BUG-025` — No Global Axios 401 Interceptor for Expired JWT Tokens
- **Module:** Authentication (`API Connector`)
- **Severity:** `MEDIUM` | **Priority:** P2
- **Status:** `OPEN`
- **Location:** [`src/services/apiconnector.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/apiconnector.js#L13-L27)
- **Expected:** When a user's 24h JWT expires and any protected API returns `401`, the app automatically clears `token`/`user` and redirects to `/login` with a "Session expired" toast.
- **Actual:** Only `getUserDetails` logs out on failure; all other endpoints leave the user appearing logged in while every button fails with 401 error toasts.
- **Root Cause:** `axiosInstance` defines a request interceptor but no response error interceptor for HTTP 401.
- **Suggested Solution:** Add a response interceptor checking `error.response?.status === 401` (excluding `/auth/login` and `/auth/changepassword`) to clear localStorage and redirect.

### `BUG-026` — 404 Error Page `navigate(-1)` Fails on Direct Landing & Mutates Global Body Overflow
- **Module:** Common UI (`Error Page`)
- **Severity:** `LOW` | **Priority:** P3
- **Status:** `OPEN`
- **Location:** [`src/pages/Error.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/pages/Error.jsx#L12-L19), [`src/pages/Error.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/pages/Error.jsx#L400-L409)
- **Root Cause:** `<Link to="/">` overrides `onClick` with `e.preventDefault(); navigate(-1);` — if a user opens a bad URL in a new tab, browser history is empty so clicking "Go to right side up" does nothing. Also injects global `!important` rules on `html, body, #root`.
- **Suggested Solution:** Navigate directly to `/` (`<Link to="/">` without `e.preventDefault()`), and scope styles to the container class.

### `BUG-027` — 15 ESLint Warnings Across Frontend Components
- **Module:** Frontend Code Quality
- **Severity:** `LOW` | **Priority:** P3
- **Status:** `OPEN`
- **Location:** `CourseAccordionBar.jsx`, `CourseDetailsCard.jsx`, `CourseBuilderForm.jsx`, `Upload.jsx`, `Cart/index.jsx`, `EnrolledCourses.jsx`, `Instructor.jsx`, `SidebarLink.jsx`, `CourseReviewModal.jsx`, `VideoDetails.jsx`, `VideoDetailsSidebar.jsx`, `UpdatePassword.jsx`, `ViewCourse.jsx`
- **Root Cause:** Unused variables (`courseId`, `getValues`, `course`, `total`, `dispatch`, `setPreviewSource`, `navigate`) and incomplete `useEffect` dependency arrays.
- **Suggested Solution:** Clean up unused variables and stabilize `useEffect` callbacks.

---

## Fixed & Verified Bugs (20 Total)

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
| `BUG-010` | `HIGH` | Raw JSON brackets `["WEB DEV"]` rendered in "This Course Includes" | `server/controllers/Course.js` `createCourse` did not `JSON.parse` `tag`/`instructions`; `CourseDetailsCard.jsx` rendered raw JSON strings | `FIXED & VERIFIED` | `server/__tests__/course.test.js` + live `E2E-06` |
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

*\*Note: `BUG-028` was fixed during the live password-reset debugging session (`b4a57b2` + `HashRouter` fix). Total fixed bugs across Cycle #1 + Cycle #2 = 21 distinct defects (20 counted in the Cycle #2 table + `BUG-028` merged into `BUG-001`–`BUG-028`).*
