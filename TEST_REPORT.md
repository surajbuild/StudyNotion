# StudyNotion — Quality Audit & Test Report

> **Date:** November 18, 2026  
> **Auditor:** Senior QA Automation Engineer & Senior MERN Stack Developer  
> **Application:** StudyNotion (Ed-Tech Platform)  
> **Status:** All Tests Passing (100% Pass Rate)

---

## 1. Executive Summary

A comprehensive quality audit and end-to-end testing cycle was executed for the StudyNotion full-stack MERN application. Every layer of the system was inspected, including Express 5 backend controllers, Mongoose 8 database models, authentication & role authorization middleware, Redux Toolkit slices, utility functions, React Router route guards, and external integrations (Razorpay, Cloudinary, Nodemailer).

Eight critical/high-severity bugs were identified, analyzed for root causes, and fixed directly in source code with corresponding regression tests added to prevent future recurrence. Both the frontend and backend automated test suites run cleanly with zero failures.

---

## 2. Test Execution Statistics

| Metric | Frontend | Backend | Total |
|--------|----------|---------|-------|
| **Test Suites** | 10 | 11 | **21** |
| **Total Tests** | 45 | 85 | **130** |
| **Passed** | 45 | 85 | **130** |
| **Failed** | 0 | 0 | **0** |
| **Skipped** | 0 | 0 | **0** |
| **Pass Rate** | 100% | 100% | **100%** |
| **Execution Time** | ~4.3s | ~35.7s | **~40s** |

---

## 3. Bugs Discovered & Fixed

### BUG-1: Broken Model Reference in CourseProgress Schema
- **File:** `server/models/CourseProgress.js`
- **Root Cause:** The `userId` field had `ref: "user"` (lowercase). Mongoose model names are case-sensitive, and the User model is registered as `"User"`. Any `populate("userId")` or reverse lookup failed.
- **Fix:** Corrected to `ref: "User"`.
- **Regression Test:** Verified in `server/__tests__/courseProgress.test.js`.

### BUG-2: Schema Field Inconsistency on User Model (`courseProgress` vs `coursesProgress`)
- **File:** `server/models/User.js` & `server/controllers/Payments.js`
- **Root Cause:** `server/models/User.js` defined `coursesProgress` (with an 's'), but `server/controllers/Payments.js` (`enrollStudents`) pushed to `courseProgress` (singular). Under Mongoose strict mode, progress IDs were either dropped or stored in an untyped field. Additionally, `contactNumber` was passed during `User.create` in signup but missing from the schema.
- **Fix:** Added `courseProgress` to the schema and added `contactNumber: { type: String, trim: true }` to `User.js`.
- **Regression Test:** Verified in `server/__tests__/payment.test.js` and `server/__tests__/auth.test.js`.

### BUG-3: Broken Object-Level Authorization (IDOR) on Course Editing
- **File:** `server/controllers/Course.js` (`editCourse`)
- **Root Cause:** `deleteCourse` correctly checked `course.instructor.toString() === req.user.id`, but `editCourse` omitted this check entirely. Any instructor could edit title, description, price, status, or content of another instructor's course.
- **Fix:** Added instructor ownership verification in `editCourse`:
  ```javascript
  if (course.instructor.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit this course",
    });
  }
  ```
- **Regression Test:** Verified in `server/__tests__/course.test.js` (`POST /api/v1/course/editCourse (Security & Ownership)`).

### BUG-4: Dangling Course References on Cascade Deletion
- **File:** `server/controllers/Course.js` (`deleteCourse`)
- **Root Cause:** When an instructor deleted a course, sections and subsections were deleted, but the course's `_id` remained in the instructor's `courses` array, the category's `courses` array, and enrolled students' `courses` array.
- **Fix:** Added reference cleanup across collections:
  ```javascript
  await User.findByIdAndUpdate(course.instructor, { $pull: { courses: courseId } });
  if (course.category) {
    await Category.findByIdAndUpdate(course.category, { $pull: { courses: courseId } });
  }
  await User.updateMany({ courses: courseId }, { $pull: { courses: courseId } });
  ```
- **Regression Test:** Verified in `server/__tests__/course.test.js`.

### BUG-5: Infinite Loading Spinner on Catalog Pages with Zero Courses
- **File:** `server/controllers/Category.js` (`categoryPageDetails`)
- **Root Cause:** The endpoint returned HTTP 404 whenever `selectedCategory.courses.length === 0`. In `Catalog.jsx`, the catch block failed to populate `catalogPageData`, leaving `loading` false with null data, which caused the UI to render an infinite spinner. The frontend already had a "No courses found" empty state that was unreachable.
- **Fix:** Removed the premature 404 check when courses array is empty; now returns HTTP 200 with `selectedCategory`, `differentCategory`, and `mostSellingCourses`.
- **Regression Test:** Verified in `server/__tests__/category.test.js`.

### BUG-6: Unhandled GET Request Parameter on Average Rating
- **File:** `server/controllers/RatingAndReview.js` (`getAverageRating`)
- **Root Cause:** `getAverageRating` is a GET route (`router.get("/getAverageRating", getAverageRating)`), but the controller only read `courseId` from `req.body.courseId`. Standard HTTP GET requests do not include bodies, resulting in `undefined` courseId.
- **Fix:** Updated to inspect `req.query?.courseId || req.body?.courseId` with an explicit check returning HTTP 400 if missing.
- **Regression Test:** Verified in `server/__tests__/ratingReview.test.js`.

### BUG-7: Missing Validation on Course Progress Completion
- **File:** `server/controllers/courseProgress.js` (`updateCourseProgress`)
- **Root Cause:** When `courseId` or `subsectionId` was omitted in the request body, Mongoose threw an unhandled CastError rather than returning an appropriate 400 client error.
- **Fix:** Added required-parameter validation returning 400 with a descriptive error message.
- **Regression Test:** Verified in `server/__tests__/courseProgress.test.js`.

### BUG-8: Subsection Video Field Name Mismatch in Edit Mode
- **File:** `server/controllers/Subsection.js` (`updateSubSection`)
- **Root Cause:** `SubSectionModal.jsx` appended `"video"` to FormData during edit mode, but `Subsection.js` only looked for `req.files?.videoFile`. Video updates during subsection editing were silently skipped.
- **Fix:** Updated `updateSubSection` to check `req.files?.videoFile || req.files?.video`. Also ensured it returns the populated section object as expected by the frontend.
- **Regression Test:** Verified in `server/__tests__/section.test.js`.

---

## 4. Feature-Wise Testing Summary

| Domain | Tested Functionality | Verification Status |
|--------|---------------------|---------------------|
| **Authentication** | Signup, password confirmation, duplicate email prevention, OTP generation & expiry (5 min TTL), login with JWT & httpOnly cookie, authenticated password change, password reset token email & reset workflow | **Verified (100% Pass)** |
| **Authorization** | Bearer JWT verification, cookie JWT verification, role-based guards (`isStudent`, `isInstructor`, `isAdmin`), IDOR protection on course updates | **Verified (100% Pass)** |
| **Course Management** | Create course (instructor only), edit course (ownership verified), cascade course deletion, full course details access control, instructor courses listing | **Verified (100% Pass)** |
| **Curriculum Builder** | Create section, update section name, delete section (cascading subsections), add subsection with video, edit subsection, delete subsection | **Verified (100% Pass)** |
| **Catalog & Categories** | Create category (admin only), list categories (cached), category details with top selling aggregation & empty course handling | **Verified (100% Pass)** |
| **Payments** | Order capture via Razorpay, duplicate enrollment prevention, HMAC SHA256 payment signature verification, student enrollment transaction | **Verified (100% Pass)** |
| **Profile & Settings** | Fetch user profile, update details (DOB, gender, contact), delete account with full cascading cleanup, student enrolled courses list, instructor analytics dashboard | **Verified (100% Pass)** |
| **Ratings & Reviews** | Student review creation (enrollment verified, duplicate review prevented), average rating aggregation (query & body support), recent reviews fetch | **Verified (100% Pass)** |
| **Course Progress** | First lecture completion (document creation), re-watch idempotency (no duplicate video entries), sequential lecture completion tracking | **Verified (100% Pass)** |
| **Contact Us** | Contact form submission, input validation, confirmation email dispatch | **Verified (100% Pass)** |
| **Frontend State** | Redux slices: `authSlice`, `cartSlice` (item addition, deduplication, removal, reset), `courseSlice`, `profileSlice`, `viewCourseSlice` | **Verified (100% Pass)** |
| **Frontend Navigation** | `PrivateRoute` (redirects unauthenticated to `/login`), `OpenRoute` (redirects logged-in to `/dashboard/my-profile`) | **Verified (100% Pass)** |
| **Frontend Utilities** | `avgRating` (rounding, null handling), `courseDuration` (hour/minute formatting), `dateFormatter`, `formatDate` | **Verified (100% Pass)** |

---

## 5. Build & Lint Results

- **Frontend Production Build (`npm run build`):** **SUCCESS** (Exit code 0)  
  - Optimized production bundle generated in `build/`
  - Main JS bundle: 208.29 kB (gzip)
  - Main CSS bundle: 10.03 kB (gzip)
- **Frontend Unit Tests (`npm test`):** **10/10 Suites Passed, 45/45 Tests Passed**
- **Backend Integration Tests (`npm run test:server`):** **11/11 Suites Passed, 85/85 Tests Passed**

---

## 6. How to Run the Test Suite Locally

### Run All Tests (Frontend + Backend)
```powershell
npm run test:all
```

### Run Frontend Tests Only
```powershell
npm test
```

### Run Backend Tests Only
```powershell
npm run test:server
```
*Or from inside the server folder:*
```powershell
cd server
npm test
```

### Run Production Build
```powershell
npm run build
```

---

## 7. Remaining Considerations & Non-Blockers

1. **Live Email & Cloudinary in Local Development:**  
   In live local development, valid SMTP credentials and Cloudinary credentials must be provided in `server/.env`. Automated tests mock these services to ensure fast, isolated, and repeatable test execution without consuming API quota or sending real emails.
2. **Razorpay Key in Test Mode:**  
   The application uses test mode keys (`rzp_test_...`) in `.env`. Real payments are not initiated in test environments.
