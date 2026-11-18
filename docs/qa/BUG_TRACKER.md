# StudyNotion — Bug Tracker & Root Cause Analysis

> **Last Updated:** 2026-11-18  
> **Audit Cycle:** Cycle #4 (`GAP-009`)  
> **Severity Levels:** `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`  
> **Total Logged:** 27 (`BUG-001`–`BUG-029`, excluding unused gap) | **Fixed & Verified:** 27 | **Open:** 0

---

## Open Bugs

*None — all tracked bugs across Cycles #1, #2, #3, and #4 have been fixed and verified.*

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
