# StudyNotion — Complete Test Plan & Feature Inventory

> **Generated:** 2026-11-18  
> **Project:** MERN Stack Ed-Tech Platform  
> **Stack:** React 18 + Redux Toolkit + React Router 7 (frontend) | Express 5 + Mongoose 8 + MongoDB (backend)  
> **External Services:** Razorpay (payments), Cloudinary (media uploads), Nodemailer/Gmail SMTP (emails)

---

## 1. Architecture Overview

### User Roles
| Role | Description |
|------|-------------|
| **Student** | Browse courses, purchase via Razorpay, watch videos, track progress, write reviews |
| **Instructor** | Create/edit/delete courses, sections, subsections; view dashboard analytics |
| **Admin** | Create categories (no admin panel exists in frontend) |

### Tech Stack
- **Frontend:** CRA (react-scripts 5), Redux Toolkit, react-router-dom v7, Axios, react-hot-toast, Tailwind CSS
- **Backend:** Express 5, Mongoose 8, JWT auth, bcrypt, Cloudinary, Razorpay, Nodemailer
- **Database:** MongoDB Atlas (Mongoose ODM)
- **File Uploads:** express-fileupload → Cloudinary
- **Payments:** Razorpay (server-side order creation + client-side checkout modal)
- **Caching:** In-memory TTL cache (server/utils/cache.js)
- **Rate Limiting:** express-rate-limit on auth and email routes

---

## 2. Complete Feature Inventory

### 2.1 Authentication & Authorization
| # | Feature | Endpoint/Component | Status |
|---|---------|-------------------|--------|
| A1 | Send OTP for signup | POST `/api/v1/auth/sendotp` | Implemented |
| A2 | User signup with OTP verification | POST `/api/v1/auth/signup` | Implemented |
| A3 | User login (JWT + cookie) | POST `/api/v1/auth/login` | Implemented |
| A4 | Logout (client-side only) | `authAPI.logout()` | Implemented |
| A5 | Change password (authenticated) | POST `/api/v1/auth/changepassword` | Implemented |
| A6 | Forgot password (send reset email) | POST `/api/v1/auth/reset-password-token` | Implemented |
| A7 | Reset password with token | POST `/api/v1/auth/reset-password` | Implemented |
| A8 | JWT middleware (auth) | `middlewares/auth.js` | Implemented |
| A9 | Role guards (isStudent/isInstructor/isAdmin) | `middlewares/auth.js` | Implemented |
| A10 | OpenRoute (redirect logged-in users) | `OpenRoute.jsx` | Implemented |
| A11 | PrivateRoute (redirect unauthenticated) | `PrivateRoute.jsx` | Implemented |
| A12 | Rate limiting (auth + email routes) | `rateLimiters.js` | Implemented |

### 2.2 Profile Management
| # | Feature | Endpoint/Component |
|---|---------|-------------------|
| P1 | Get user details | GET `/api/v1/profile/getUserDetails` |
| P2 | Update profile (name, DOB, gender, etc.) | PUT `/api/v1/profile/updateProfile` |
| P3 | Update display picture | PUT `/api/v1/profile/updateDisplayPicture` |
| P4 | Delete account | DELETE `/api/v1/profile/deleteProfile` |
| P5 | Get enrolled courses | GET `/api/v1/profile/getEnrolledCourses` |
| P6 | Instructor dashboard stats | GET `/api/v1/profile/instructorDashboard` |

### 2.3 Course Management (Instructor)
| # | Feature | Endpoint |
|---|---------|----------|
| C1 | Create course | POST `/api/v1/course/createCourse` |
| C2 | Edit course | POST `/api/v1/course/editCourse` |
| C3 | Delete course (cascade) | DELETE `/api/v1/course/deleteCourse` |
| C4 | Get instructor's courses | GET `/api/v1/course/getInstructorCourses` |
| C5 | Create section | POST `/api/v1/course/addSection` |
| C6 | Update section | POST `/api/v1/course/updateSection` |
| C7 | Delete section (cascade) | POST `/api/v1/course/deleteSection` |
| C8 | Create subsection (video upload) | POST `/api/v1/course/addSubSection` |
| C9 | Update subsection | POST `/api/v1/course/updateSubSection` |
| C10 | Delete subsection | POST `/api/v1/course/deleteSubSection` |
| C11 | Publish/unpublish course (via editCourse status) | POST `/api/v1/course/editCourse` |

### 2.4 Course Browsing (Public/Student)
| # | Feature | Endpoint |
|---|---------|----------|
| B1 | Get all published courses | GET `/api/v1/course/getAllCourses` |
| B2 | Get course details (public) | POST `/api/v1/course/getCourseDetails` |
| B3 | Get full course details (authenticated) | POST `/api/v1/course/getFullCourseDetails` |
| B4 | Get all categories | GET `/api/v1/course/showAllCategories` |
| B5 | Get category page details | POST `/api/v1/course/getCategoryPageDetails` |

### 2.5 Student Features
| # | Feature | Endpoint |
|---|---------|----------|
| S1 | Cart management (add/remove/reset) | Redux cartSlice (client-only) |
| S2 | Capture payment (Razorpay order) | POST `/api/v1/payment/capturePayment` |
| S3 | Verify payment & enroll | POST `/api/v1/payment/verifyPayment` |
| S4 | Send payment success email | POST `/api/v1/payment/sendPaymentSuccessEmail` |
| S5 | Update course progress | POST `/api/v1/course/updateCourseProgress` |
| S6 | Create rating & review | POST `/api/v1/course/createRating` |
| S7 | Get average rating | GET `/api/v1/course/getAverageRating` |
| S8 | Get all reviews | GET `/api/v1/course/getReviews` |

### 2.6 Categories (Admin)
| # | Feature | Endpoint |
|---|---------|----------|
| CAT1 | Create category | POST `/api/v1/course/createCategory` |
| CAT2 | Show all categories | GET `/api/v1/course/showAllCategories` |
| CAT3 | Category page details | POST `/api/v1/course/getCategoryPageDetails` |

### 2.7 Contact
| # | Feature | Endpoint |
|---|---------|----------|
| CO1 | Contact form submission | POST `/api/v1/reach/contact` |

### 2.8 Frontend Pages
| # | Page | Route | Component |
|---|------|-------|-----------|
| FP1 | Home | `/` | Home.jsx |
| FP2 | Login | `/login` | Login.jsx (OpenRoute) |
| FP3 | Signup | `/signup` | Signup.jsx (OpenRoute) |
| FP4 | Verify Email | `/verify-email` | VerifyEmail.jsx (OpenRoute) |
| FP5 | Forgot Password | `/forgot-password` | ForgotPassword.jsx (OpenRoute) |
| FP6 | Update Password | `/update-password/:id` | UpdatePassword.jsx |
| FP7 | About | `/about` | About.jsx |
| FP8 | Contact | `/contact` | Contact.jsx |
| FP9 | Catalog | `/catalog/:categoryName` | Catalog.jsx |
| FP10 | Course Details | `/courses/:courseId` | CourseDetails.jsx |
| FP11 | Dashboard | `/dashboard` | Dashboard.jsx (PrivateRoute) |
| FP12 | My Profile | `/dashboard/my-profile` | MyProfile.jsx |
| FP13 | Settings | `/dashboard/settings` | Settings/index.jsx |
| FP14 | Enrolled Courses | `/dashboard/enrolled-courses` | EnrolledCourses.jsx |
| FP15 | Cart | `/dashboard/cart` | Cart/index.jsx |
| FP16 | My Courses (Instructor) | `/dashboard/my-courses` | MyCourses.jsx |
| FP17 | Add Course (Instructor) | `/dashboard/add-course` | AddCourse/index.jsx |
| FP18 | Edit Course (Instructor) | `/dashboard/edit-course/:courseId` | EditCourse/index.jsx |
| FP19 | Instructor Dashboard | `/dashboard/instructor` | Instructor.jsx |
| FP20 | View Course | view-course routes | ViewCourse.jsx |
| FP21 | Video Player | `/view-course/:courseId/section/:sectionId/sub-section/:subSectionId` | VideoDetails.jsx |
| FP22 | 404 Error | `*` | Error.jsx |

---

## 3. Testing Strategy

### 3.1 Testing Tools
- **Backend Unit/Integration Tests:** Jest + Supertest (compatible with existing jest config in react-scripts)
- **Frontend Component Tests:** Jest + React Testing Library (already bundled with CRA)
- **Database Tests:** mongodb-memory-server (isolated in-memory MongoDB)
- **Mocking:** Jest built-in mocks for Cloudinary, Razorpay, Nodemailer

### 3.2 Test Categories

#### Backend API Tests (Priority: Critical)
- Auth endpoints (signup, login, OTP, password reset)
- Course CRUD endpoints
- Section/SubSection CRUD
- Payment capture and verification
- Profile management
- Category management
- Rating and reviews
- Contact form
- Course progress tracking

#### Backend Unit Tests (Priority: High)
- Middleware (auth, role guards, rate limiters)
- Utility functions (cache, mailSender, imageUploader)
- Model validations

#### Frontend Unit Tests (Priority: High)
- Redux slices (authSlice, cartSlice, courseSlice, profileSlice, viewCourseSlice)
- Utility functions (avgRating, courseDuration, dateFormatter)
- API connector configuration

#### Frontend Component Tests (Priority: Medium)
- Route guards (PrivateRoute, OpenRoute)
- Key forms (LoginForm, SignupForm)
- Cart operations
- Navigation (Navbar)

### 3.3 Test Database
- Use `mongodb-memory-server` for all backend tests
- Each test suite gets a clean database
- No production data touched

### 3.4 Mocking Strategy
- **Cloudinary:** Mock `imageUploadToCloudinary` to return fake URLs
- **Razorpay:** Mock `instance.orders.create` to return fake order IDs
- **Nodemailer:** Mock `mailSender` to avoid sending real emails
- **Crypto:** Use real crypto for HMAC signature verification tests

---

## 4. Bugs to Investigate

### Known Issues Found During Code Review

| # | File | Issue | Severity |
|---|------|-------|----------|
| BUG-1 | `server/models/CourseProgress.js` | `ref: "user"` (lowercase) instead of `ref: "User"` — populate will fail silently | Medium |
| BUG-2 | `server/models/User.js` | Field named `coursesProgress` but `Payments.js enrollStudents` pushes to `courseProgress` (no 's') — data written to wrong field | Critical |
| BUG-3 | `server/controllers/Course.js` → `editCourse` | No ownership check — any instructor can edit any course | Critical |
| BUG-4 | `server/controllers/Section.js` | Section model has no `course` field, but `Subsection.js getPopulatedCourse` reads `section.course` — returns null | High |
| BUG-5 | `server/config/razorpay.js` | Razorpay instance created at module load — if env vars missing, server crashes on startup | Medium |
| BUG-6 | `src/services/operations/studentFeatureAPI.js` | `orderResponse.data.message.id` — Razorpay order is in `data.message` which is confusing; works but fragile | Low |
| BUG-7 | `server/controllers/Profile.js` | `updateProfile` requires `contactNumber` and `gender` — but these should be optional on first profile edit | Medium |

---

## 5. Test Execution Plan

### Phase 1: Setup & Infrastructure
1. Install test dependencies (jest, supertest, mongodb-memory-server)
2. Create test database configuration
3. Create test helpers (auth tokens, mock data factories)
4. Create jest configuration for backend

### Phase 2: Backend API Tests
1. Auth controller tests
2. Course controller tests
3. Section/SubSection controller tests
4. Payment controller tests
5. Profile controller tests
6. Category controller tests
7. Rating & Review controller tests
8. Course Progress controller tests
9. Contact controller tests

### Phase 3: Backend Unit Tests
1. Middleware tests (auth, role guards)
2. Utility tests (cache, mailSender)
3. Model validation tests

### Phase 4: Frontend Tests
1. Redux slice tests
2. Utility function tests
3. Component tests
4. Route guard tests

### Phase 5: Bug Fixes & Regression
1. Fix all discovered bugs
2. Add regression tests
3. Re-run full suite

### Phase 6: Final Verification
1. Run complete test suite
2. Run production build
3. Generate TEST_REPORT.md
