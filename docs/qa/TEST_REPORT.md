# StudyNotion — Detailed QA Test Report

> **Latest Cycle:** Cycle #6 — `GAP-004` Global Course Search, Filtering, Sorting & Server-Side Pagination  
> **Date:** 2026-11-18  
> **Environment:** Windows 11 | Node.js v22.16.0 | React 18 (CRA 5) | Express 5 | Mongoose 8 | MongoDB 8.0 (Isolated Local Ephemeral on `127.0.0.1:27018`) | Chromium 1208 (Playwright)

---

## Cycle #6 — Execution Summary (2026-11-18)

| Test Suite / Verification Gate | Command | Suites | Tests | Passed | Failed | Blocked | Result |
|-------------------------------|---------|--------|-------|--------|--------|---------|--------|
| **Frontend Unit & Component Tests** | `npm test` | 20 | 73 | 73 | 0 | 0 | **PASS** (7.54s, +3 suites / +6 tests) |
| **Backend Unit, API & Safety Guardrails** | `npm run test:server` | 12 | 114 | 114 | 0 | 0 | **PASS** (+6 tests in `course.test.js`) |
| **Backend Real-MongoDB Full-Stack Integration** | `npm run test:server:integration` (inside `npm run test:server`) | 1 | 8 | 8 | 0 | 0 | **PASS** (7.19s, +1 comprehensive `GAP-004` real-DB suite) |
| **Isolated Authenticated & Feature Playwright E2E (`E2E-16`–`26` + `REG-01`–`03`)** | `npm run test:e2e:isolated` | 1 | 14 | 14 | 0 | 0 | **PASS** (+3 new `E2E-24`–`E2E-26`, 0 page errors, 0 Swiper warnings) |
| **Public Catalog & Console/Network Regression (`PUB-01`–`PUB-04`)** | `node scratch/public_regression.js` | 1 | 4 | 4 | 0 | 0 | **PASS** (0 console errors, 0 page errors, 0 failed network requests) |
| **Strict Frontend ESLint** | `npx eslint src --max-warnings=0` | — | — | 0 errors, 0 warnings | — | — | **PASS** (Exit 0) |
| **Frontend Production Build** | `npm run build` | — | — | Exit 0 (0 ESLint warnings) | — | — | **PASS** |

### Cycle #6 Actual Verification Outputs

#### A. Combined Automated Test Run (`npm run test:all`)
```text
Frontend (npm test):
Test Suites: 20 passed, 20 total
Tests:       73 passed, 73 total (added courseDetailsAPI.search.test.js [2], NavbarSearch.test.jsx [2], Courses.test.jsx [2])
Time:        7.54 s

Backend (npm run test:server):
Test Suites: 13 passed, 13 total
Tests:       122 passed, 122 total (added course.test.js [+6], integration.realdb.test.js [+1])
Time:        32.087 s
```

#### B. Isolated Playwright E2E Run (`e2e/authenticated.e2e.js`) & Public Regression Audit
```text
[PASS] E2E-16 Live Signup -> OTP -> Login -> Profile Edit -> Refresh
[PASS] E2E-17 Live Cart -> Razorpay Checkout (Sandbox Mock) -> Enrollment
[PASS] E2E-18 Live ViewCourse Video Playback + Mark Complete + Add Review
[PASS] E2E-19 Live Instructor Create Course (3 steps) + Upload Thumbnail & Video + Publish
[PASS] E2E-20 Live Edit Course + Delete Course + Instructor Dashboard Chart
[PASS] E2E-21 Live Update Password + Delete Account Confirmation Modal
[PASS] E2E-22 GAP-005 Free Course Direct Enrollment & Content Access (Zero Razorpay)
[PASS] E2E-23 GAP-005 Instructor Create & Publish ₹0 Free Course via CoursesTable
[PASS] E2E-24 GAP-004 Navbar Search (Debounce Preview, Clear, Navigation & Draft Exclusion): draftCreated=true, preview=200, navDetails=true, draftExcluded=true, cleared=true
[PASS] E2E-25 GAP-004 Filtering, Combined Filters, All 5 Sorts, URL Sync & API Error Retry: freeAndPaid=true, free=true, paid=true, combined=true, urlSync=true, sorts=true/true/true/true, errorRetry=true
[PASS] E2E-26 GAP-004 Server-Side Pagination, Out-of-Range Recovery & Mobile (375px) Search: paginationPreserved=true, prevWorked=true, oobRecovered=true, mobileOverflow=false
[PASS] REG-01..REG-03 Footer, Error Page & Mobile 375px Regressions

PAGE ERRORS: 0 [] | SWIPER WARNINGS: 0 | TOTAL: 14 PASSED: 14 FAILED: 0

Public Catalog & Console/Network Regression:
[PASS] PUB-01 Homepage | [PASS] PUB-02 Catalog -> Category Search Integration | [PASS] PUB-03 All Catalog Categories | [PASS] PUB-04 Public Pages & /search Alias
CONSOLE_ERRORS: 0 [] | PAGE_ERRORS: 0 [] | FAILED_REQUESTS: 0 []
```

#### C. Strict ESLint & Production Build
```text
$ npx eslint src --max-warnings=0 -> Exit 0 (0 errors, 0 warnings)
$ npm run build -> Exit 0 (0 [eslint] warnings; only 2 pre-existing third-party swiper PostCSS CSS-nesting notices)
```

---

## Cycle #5 — Execution Summary (2026-11-18)

| Test Suite / Verification Gate | Command | Suites | Tests | Passed | Failed | Blocked | Result |
|-------------------------------|---------|--------|-------|--------|--------|---------|--------|
| **Frontend Unit & Component Tests** | `npm test` | 17 | 67 | 67 | 0 | 0 | **PASS** (6.46s, +2 suites / +6 tests) |
| **Backend Unit, API & Safety Guardrails** | `npm run test:server` | 12 | 108 | 108 | 0 | 0 | **PASS** (+10 tests in `payment.test.js` & `course.test.js`) |
| **Backend Real-MongoDB Full-Stack Integration** | `npm run test:server:integration` | 1 | 7 | 7 | 0 | 0 | **PASS** (13.59s, +1 comprehensive `GAP-005` real-DB test) |
| **Isolated Authenticated Playwright E2E (`E2E-16`–`23` + `REG-01`–`03`)** | `node e2e/authenticated.e2e.js` | 1 | 11 | 11 | 0 | 0 | **PASS** (+2 new `E2E-22` & `E2E-23`, 0 page errors, 0 Swiper warnings) |
| **Strict Frontend ESLint** | `npx eslint src --max-warnings=0` | — | — | 0 errors, 0 warnings | — | — | **PASS** (Exit 0) |
| **Frontend Production Build** | `npm run build` | — | — | Exit 0 (0 ESLint warnings) | — | — | **PASS** |

### Cycle #5 Actual Verification Outputs

#### A. Combined Automated Test Run (`npm run test:all`)
```text
Frontend (npm test):
Test Suites: 17 passed, 17 total
Tests:       67 passed, 67 total (added CourseDetailsCard.test.jsx [4], studentFeatureAPI.freeEnroll.test.js [2])
Time:        6.463 s

Backend (npm run test:server):
Test Suites: 13 passed, 13 total
Tests:       115 passed, 115 total (added payment.test.js [+8], course.test.js [+2], integration.realdb.test.js [+1])
Time:        31.485 s
```

#### B. Isolated Playwright E2E Run (`e2e/authenticated.e2e.js`)
```text
[PASS] E2E-16 Live Signup -> OTP -> Login -> Profile Edit -> Refresh
[PASS] E2E-17 Live Cart -> Razorpay Checkout (Sandbox Mock) -> Enrollment
[PASS] E2E-18 Live ViewCourse Video Playback + Mark Complete + Add Review
[PASS] E2E-19 Live Instructor Create Course (3 steps) + Upload Thumbnail & Video + Publish
[PASS] E2E-20 Live Edit Course + Delete Course + Instructor Dashboard Chart
[PASS] E2E-21 Live Update Password + Delete Account Confirmation Modal
[PASS] E2E-22 GAP-005 Free Course Direct Enrollment & Content Access (Zero Razorpay): enrollStatus=200, razorpayHits=0, catalogFree=true, noCartBtn=true, canAccessLesson=true, showsGoToCourse=true
[PASS] E2E-23 GAP-005 Instructor Create & Publish ₹0 Free Course via CoursesTable: create=200, displaysFree=true, publishToggle=200, publishedNow=true
[PASS] REG-01..REG-03 Footer, Error Page & Mobile 375px Regressions

PAGE ERRORS: 0 [] | SWIPER WARNINGS: 0 | TOTAL: 11 PASSED: 11 FAILED: 0
```

#### C. Strict ESLint & Production Build
```text
$ npx eslint src --max-warnings=0 -> Exit 0 (0 errors, 0 warnings)
$ npm run build -> Exit 0 (0 [eslint] warnings; only 2 pre-existing third-party swiper PostCSS CSS-nesting notices)
```

---

## Cycle #4 — Execution Summary (2026-11-18)

| Test Suite / Verification Gate | Command | Suites | Tests | Passed | Failed | Blocked | Result |
|-------------------------------|---------|--------|-------|--------|--------|---------|--------|
| **Frontend Unit & Component Tests** | `npm test` | 15 | 61 | 61 | 0 | 0 | **PASS** (6.40s) |
| **Backend Unit, API & Safety Guardrails** | `npm run test:server` | 12 | 98 | 98 | 0 | 0 | **PASS** (+10 safety tests) |
| **Backend Real-MongoDB Full-Stack Integration** | `npm run test:server:integration` (also inside `npm run test:server`) | 1 | 6 | 6 | 0 | 0 | **PASS** (6.16s, real MongoDB 8.0) |
| **Isolated Authenticated Playwright E2E (`E2E-16`–`21` + `REG-01`–`03`)** | `node e2e/authenticated.e2e.js` | 1 | 9 | 9 | 0 | 0 | **PASS** (0 page errors, 0 Swiper warnings) |
| **Strict Frontend ESLint** | `npx eslint src --max-warnings=0` | — | — | 0 errors, 0 warnings | — | — | **PASS** (Exit 0) |
| **Frontend Production Build** | `npm run build` | — | — | Exit 0 (0 ESLint warnings) | — | — | **PASS** |

### Cycle #4 Actual Verification Outputs

#### A. Combined Automated Test Run (`npm run test:all`)
```text
Frontend (npm test):
Test Suites: 15 passed, 15 total
Tests:       61 passed, 61 total
Time:        6.401 s

Backend (npm run test:server):
PASS __tests__/integration.realdb.test.js (6.16 s)
  DB connected successfully [ISOLATED TEST MODE: studynotion_integration_test @ mongodb://127.0.0.1:27018/studynotion_integration_test]
PASS __tests__/testSafety.test.js (10/10 safety guardrail tests)
PASS __tests__/auth.test.js ... __tests__/cache.test.js (11 existing suites)

Test Suites: 13 passed, 13 total
Tests:       104 passed, 104 total
Time:        20.262 s
```

#### B. Isolated Authenticated Playwright E2E Run (`e2e/authenticated.e2e.js`)
```text
[PASS] E2E-16 Live Signup -> OTP -> Login -> Profile Edit -> Refresh: otpLen=6, loginStatus=200, persistedAfterRefresh=true
[PASS] E2E-17 Live Cart -> Razorpay Checkout (Sandbox Mock) -> Enrollment: verifyStatus=200, rzpOpts={"currency":"INR","amount":"99900","order_id":"order_test_1795005931150_4"}, enrolledVisible=true, cartCountAfter=null
[PASS] E2E-18 Live ViewCourse Video Playback + Mark Complete + Add Review: videoPresent=true, progStatus=200, progressUpdated=true, movedToLesson2=true, ratingStatus=200, modalClosed=true
[PASS] E2E-19 Live Instructor Create Course (3 steps) + Upload Thumbnail & Video + Publish: create=200, subSection=200, publish=200, visibleInMyCourses=true
[PASS] E2E-20 Live Edit Course + Delete Course + Instructor Dashboard Chart: edit=200, delete=200, removed=true, chartCanvas=true, statsVisible=true
[PASS] E2E-21 Live Update Password + Delete Account Confirmation Modal: pwUpdate=200, newLogin=200, cancelWorked=true, deleteStatus=200, tokenCleared=true, postDeleteLogin=401
[PASS] REG-01 Footer Internal Links Regression (Isolated Env): checked=8, broken=[]
[PASS] REG-02 Error Page Direct Landing Regression: bodyOverflow=hidden auto, ctaNavigatedHome=true
[PASS] REG-03 Mobile 375px Layout Regression: horizontalOverflow=false

=== ISOLATED AUTHENTICATED E2E SUMMARY ===
PAGE ERRORS: 0 []
SWIPER WARNINGS: 0
TOTAL: 9 PASSED: 9 FAILED: 0
```

#### C. Strict ESLint & Production Build Verification
```text
$ npx eslint src --max-warnings=0
Command exited with code 0. (0 errors, 0 warnings)

$ npm run build
Command exited with code 0.
- 0 [eslint] warnings across entire codebase.
- 2 pre-existing PostCSS/Tailwind CSS-nesting notices from third-party node_modules/swiper CSS files.
```

#### D. Bonus Defect Uncovered & Fixed Live During Cycle #4 (`BUG-029`)
- Executing `E2E-20` against the real isolated stack revealed that `CourseInformationForm.jsx` silently blocked saving course edits because `courseCategory` was registered `{ required: true }` on a `<select disabled={editCourse || loading}>` whose async options loaded after initial `setValue`, and `<Upload>` received `thumbnail` instead of `editData`. Fixed and verified live in `E2E-20`, ESLint, and production build.

---

## Cycle #3 — Historical Execution Summary (2026-11-18)

| Test Suite / Verification Gate | Command | Suites | Tests | Passed | Failed | Blocked | Result |
|-------------------------------|---------|--------|-------|--------|--------|---------|--------|
| **Frontend Unit & Component Tests** | `npm test` | 15 | 61 | 61 | 0 | 0 | **PASS** (+5 suites, +16 tests) |
| **Backend Unit & API Integration Tests** | `npm run test:server` | 11 | 88 | 88 | 0 | 0 | **PASS** (+2 tests) |
| **Live Browser E2E (Cycle #3 Playwright)** | `node scratch/qa_cycle3_e2e.js` | 1 | 7 | 7 | 0 | 0 | **PASS** (0 page errors, 0 Swiper warnings) |
| **Authenticated Live E2E** | — | — | 6 | 0 | 0 | 6 | Deferred to Cycle #4 (`GAP-009` — now **UNBLOCKED & PASSING**) |
| **Strict ESLint & Production Build** | `npx eslint src --max-warnings=0`, `npm run build` | — | — | Exit 0 | — | — | **PASS** |

---

## Cycle #2 — Historical Execution Summary (2026-11-18)

| Test Suite | Command | Suites | Tests | Passed | Failed | Blocked | Duration |
|------------|---------|--------|-------|--------|--------|---------|----------|
| **Frontend Unit & Component Tests** | `npm test` | 10 | 45 | 45 | 0 | 0 | 7.39s |
| **Backend Unit & API Integration Tests** | `npm run test:server` | 11 | 86 | 86 | 0 | 0 | 22.45s |
| **Live Browser E2E (Playwright)** | `node scratch/qa_audit.js` | 1 | 18 | 18 | 0 | 0 | ~24s |
| **Authenticated Live E2E** | — | — | 6 | 0 | 0 | 6 | Blocked (resolved in Cycle #4) |

---

## Local Execution Commands (Isolated Test Environment)

```powershell
# 1. Run full automated suite (Frontend Jest + Backend Unit + Safety Guardrails + Real Isolated MongoDB Integration)
npm run test:all

# 2. Run only the real isolated MongoDB integration suite
npm run test:server:integration

# 3. Optional: start isolated MongoDB via Docker Compose instead of local ephemeral mongod
docker compose -f docker-compose.test.yml up -d

# 4. Run full isolated E2E stack (Terminal 1: isolated backend on 4001 + isolated MongoDB on 27018)
npm run start:test-backend

# 5. Terminal 2: isolated frontend on 3001 pointing ONLY to isolated backend 4001
$env:PORT='3001'; $env:BROWSER='none'; $env:REACT_APP_BASE_URL='http://localhost:4001/api/v1'; $env:REACT_APP_RAZORPAY_KEY='rzp_test_isolated_mock_key'; npm start

# 6. Terminal 3: run all 6 authenticated E2E tests (E2E-16..E2E-21) + regressions
npm run test:e2e:isolated

# 7. Strict ESLint + Production Build
npx eslint src --max-warnings=0
npm run build
```
