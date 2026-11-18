# StudyNotion — Complete Feature Matrix

> **Last Updated:** 2026-11-18  
> **Rule:** Implementation Status and Test Status are tracked **independently**.  
> **Implementation Statuses:** `FULLY IMPLEMENTED` | `PARTIALLY IMPLEMENTED` | `IMPLEMENTED BUT BROKEN` | `NOT IMPLEMENTED` | `BLOCKED / NOT VERIFIED`  
> **Test Statuses:** `PASS` | `PASS (MOCKED)` | `PARTIAL` | `FAIL` | `BLOCKED` | `NOT RUN`

---

## Module A — Authentication & Security (12 Features)

| ID | Feature | Impl. Status | Frontend | Backend | API Integration | Test Status | Missing Pieces / Related Bugs | Next Action |
|----|---------|--------------|----------|---------|-----------------|-------------|-------------------------------|-------------|
| `F-AUTH-01` | Send OTP for Signup | `FULLY IMPLEMENTED` | `SignupForm.jsx` | `Auth.js` (`sendOTP`) | Connected | `PASS (MOCKED)` | Fixed `BUG-019` (form wipe on error); rate-limited (`sendOtpLimiter`) | Add live E2E with test inbox |
| `F-AUTH-02` | User Signup + OTP Verification | `FULLY IMPLEMENTED` | `VerifyEmail.jsx` | `Auth.js` (`signUp`) | Connected | `PASS (MOCKED)` | Fixed `BUG-002` (`contactNumber` schema); 5-min TTL verified | Add authenticated E2E test |
| `F-AUTH-03` | User Login (JWT + Cookie) | `FULLY IMPLEMENTED` | `LoginForm.jsx` | `Auth.js` (`login`) | Connected | `PASS` | Verified 401 toast live (`E2E-10`) & 200 JWT/cookie in `auth.test.js` | Done |
| `F-AUTH-04` | Logout (Client Session Wipe) | `PARTIALLY IMPLEMENTED` | `authAPI.js` (`logout`) | None (stateless) | Client-only | `PARTIAL` | No server-side `/logout` endpoint to clear `httpOnly` cookie or revoke JWT | Add `POST /auth/logout` to clear cookie |
| `F-AUTH-05` | Forgot Password Email | `FULLY IMPLEMENTED` | `ForgotPassword.jsx` | `ResetPassword.js` | Connected | `PASS` | Fixed HashRouter `/#/update-password/` link + dynamic origin | Done |
| `F-AUTH-06` | Reset Password via Token | `FULLY IMPLEMENTED` | `UpdatePassword.jsx` | `ResetPassword.js` | Connected | `PASS` | Fixed false success screen on failed reset (`authAPI.js` return bool) | Done |
| `F-AUTH-07` | Change Password (Authenticated) | `FULLY IMPLEMENTED` | `Settings/UpdatePassword.jsx` | `Auth.js` (`changePassword`) | Connected | `PASS (MOCKED)` | Fixed `BUG-013b` (navigated away even when old password wrong) | Done |
| `F-AUTH-08` | Session Persistence (Refresh) | `FULLY IMPLEMENTED` | `authSlice.js`, `profileSlice.js` | JWT cookie + Bearer | Connected | `PASS` | Fixed `BUG-013a` (sync `localStorage` on profile/avatar updates) | Done |
| `F-AUTH-09` | JWT Expiry Handling | `PARTIALLY IMPLEMENTED` | `apiconnector.js` | `middlewares/auth.js` | Partial | `PASS (MOCKED)` | Backend returns 401 properly; frontend lacks global 401 interceptor (`BUG-025`) | Add Axios response interceptor for 401 |
| `F-AUTH-10` | Protected & Open Route Guards | `FULLY IMPLEMENTED` | `PrivateRoute.jsx`, `OpenRoute.jsx` | `middlewares/auth.js` | Connected | `PASS` | Verified via Jest (`RouteGuards.test.jsx`) & live Playwright (`E2E-12`, `E2E-13`) | Done |
| `F-AUTH-11` | Role-Based Access Control | `FULLY IMPLEMENTED` | `App.jsx` role guards | `isStudent`, `isInstructor`, `isAdmin` | Connected | `PASS` | Fixed `BUG-003` (IDOR on `editCourse`) & `BUG-014` (`App.jsx` role routes) | Done |
| `F-AUTH-12` | Instructor Approval Workflow | `NOT IMPLEMENTED` | None | `User.approved` set to `false` | Not enforced | `NOT RUN` | `Auth.js` sets `approved = accountType !== "Instructor"`, but `User.js` has no `approved` field & login never checks it | Implement Admin approval UI or remove dead flag |

---

## Module B — Student Module (14 Features)

| ID | Feature | Impl. Status | Frontend | Backend | API Integration | Test Status | Missing Pieces / Related Bugs | Next Action |
|----|---------|--------------|----------|---------|-----------------|-------------|-------------------------------|-------------|
| `F-STU-01` | Course Catalog Browsing | `FULLY IMPLEMENTED` | `Catalog.jsx`, `CourseCard.jsx` | `Category.js` (`categoryPageDetails`) | Connected | `PASS` | Fixed `BUG-005` (empty category 404), `BUG-017` (slugify + error state) | Done |
| `F-STU-02` | Catalog Tab Sorting (Popular/New) | `FULLY IMPLEMENTED` | `Catalog.jsx` | Client-side sort | Connected | `PASS` | Fixed `BUG-017a` (tabs now actually sort by enrolled count vs `createdAt`; verified live `E2E-05b`) | Done |
| `F-STU-03` | Global Course Search | `NOT IMPLEMENTED` | None | None | Missing | `NOT RUN` | No search bar in Navbar or Catalog; no backend search endpoint | Implement `GET /course/search?q=...` + Navbar search input |
| `F-STU-04` | Advanced Filters & Pagination | `NOT IMPLEMENTED` | None | None | Missing | `NOT RUN` | No price/rating/duration filters; no pagination on `getAllCourses` or catalog | Add query params & pagination controls |
| `F-STU-05` | Course Details Page | `FULLY IMPLEMENTED` | `CourseDetails.jsx`, `CourseDetailsCard.jsx` | `Course.js` (`getCourseDetails`) | Connected | `PASS` | Fixed `BUG-010` (JSON brackets in instructions), `BUG-011` (invalid ID spinner) | Done |
| `F-STU-06` | Course Content Accordion | `FULLY IMPLEMENTED` | `CourseAccordionBar.jsx` | Populated `courseContent` | Connected | `PASS` | Verified live expand/collapse (`E2E-06`) | Done |
| `F-STU-07` | Shopping Cart / Wishlist | `PARTIALLY IMPLEMENTED` | `cartSlice.js`, `Cart/` | None (localStorage only) | Client-only | `PASS` | Works across reloads (`cartSlice.test.js`), but not persisted in MongoDB across devices | Optional: persist cart in DB |
| `F-STU-08` | Razorpay Payment Capture & Verify | `BLOCKED / NOT VERIFIED` | `studentFeatureAPI.js` | `Payments.js` | Connected | `PASS (MOCKED)` | Fixed critical `BUG-009` (`orderResponse.data.message.currency/amount`) & `BUG-002`; live Razorpay modal checkout not run in headless E2E | Test live in Razorpay sandbox checkout |
| `F-STU-09` | Payment Receipt & Enrollment Emails | `FULLY IMPLEMENTED` | `studentFeatureAPI.js` | `Payments.js` + `mailSender.js` | Connected | `PASS (MOCKED)` | Verified in `payment.test.js` with mocked SMTP | Done |
| `F-STU-10` | Enrolled Courses List | `FULLY IMPLEMENTED` | `EnrolledCourses.jsx` | `Profile.js` (`getEnrolledCourses`) | Connected | `PASS (MOCKED)` | Fixed `BUG-022a` (empty course navigation guard + null description safety) | Add live authenticated E2E |
| `F-STU-11` | Course Video Player & Navigation | `PARTIALLY IMPLEMENTED` | `ViewCourse.jsx`, `VideoDetails.jsx`, `VideoDetailsSidebar.jsx` | `Course.js` (`getFullCourseDetails`) | Connected | `PASS (MOCKED)` | Open `BUG-024`: Next/Prev crashes if an intermediate section has 0 subsections | Guard empty sections in `VideoDetails.jsx` |
| `F-STU-12` | Lecture Progress Tracking | `FULLY IMPLEMENTED` | `VideoDetails.jsx` | `courseProgress.js` | Connected | `PASS (MOCKED)` | Fixed `BUG-001` (`ref: "User"`) & `BUG-007` (required field validation) | Add live authenticated E2E |
| `F-STU-13` | Course Ratings & Reviews | `FULLY IMPLEMENTED` | `CourseReviewModal.jsx`, `ReviewSlider.jsx` | `RatingAndReview.js` | Connected | `PASS (MOCKED)` | Fixed `BUG-006` (GET query param), `BUG-020` (1-5 validation), `BUG-021` (Swiper warning) | Done |
| `F-STU-14` | Student Profile & Settings | `FULLY IMPLEMENTED` | `MyProfile.jsx`, `Settings/` | `Profile.js` | Connected | `PASS (MOCKED)` | Fixed `BUG-012`, `BUG-013`, `BUG-015` (Delete confirmation), `BUG-022b` (display About/DOB/Gender) | Add live authenticated E2E |

---

## Module C — Instructor Module (12 Features)

| ID | Feature | Impl. Status | Frontend | Backend | API Integration | Test Status | Missing Pieces / Related Bugs | Next Action |
|----|---------|--------------|----------|---------|-----------------|-------------|-------------------------------|-------------|
| `F-INS-01` | Instructor Analytics Dashboard | `FULLY IMPLEMENTED` | `Instructor.jsx`, `InstructorChart.jsx` | `Profile.js` (`instructorDashboard`) | Connected | `PASS (MOCKED)` | Fixed `BUG-016` (null crash in `InstructorChart`) | Add live authenticated E2E |
| `F-INS-02` | Create Course (Step 1) | `FULLY IMPLEMENTED` | `CourseInformationForm.jsx` | `Course.js` (`createCourse`) | Connected | `PASS (MOCKED)` | Fixed `BUG-010` (`JSON.parse` on `tag` and `instructions`) | Done |
| `F-INS-03` | Edit Course | `FULLY IMPLEMENTED` | `EditCourse/index.jsx`, `CourseInformationForm.jsx` | `Course.js` (`editCourse`) | Connected | `PASS (MOCKED)` | Fixed critical `BUG-003` (instructor ownership check); category change disabled by design | Done |
| `F-INS-04` | Delete Course (Cascade) | `FULLY IMPLEMENTED` | `CoursesTable.jsx` | `Course.js` (`deleteCourse`) | Connected | `PASS (MOCKED)` | Fixed `BUG-004` (cleans instructor, category, and student refs) | Done |
| `F-INS-05` | Publish / Unpublish Course | `FULLY IMPLEMENTED` | `PublishCourse/index.jsx`, `CoursesTable.jsx` | `Course.js` (`editCourse`) | Connected | `PASS (MOCKED)` | Pre-publish validation checklist works in `CoursesTable.jsx` | Done |
| `F-INS-06` | Section CRUD (Create/Edit/Delete) | `FULLY IMPLEMENTED` | `CourseBuilderForm.jsx`, `NestedView.jsx` | `Section.js` | Connected | `PASS (MOCKED)` | Standardized response payload (`data` + `updatedCourseDetails`) | Done |
| `F-INS-07` | SubSection / Lecture CRUD | `FULLY IMPLEMENTED` | `SubSectionModal.jsx`, `NestedView.jsx` | `Subsection.js` | Connected | `PASS (MOCKED)` | Fixed `BUG-008` (`video` vs `videoFile` upload field + consistent section return) | Done |
| `F-INS-08` | Thumbnail & Video Uploads (Cloudinary) | `BLOCKED / NOT VERIFIED` | `Upload.jsx` | `imageUploader.js` | Connected | `PASS (MOCKED)` | Mocked in Jest; live large video upload not executed to avoid polluting production Cloudinary folder | Test with dedicated Cloudinary test folder |
| `F-INS-09` | My Courses Table | `FULLY IMPLEMENTED` | `MyCourses.jsx`, `CoursesTable.jsx` | `Course.js` (`getInstructorCourses`) | Connected | `PASS (MOCKED)` | Works cleanly with confirmation modal on delete | Done |
| `F-INS-10` | Manage Course Pricing | `PARTIALLY IMPLEMENTED` | `CourseInformationForm.jsx` | `Course.js` | Connected | `PASS (MOCKED)` | Free courses (`price = 0`) allowed in form, but `CoursesTable.jsx` line 116 blocks publishing when `price <= 0` and Razorpay rejects 0 INR orders | Decide policy for free courses (bypass Razorpay for ₹0) |
| `F-INS-11` | View Enrolled Students List | `PARTIALLY IMPLEMENTED` | `Instructor.jsx` | `Profile.js` (`instructorDashboard`) | Connected | `PASS (MOCKED)` | Shows student *count* and revenue only — no student roster/names/emails view | Optional: add enrolled student roster modal |
| `F-INS-12` | Instructor Profile Management | `FULLY IMPLEMENTED` | `MyProfile.jsx`, `Settings/` | `Profile.js` | Connected | `PASS (MOCKED)` | Shared with Student profile module | Done |

---

## Module D — Admin & Categories (3 Features)

| ID | Feature | Impl. Status | Frontend | Backend | API Integration | Test Status | Missing Pieces / Related Bugs | Next Action |
|----|---------|--------------|----------|---------|-----------------|-------------|-------------------------------|-------------|
| `F-ADM-01` | Create Category API | `PARTIALLY IMPLEMENTED` | **None** | `Category.js` (`createCategory`, `isAdmin`) | Backend only | `PASS (MOCKED)` | Backend works (`category.test.js`), zero Admin UI to create/manage categories | Build Admin Category Management page |
| `F-ADM-02` | Show All Categories | `FULLY IMPLEMENTED` | `Navbar.jsx`, `Catalog.jsx`, `CourseInformationForm.jsx` | `Category.js` (`showAllCategories`) | Connected | `PASS` | Cached (5 min TTL) + verified live (`E2E-02`) | Done |
| `F-ADM-03` | Admin Dashboard / User Management | `NOT IMPLEMENTED` | None | None | Missing | `NOT RUN` | `ACCOUNT_TYPE.ADMIN` exists in constants & `isAdmin` middleware, but no Admin routes or UI | Build Admin dashboard or remove unused role |

---

## Module E — Common / Public UI (10 Features)

| ID | Feature | Impl. Status | Frontend | Backend | API Integration | Test Status | Missing Pieces / Related Bugs | Next Action |
|----|---------|--------------|----------|---------|-----------------|-------------|-------------------------------|-------------|
| `F-COM-01` | Homepage & ExploreMore | `FULLY IMPLEMENTED` | `Home.jsx`, `ExploreMore.jsx`, `CodeBlocks.jsx` | Static + `ReviewSlider` | Connected | `PASS` | Verified live (`E2E-01`, `E2E-03`, `E2E-04`) | Done |
| `F-COM-02` | Responsive Navbar & Mobile Drawer | `FULLY IMPLEMENTED` | `Navbar.jsx`, `ProfileDropdown.jsx` | `showAllCategories` | Connected | `PASS` | Fixed `BUG-017c` (slugify); verified desktop & 375px mobile (`E2E-02`, `E2E-15`) | Done |
| `F-COM-03` | Footer Navigation | `IMPLEMENTED BUT BROKEN` | `Footer.jsx`, `footer-links.js` | N/A | N/A | `FAIL` | **`BUG-023`:** 60+ internal links (`/careers`, `/blog`, `/privacy`, `/terms`, `/cookies`, etc.) all lead to 404 | Map valid links or build pages / clean up dead links |
| `F-COM-04` | About Us Page | `FULLY IMPLEMENTED` | `About.jsx`, `Stats.jsx`, `LearningGrid.jsx` | `ContactUsForm` + `ReviewSlider` | Connected | `PASS` | Verified live (`E2E-08`) | Done |
| `F-COM-05` | Contact Us Form & Page | `FULLY IMPLEMENTED` | `Contact.jsx`, `ContactUsForm.jsx` | `ContactUs.js` | Connected | `PASS` | Fixed `BUG-018` (added toast feedback & reset-only-on-success); verified live (`E2E-09`) | Done |
| `F-COM-06` | Custom 404 Error Page | `PARTIALLY IMPLEMENTED` | `Error.jsx` | N/A | N/A | `PASS` | Renders cleanly (`E2E-14`), but `BUG-026`: `navigate(-1)` does nothing when landing directly from external link + `<style>` overrides global `overflow` | Fall back to `navigate("/")` & scope CSS |
| `F-COM-07` | Loading Indicators & Route Suspense | `FULLY IMPLEMENTED` | `App.jsx` (`PageLoader`), spinners | N/A | N/A | `PASS` | Fixed infinite spinners in `CourseDetails.jsx` & `Catalog.jsx` | Done |
| `F-COM-08` | In-App Notifications / Announcements | `NOT IMPLEMENTED` | None | None | Missing | `NOT RUN` | Mentioned in `EditCourse` Upload Tips ("Make Announcements to notify enrolled students"), not implemented anywhere | Optional enhancement (`GAP-007`) |
| `F-COM-09` | Quizzes & Assignments | `NOT IMPLEMENTED` | None | None | Missing | `NOT RUN` | Mentioned on Homepage hero & Course Upload Tips, no models/API/UI | Optional enhancement (`GAP-008`) |
| `F-COM-10` | Course Completion Certificates | `NOT IMPLEMENTED` | None | None | Missing | `NOT RUN` | Standard Ed-Tech expectation once progress hits 100%, not implemented | Optional enhancement (`GAP-009`) |

---

## Module F — Backend Infrastructure & Tooling (3 Features)

| ID | Feature | Impl. Status | Frontend | Backend | API Integration | Test Status | Missing Pieces / Related Bugs | Next Action |
|----|---------|--------------|----------|---------|-----------------|-------------|-------------------------------|-------------|
| `F-INF-01` | In-Memory Caching & Rate Limiting | `FULLY IMPLEMENTED` | N/A | `cache.js`, `rateLimiters.js` | N/A | `PASS` | Verified in `cache.test.js` | Done |
| `F-INF-02` | Production Build & SPA Routing (`vercel.json`) | `FULLY IMPLEMENTED` | `package.json`, `vercel.json` | `server/index.js` | Connected | `PASS` | Build exits 0; ESLint has 15 minor warnings (`BUG-027`) | Clean up ESLint warnings |
| `F-INF-03` | Isolated MongoDB Test Database | `NOT IMPLEMENTED` | N/A | Jest mocks only | N/A | `NOT RUN` | `mongodb-memory-server` binary download stalled on OneDrive/Windows; all backend tests currently use mocked Mongoose models | Configure local MongoDB or Docker test DB for real DB integration tests |
