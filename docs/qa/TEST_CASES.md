# StudyNotion — Master Test Cases Registry

> **Last Updated:** 2026-11-18 (Cycle #5 — `GAP-005`)  
> **Statuses:** `PASS` | `FAIL` | `BLOCKED` | `NOT RUN`  
> **Totals:** **218 Test Cases** (108 Backend Unit/API/Safety + 7 Backend Real-MongoDB Integration + 67 Frontend Automated + 36 Live Playwright E2E — **218 PASS, 0 FAIL, 0 BLOCKED**)

---

## 1. Backend Automated Test Suites (115 Test Cases — 115 PASS, 0 FAIL)

| Suite File | Case IDs | Module / Feature | Scenarios Covered | Status | Related Bugs / Gaps |
|------------|----------|------------------|-------------------|--------|---------------------|
| [`server/__tests__/testSafety.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/testSafety.test.js) | `BE-SF-01` – `BE-SF-10` | Test DB Safety Guardrails (**Cycle #4**) | Requires explicit test mode, rejects missing `MONGODB_TEST_URL`, rejects Atlas/SRV URIs & masks credentials, rejects remote hosts, rejects non-`test`/system DB names, rejects matching `MONGODB_URL`, validates `assertSafeForDestructiveOp` | `PASS` (10/10) | `GAP-009` |
| [`server/__tests__/integration.realdb.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/integration.realdb.test.js) | `BE-DB-01` – `BE-DB-07` | Real Isolated MongoDB Full-Stack Integration (**Cycles #4–#5**) | Real MongoDB 8.0 (`127.0.0.1:27018/studynotion_integration_test`): (1) `sendOTP` -> DB OTP -> `signup` -> `login` -> cookie auth -> `logout` -> 401; (2) `updateProfile` & `changePassword` persistence; (3) enrollment check 403 -> `capturePayment` -> HMAC-SHA256 `verifyPayment` -> `CourseProgress` -> `createRating` -> real `$avg` aggregation; (4) Instructor course/section/subsection CRUD + cascade delete consistency; (5) Student/Instructor/Admin RBAC + cross-instructor IDOR 403; (6) `deleteProfile` cascade across User/Profile; **(7) Cycle #5 `GAP-005`: ₹0 course creation, negative price rejection, draft rejection, unauth/instructor/paid-bypass rejection, direct free enrollment + `CourseProgress` init + My Courses + content access, 409 duplicate protection, cross-user 403** | `PASS` (7/7) | `GAP-009`, `GAP-005`, `BUG-003`, `BUG-004` |
| [`server/__tests__/authMiddleware.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/authMiddleware.test.js) | `BE-MW-01` – `BE-MW-10` | Auth & Role Middleware | Missing token (401), invalid/expired token (401), valid Bearer header, valid cookie token, `isStudent` allow/403, `isInstructor` allow/403, `isAdmin` allow/403 | `PASS` (10/10) | — |
| [`server/__tests__/cache.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/cache.test.js) | `BE-CH-01` – `BE-CH-05` | In-Memory TTL Cache | Cache miss, set/get before TTL, `del`, `clear`, TTL expiration eviction | `PASS` (5/5) | — |
| [`server/__tests__/auth.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/auth.test.js) | `BE-AU-01` – `BE-AU-22` | Auth, Logout & Reset Password | `sendOTP`, `signup`, `login`, `logout` (clears `httpOnly` cookie & blocks subsequent protected Student/Instructor calls with 401), `changePassword`, `resetPasswordToken` (HashRouter `/#/update-password/`), `resetPassword` | `PASS` (22/22) | `BUG-002`, `BUG-028`, `GAP-006` |
| [`server/__tests__/course.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/course.test.js) | `BE-CR-01` – `BE-CR-15` | Course CRUD, Pricing & Access Control | `getAllCourses`, `getCourseDetails`, `createCourse` (incl. `price: 0` allowed & negative price rejected 400 in Cycle #5), `editCourse` (IDOR 403), `deleteCourse` (cascade), `getFullCourseDetails` | `PASS` (15/15) | `BUG-003`, `BUG-004`, `BUG-010`, `GAP-005` |
| [`server/__tests__/section.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/section.test.js) | `BE-SC-01` – `BE-SC-06` | Sections & SubSections | `addSection`, `updateSection`, `deleteSection`, `addSubSection`, `updateSubSection`, `deleteSubSection` | `PASS` (6/6) | `BUG-008` |
| [`server/__tests__/category.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/category.test.js) | `BE-CT-01` – `BE-CT-06` | Categories & Catalog API | `createCategory`, `showAllCategories`, `categoryPageDetails` (0-course category 200) | `PASS` (6/6) | `BUG-005` |
| [`server/__tests__/payment.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/payment.test.js) | `BE-PM-01` – `BE-PM-14` | Razorpay Payment & Free Course Enrollment | `capturePayment` (incl. rejects ₹0 orders 400), `verifyPayment` (HMAC-SHA256), `enrollFreeCourse` (**Cycle #5:** unauth 401, instructor 403, invalid ID 400, paid-course price-tamper bypass 400, negative/draft 400, duplicate 409, valid ₹0 enrollment ignoring spoofed `userId` 200) | `PASS` (14/14) | `BUG-002`, `GAP-005` |
| [`server/__tests__/profile.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/profile.test.js) | `BE-PR-01` – `BE-PR-05` | Profile & Instructor Analytics | `getUserDetails`, `updateProfile`, `deleteProfile`, `instructorDashboard` | `PASS` (5/5) | — |
| [`server/__tests__/ratingReview.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/ratingReview.test.js) | `BE-RR-01` – `BE-RR-08` | Ratings & Reviews | `createRating` (1–5 bounds), `getAverageRating` (GET query param), `getReviews` | `PASS` (8/8) | `BUG-006`, `BUG-020` |
| [`server/__tests__/courseProgress.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/courseProgress.test.js) | `BE-CP-01` – `BE-CP-05` | Course Progress Tracking | Validation, create doc, idempotency, append lecture | `PASS` (5/5) | `BUG-001`, `BUG-007` |
| [`server/__tests__/contact.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/server/__tests__/contact.test.js) | `BE-CO-01` – `BE-CO-02` | Contact Us API | Missing fields (400), valid submission (200) | `PASS` (2/2) | — |

---

## 2. Frontend Automated Test Suites (67 Test Cases — 67 PASS, 0 FAIL)

| Suite File | Case IDs | Module / Feature | Scenarios Covered | Status | Related Bugs |
|------------|----------|------------------|-------------------|--------|--------------|
| [`src/utils/__tests__/avgRating.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/__tests__/avgRating.test.js) | `FE-UT-01` – `FE-UT-05` | `GetAvgRating` | Empty/null/non-array, rounding, invalid filtering | `PASS` (5/5) | — |
| [`src/utils/__tests__/courseDuration.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/__tests__/courseDuration.test.js) | `FE-UT-06` – `FE-UT-12` | `courseDuration` | Duration formatting & `getTotalLectures` | `PASS` (7/7) | — |
| [`src/utils/__tests__/dateFormatter.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/__tests__/dateFormatter.test.js) | `FE-UT-13` – `FE-UT-14` | `formattedDate` | Falsy & valid ISO formatting | `PASS` (2/2) | — |
| [`src/utils/__tests__/videoNavigation.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/utils/__tests__/videoNavigation.test.js) | `FE-UT-18` – `FE-UT-22` | `videoNavigation` | Skips empty leading/middle/trailing sections, unknown IDs | `PASS` (5/5) | `BUG-024` |
| [`src/services/__tests__/formatDate.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/__tests__/formatDate.test.js) | `FE-UT-15` – `FE-UT-17` | `formatDate` | Falsy, malformed, valid date+time | `PASS` (3/3) | — |
| [`src/services/__tests__/apiconnector.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/__tests__/apiconnector.test.js) | `FE-SV-01` – `FE-SV-06` | `apiconnector` 401 Interceptor | Protected 401 expiry, excluded auth paths, unauthenticated, 403/500, debounce | `PASS` (6/6) | `BUG-025` |
| [`src/services/__tests__/authAPI.logout.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/__tests__/authAPI.logout.test.js) | `FE-SV-07` – `FE-SV-08` | `authAPI.logout` | Calls `POST /auth/logout` & wipes state even on error | `PASS` (2/2) | `GAP-006` |
| [`src/slices/__tests__/authSlice.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/slices/__tests__/authSlice.test.js) | `FE-RD-01` – `FE-RD-04` | `authSlice` | Initial state, `setToken`, `setLoading`, `setSignupData` | `PASS` (4/4) | — |
| [`src/slices/__tests__/cartSlice.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/slices/__tests__/cartSlice.test.js) | `FE-RD-05` – `FE-RD-09` | `cartSlice` | Add/duplicate/remove/resetCart | `PASS` (5/5) | — |
| [`src/slices/__tests__/courseSlice.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/slices/__tests__/courseSlice.test.js) | `FE-RD-10` – `FE-RD-15` | `courseSlice` | Step/course/editCourse/paymentLoading/reset | `PASS` (6/6) | — |
| [`src/slices/__tests__/profileSlice.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/slices/__tests__/profileSlice.test.js) | `FE-RD-16` – `FE-RD-18` | `profileSlice` | Corrupted JSON resilience, `setUser`, `setLoading` | `PASS` (3/3) | — |
| [`src/slices/__tests__/viewCourseSlice.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/slices/__tests__/viewCourseSlice.test.js) | `FE-RD-19` – `FE-RD-24` | `viewCourseSlice` | Section data, entire course, lecture count, completed updates | `PASS` (6/6) | — |
| [`src/components/core/Auth/__tests__/RouteGuards.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Auth/__tests__/RouteGuards.test.jsx) | `FE-RG-01` – `FE-RG-04` | `PrivateRoute` & `OpenRoute` | Auth/unauth render & redirect guards | `PASS` (4/4) | — |
| [`src/components/common/__tests__/Footer.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/common/__tests__/Footer.test.jsx) | `FE-UI-01` – `FE-UI-02` | `Footer` | Dynamic categories, safe external links, API fallback | `PASS` (2/2) | `BUG-023` |
| [`src/pages/__tests__/Error.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/pages/__tests__/Error.test.jsx) | `FE-UI-03` | `Error` Page | Direct 404 CTA -> `/`, no global CSS mutation | `PASS` (1/1) | `BUG-026` |
| [`src/components/core/Course/__tests__/CourseDetailsCard.test.jsx`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/components/core/Course/__tests__/CourseDetailsCard.test.jsx) | `FE-UI-04` – `FE-UI-07` | `CourseDetailsCard` Free vs Paid (**Cycle #5**) | Free pricing & Enroll Now CTA (no Cart/Buy Now), Paid UI preserved, `isEnrolling` disabled state, `Go To Course` when enrolled | `PASS` (4/4) | `GAP-005` |
| [`src/services/__tests__/studentFeatureAPI.freeEnroll.test.js`](file:///c:/Users/Suraj%20Kumar/OneDrive/Desktop/CODING/projects/StudyNotion/src/services/__tests__/studentFeatureAPI.freeEnroll.test.js) | `FE-SV-09` – `FE-SV-10` | `enrollFreeCourse` Service (**Cycle #5**) | Posts `{ courses }` without client price, updates Redux/`localStorage` & navigates `/dashboard/enrolled-courses`; surfaces error toast without navigating on failure | `PASS` (2/2) | `GAP-005` |

---

## 3. Live Playwright Browser E2E Tests (36 Executed — 36 PASS, 0 FAIL, 0 BLOCKED)

### Cycles #4 & #5 Isolated Authenticated E2E & Regression Suite (`e2e/authenticated.e2e.js` — 11 PASS, 0 FAIL)

| Case ID | Module | Test Description | Expected Result | Actual Result (Isolated `localhost:3001` + `localhost:4001` + `127.0.0.1:27018`) | Status | Related Bugs / Gaps |
|---------|--------|------------------|-----------------|------------------------------------------------------------------------------------|--------|---------------------|
| `E2E-16` | Student Auth | Live Signup → OTP → Login → Profile Edit → Refresh | Account created with real DB OTP, profile edits persist across hard refresh | `otpLen=6`, `loginStatus=200`, `persistedAfterRefresh=true` | `PASS` | `GAP-009`, `BUG-013` |
| `E2E-17` | Student Auth | Live Cart → Razorpay Checkout (Sandbox Mock) → Enrollment | Valid INR order created, HMAC verified, student enrolled & cart emptied | `verifyStatus=200`, `rzpOpts={currency:"INR",amount:"99900"}`, `enrolledVisible=true`, `cartCountAfter=null` | `PASS` | `GAP-009`, `BUG-009` |
| `E2E-18` | Student Auth | Live ViewCourse Video Playback + Mark Complete + Next + Add Review | Local sample MP4 loads, completion updates `1 / 2`, Next goes to Lesson 2, 5-star review submits & closes modal | `videoPresent=true`, `progStatus=200`, `progressUpdated=true`, `movedToLesson2=true`, `ratingStatus=200`, `modalClosed=true` | `PASS` | `GAP-009`, `BUG-020`, `BUG-024` |
| `E2E-19` | Instructor Auth | Live Create Course (3 steps) + Upload Thumbnail & Video + Publish | Multipart thumbnail & video uploaded (mocked Cloudinary), published course appears in My Courses | `create=200`, `subSection=200`, `publish=200`, `visibleInMyCourses=true` | `PASS` | `GAP-009`, `BUG-010` |
| `E2E-20` | Instructor Auth | Live Edit Course + Delete Course + Instructor Dashboard Chart | Course title edited & saved, deleted via `ConfirmationModal`, Analytics stats & Chart.js `<canvas>` rendered | `edit=200`, `delete=200`, `removed=true`, `chartCanvas=true`, `statsVisible=true` | `PASS` | `GAP-009`, `BUG-016`, `BUG-029` |
| `E2E-21` | Settings Auth | Live Update Password + Delete Account Confirmation Modal | Password updated, re-login succeeds with new password, Cancel keeps account, Confirm deletes account & post-delete login returns 401 | `pwUpdate=200`, `newLogin=200`, `cancelWorked=true`, `deleteStatus=200`, `tokenCleared=true`, `postDeleteLogin=401` | `PASS` | `GAP-009`, `BUG-015` |
| `E2E-22` | Student Free Course (**Cycle #5**) | Free (₹0) Course Direct Enrollment & Content Access | Catalog & Course Details show `"Free"` & `"Enroll Now"` (no `"Add to Cart"` / `"Buy Now"`), 0 Razorpay hits, redirects to Enrolled Courses, lecture accessible, Course Details switches to `"Go To Course"` | `enrollStatus=200`, `razorpayHits=0`, `catalogFree=true`, `noCartBtn=true`, `canAccessLesson=true`, `showsGoToCourse=true` | `PASS` | `GAP-005` |
| `E2E-23` | Instructor Free Course (**Cycle #5**) | Instructor Creates & Publishes ₹0 Course via `CoursesTable` | Instructor creates ₹0 Draft course, My Courses shows `"Free"`, status pill publishes without price error | `create=200`, `displaysFree=true`, `publishToggle=200`, `publishedNow=true` | `PASS` | `GAP-005` |
| `REG-01` | Footer | All unique internal footer routes in isolated env | 0 broken links | `checked=8`, `broken=[]` | `PASS` | `BUG-023` |
| `REG-02` | Error Page | Direct 404 landing in isolated env | No body overflow lock, CTA -> Home | `bodyOverflow=hidden auto`, `ctaNavigatedHome=true` | `PASS` | `BUG-026` |
| `REG-03` | Responsive | Mobile `375x812` layout in isolated env | No horizontal overflow, 0 page errors, 0 Swiper warnings | `horizontalOverflow=false`, `PAGE ERRORS: 0`, `SWIPER WARNINGS: 0` | `PASS` | `BUG-021` |

### Cycle #3 Live Verification & Regression Cases (7 Executed — 7 PASS, 0 FAIL)

| Case ID | Module | Test Description | Actual Result | Status | Related Bugs |
|---------|--------|------------------|---------------|--------|--------------|
| `C3-E2E-01` | Footer | Audit every unique internal link in `<footer>` | Tested all 8 unique internal footer routes; `broken=[]` | `PASS` | `BUG-023` |
| `C3-E2E-02` | Error Page | Direct 404 landing in fresh tab | `bodyOverflow=hidden auto`, `navbarVisible=true`, `ctaNavigatedHome=true` | `PASS` | `BUG-026` |
| `C3-E2E-03` | Auth (Student) | Expired JWT on `#/dashboard/enrolled-courses` | `tokenCleared=true`, `redirectedToLogin=true`, `expiryToast=true` | `PASS` | `BUG-025` |
| `C3-E2E-04` | Auth (Instructor) | Expired JWT on `#/dashboard/instructor` | `tokenCleared=true`, `redirectedToLogin=true` | `PASS` | `BUG-025` |
| `C3-E2E-05` | Auth (Negative) | Invalid credentials on `#/login` in fresh tab | `httpStatus=401`, `loginErrorShown=true`, `noFalseSessionExpiry=true` | `PASS` | `BUG-025` |
| `C3-E2E-06` | Course Details | Navigate from Catalog to Course Details | `rawJsonBrackets=false` | `PASS` | `BUG-010` |
| `C3-E2E-07` | Responsive | Mobile `375x812` homepage regression | `horizontalOverflow=false`, `PAGE ERRORS: 0`, `SWIPER WARNINGS: 0` | `PASS` | `BUG-021` |

### Cycle #2 Live Verification Cases (18 Executed — 18 PASS, 0 FAIL)

| Case ID | Module | Test Description | Actual Result | Status | Related Bugs |
|---------|--------|------------------|---------------|--------|--------------|
| `E2E-01` | Homepage | Load `/#/` | Hero visible, 0 page errors | `PASS` | — |
| `E2E-02` | Navbar | Hover Catalog dropdown | 3 live categories loaded | `PASS` | `BUG-017` |
| `E2E-03` | Homepage | Click all 5 ExploreMore tabs | All 5 tabs switched cleanly | `PASS` | — |
| `E2E-04` | Homepage | ReviewSlider & console check | 8 slides, `0` Swiper warnings | `PASS` | `BUG-021` |
| `E2E-05a`–`05d` | Catalog | Visit all 3 categories + `Most Popular` vs `New` tab sorting | All categories render; tab sort updates card order | `PASS` (4) | `BUG-005`, `BUG-017` |
| `E2E-06` | Course Details | Valid course instructions, accordion, logged-out Buy Now modal | `rawJsonBrackets=false`, `loggedOutModal=true`, `accordionToggled=true` | `PASS` | `BUG-010` |
| `E2E-07` | Course Details | Invalid course ID `/#/courses/000000000000000000000000` | `stuckSpinner=false`, renders 404 Error page + toast | `PASS` | `BUG-011` |
| `E2E-08` | About | Load `/#/about` | All sections rendered cleanly | `PASS` | — |
| `E2E-09` | Contact | Submit empty Contact form | All 4 required field validations shown | `PASS` | `BUG-018` |
| `E2E-10` | Auth | Login with unregistered email | 401 + error toast, stays on `/#/login` | `PASS` | — |
| `E2E-11` | Auth | Signup with mismatched passwords | `mismatchToast=true`, inputs preserved | `PASS` | `BUG-019` |
| `E2E-12` | Auth | Direct visit to `/#/verify-email` without `signupData` | Redirected to `/#/signup` | `PASS` | — |
| `E2E-13` | Auth | Direct visit to `/#/dashboard/my-profile` logged out | Redirected to `/#/login` | `PASS` | — |
| `E2E-14` | Footer/404 | Pre-fix `/#/careers` audit | Rendered 404 page; superseded by `C3-E2E-01` & `REG-01` | `PASS` | `BUG-023` |
| `E2E-15` | Responsive | Mobile viewport `375x812` + hamburger menu | `overflow=false`, `drawerOk=true` | `PASS` | — |
