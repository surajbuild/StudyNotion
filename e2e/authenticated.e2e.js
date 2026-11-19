/**
 * StudyNotion — Isolated Authenticated & Regression Playwright E2E Suite (GAP-009)
 *
 * Executes all 6 previously blocked authenticated E2E journeys (E2E-16 through E2E-21)
 * plus Cycle #2/#3 regression checks against the completely isolated test environment:
 *   - Isolated MongoDB (127.0.0.1:27018/studynotion_test)
 *   - Isolated Express API (http://localhost:4001, TEST_MOCK_EXTERNAL_SERVICES=true)
 *   - Isolated React Dev Server (http://localhost:3001, REACT_APP_BASE_URL=http://localhost:4001/api/v1)
 *
 * Zero real production accounts, payments, emails, or Cloudinary uploads are used.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function loadPlaywright() {
    const candidates = [
        process.env.PLAYWRIGHT_CORE_PATH,
        "playwright-core",
        "playwright",
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            return require(candidate);
        } catch {
            // Try next candidate
        }
    }
    throw new Error(
        "playwright-core not found. Install playwright-core or set PLAYWRIGHT_CORE_PATH."
    );
}

function findChromeExecutable() {
    const candidates = [
        process.env.PLAYWRIGHT_CHROME_PATH,
        path.join(
            process.env.LOCALAPPDATA || "",
            "ms-playwright",
            "chromium-1208",
            "chrome-win64",
            "chrome.exe"
        ),
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter(Boolean);
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return undefined;
}

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || "http://localhost:3001";
const API_BASE_URL = process.env.E2E_API_URL || "http://localhost:4001/api/v1";
const TEST_PASSWORD = process.env.TEST_FIXTURE_PASSWORD || "TestPass@1234";
const TEST_RAZORPAY_SECRET =
    process.env.RAZORPAY_SECRET || "studynotion-isolated-test-razorpay-secret";
const TEST_RAZORPAY_WEBHOOK_SECRET =
    process.env.RAZORPAY_WEBHOOK_SECRET || "studynotion-isolated-test-webhook-secret";

function signWebhookBody(payload, secret = TEST_RAZORPAY_WEBHOOK_SECRET) {
    const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return { rawBody, signature };
}

async function createTestStudent(email, password = TEST_PASSWORD, firstName = "Test", lastName = "Student") {
    await fetchJson(`${API_BASE_URL}/auth/sendotp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    const otpRes = await fetchJson(
        `${API_BASE_URL}/__test__/otp?email=${encodeURIComponent(email)}`
    );
    const otp = otpRes.data?.otp || "";
    const signupRes = await fetchJson(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            confirmPassword: password,
            accountType: "Student",
            otp,
        }),
    });
    return signupRes;
}

const FIXTURES = {
    studentEmail: "qa.student@isolated.test",
    instructorEmail: "qa.instructor@isolated.test",
    adminEmail: "qa.admin@isolated.test",
    disposableEmail: "qa.disposable@isolated.test",
};

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, data };
}

async function waitForUrl(url, label, maxRetries = 40) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return true;
        } catch {
            // Wait for server startup
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`${label} did not become ready at ${url}`);
}

async function waitForHash(page, fragment, timeout = 15000) {
    await page.waitForFunction(
        (frag) => window.location.hash.includes(frag),
        fragment,
        { timeout }
    );
}

async function uiLogin(page, email, password) {
    await page.goto(`${FRONTEND_URL}/#/login`, { waitUntil: "networkidle", timeout: 25000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/auth/login"), { timeout: 15000 }),
        page.getByRole("button", { name: /Sign In/i }).click(),
    ]);
    await page.waitForTimeout(800);
    return resp.status();
}

async function uiLogout(page) {
    await page.evaluate(async (apiBase) => {
        try {
            await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
        } catch {}
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }, API_BASE_URL);
    await page.goto(`${FRONTEND_URL}/#/login`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
}

async function runAuthenticatedE2E() {
    await waitForUrl(`${API_BASE_URL.replace(/\/api\/v1$/, "")}/`, "Isolated Backend API");
    await waitForUrl(`${FRONTEND_URL}/`, "Isolated Frontend App");

    // Ensure clean seeded DB state before starting E2E run
    const reseedRes = await fetchJson(`${API_BASE_URL}/__test__/reseed`, { method: "POST" });
    if (reseedRes.status !== 200 || !reseedRes.data.success) {
        throw new Error(`Failed to reseed isolated test DB: ${JSON.stringify(reseedRes)}`);
    }
    const seeded = reseedRes.data.data;

    // Prepare tiny valid PNG + MP4 files for upload tests
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "studynotion-e2e-files-"));
    const samplePngPath = path.join(tempDir, "thumb.png");
    // Minimal 1x1 PNG
    fs.writeFileSync(
        samplePngPath,
        Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII=",
            "base64"
        )
    );
    const repoSampleVideo = path.join(__dirname, "..", "src", "assets", "Images", "banner.mp4");
    const sampleVideoPath = fs.existsSync(repoSampleVideo)
        ? repoSampleVideo
        : path.join(tempDir, "lecture.mp4");
    if (!fs.existsSync(sampleVideoPath)) {
        fs.writeFileSync(sampleVideoPath, Buffer.from("00000018667479706d703432", "hex"));
    }

    const { chromium } = loadPlaywright();
    const executablePath = findChromeExecutable();
    const browser = await chromium.launch({
        ...(executablePath ? { executablePath } : {}),
        headless: true,
    });

    const pageErrors = [];
    const swiperWarnings = [];
    const results = [];

    const record = (id, name, passed, details) => {
        const status = passed ? "PASS" : "FAIL";
        results.push({ id, name, status, details });
        console.log(`[${status}] ${id} ${name}: ${details}`);
    };

    const newTrackedContext = async () => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
        const page = await ctx.newPage();
        page.on("pageerror", (err) => pageErrors.push(err.message));
        page.on("console", (msg) => {
            if (msg.type() === "warning" && msg.text().includes("Swiper")) {
                swiperWarnings.push(msg.text());
            }
        });
        return { ctx, page };
    };

    try {
        // =========================================================================
        // E2E-16: Live Signup -> OTP -> Login -> Profile Edit -> Refresh
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const signupEmail = "e2e16.student@isolated.test";
                await page.goto(`${FRONTEND_URL}/#/signup`, { waitUntil: "networkidle" });
                await page.fill('input[name="firstName"]', "E2E");
                await page.fill('input[name="lastName"]', "Learner");
                await page.fill('input[name="email"]', signupEmail);
                await page.fill('input[name="password"]', TEST_PASSWORD);
                await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);

                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/sendotp"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Create Account/i }).click(),
                ]);
                await waitForHash(page, "/verify-email");

                // Fetch real OTP persisted in isolated test MongoDB
                const otpRes = await fetchJson(
                    `${API_BASE_URL}/__test__/otp?email=${encodeURIComponent(signupEmail)}`
                );
                const otp = otpRes.data?.otp || "";

                const otpInputs = page.locator('form input[placeholder="-"]');
                await otpInputs.first().click();
                await page.keyboard.type(otp, { delay: 40 });

                const [signupResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/signup"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Verify Email/i }).click(),
                ]);
                if (signupResp.status() !== 200) {
                    const errBody = await signupResp.text();
                    throw new Error(`E2E-16 signup failed (${signupResp.status()}): ${errBody}`);
                }
                await waitForHash(page, "/login");

                // Login with newly signed-up account
                const loginStatus = await uiLogin(page, signupEmail, TEST_PASSWORD);
                await waitForHash(page, "/dashboard/my-profile");

                // Navigate to Settings & edit profile
                await page.goto(`${FRONTEND_URL}/#/dashboard/settings`, { waitUntil: "networkidle" });
                await page.fill('input[name="dateOfBirth"]', "1997-04-12");
                await page.selectOption('select[name="gender"]', "Female");
                await page.fill('input[name="contactNumber"]', "9876543210");
                await page.fill('textarea[name="about"]', "Verified isolated E2E-16 student bio");

                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/profile/updateProfile"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /Save Changes/i }).click(),
                ]);
                await waitForHash(page, "/dashboard/my-profile");

                // Hard refresh and verify persistence from localStorage + backend
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForTimeout(800);
                const profileText = await page.locator("body").innerText();
                const persisted =
                    profileText.includes("Verified isolated E2E-16 student bio") &&
                    profileText.includes("Female") &&
                    profileText.includes("9876543210");

                record(
                    "E2E-16",
                    "Live Signup -> OTP -> Login -> Profile Edit -> Refresh",
                    loginStatus === 200 && otp.length === 6 && persisted,
                    `otpLen=${otp.length}, loginStatus=${loginStatus}, persistedAfterRefresh=${persisted}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-17: Live Cart -> Mocked Razorpay Checkout -> HMAC Verify -> Enrollment
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                // Expose Node HMAC signer so mocked window.Razorpay computes real signature
                await page.exposeFunction("__computeTestRzpSignature", (orderId, paymentId) => {
                    return crypto
                        .createHmac("sha256", TEST_RAZORPAY_SECRET)
                        .update(`${orderId}|${paymentId}`)
                        .digest("hex");
                });

                // Intercept Razorpay external checkout script with deterministic sandbox mock
                await page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) => {
                    await route.fulfill({
                        status: 200,
                        contentType: "application/javascript",
                        body: `
                            window.__rzpLastOptions = null;
                            window.Razorpay = function(options) {
                                window.__rzpLastOptions = {
                                    currency: options.currency,
                                    amount: options.amount,
                                    order_id: options.order_id,
                                };
                                this._handlers = {};
                                this.on = function(evt, cb) { this._handlers[evt] = cb; };
                                this.open = async function() {
                                    const paymentId = "pay_e2e_sandbox_" + Date.now();
                                    const signature = await window.__computeTestRzpSignature(options.order_id, paymentId);
                                    options.handler({
                                        razorpay_order_id: options.order_id,
                                        razorpay_payment_id: paymentId,
                                        razorpay_signature: signature,
                                    });
                                };
                            };
                        `,
                    });
                });

                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/courses/${seeded.courses.purchasableCourseId}`, {
                    waitUntil: "networkidle",
                });
                const addToCartBtn = page.locator('button:has-text("Add to Cart"):visible').first();
                await addToCartBtn.waitFor({ state: "visible", timeout: 15000 });
                await addToCartBtn.click();
                await page.waitForTimeout(500);

                // Navigate to Cart & trigger checkout
                await page.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "networkidle" });
                await page.waitForSelector("text=Isolated DevOps Bootcamp", { timeout: 15000 });

                const [verifyResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/payment/verifyPayment"), {
                        timeout: 20000,
                    }),
                    page.getByRole("button", { name: /Buy Now/i }).click(),
                ]);

                await waitForHash(page, "/dashboard/enrolled-courses");
                await page.waitForSelector("text=Isolated DevOps Bootcamp", { timeout: 15000 });
                const rzpOpts = await page.evaluate(() => window.__rzpLastOptions);
                const enrolledBody = await page.locator("body").innerText();
                const cartCountAfter = await page.evaluate(() => localStorage.getItem("totalItems"));

                const passed =
                    verifyResp.status() === 200 &&
                    rzpOpts?.currency === "INR" &&
                    rzpOpts?.amount === "99900" &&
                    enrolledBody.includes("Isolated DevOps Bootcamp") &&
                    (cartCountAfter === "0" || cartCountAfter === null);

                record(
                    "E2E-17",
                    "Live Cart -> Razorpay Checkout (Sandbox Mock) -> Enrollment",
                    passed,
                    `verifyStatus=${verifyResp.status()}, rzpOpts=${JSON.stringify(rzpOpts)}, enrolledVisible=${enrolledBody.includes("Isolated DevOps Bootcamp")}, cartCountAfter=${cartCountAfter}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-18: Live ViewCourse Video Playback + Mark Complete + Next + Add Review
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                const viewUrl = `${FRONTEND_URL}/#/view-course/${seeded.courses.enrolledCourseId}/section/${seeded.courses.enrolledFirstSectionId}/sub-section/${seeded.courses.enrolledFirstSubSectionId}`;
                await page.goto(viewUrl, { waitUntil: "networkidle", timeout: 25000 });
                await page.waitForSelector("text=Lesson 1: Architecture Overview", { timeout: 15000 });

                // Verify <video> element has valid local sample MP4 source & simulate playback reaching end
                await page.waitForSelector("video", { timeout: 15000 });
                const videoState = await page.evaluate(() => {
                    const v = document.querySelector("video");
                    if (!v) return { present: false, src: "" };
                    const src = v.currentSrc || v.src || "";
                    v.dispatchEvent(new Event("ended"));
                    return { present: true, src };
                });

                // Mark lecture complete (appears in video-ended overlay)
                const markBtn = page.getByRole("button", { name: /Mark As Completed/i });
                await markBtn.waitFor({ state: "visible", timeout: 10000 });
                const [progResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/updateCourseProgress"), {
                        timeout: 15000,
                    }),
                    markBtn.click(),
                ]);
                await page.waitForTimeout(800);
                const sidebarAfterComplete = await page.locator("body").innerText();
                const progressUpdated = sidebarAfterComplete.includes("1\u00a0/\u00a02") || sidebarAfterComplete.includes("1 / 2");

                // Click Next -> navigate to Lesson 2
                await page.getByRole("button", { name: /Next/i }).click();
                await page.waitForSelector("text=Lesson 2: Building Resilient APIs", { timeout: 10000 });
                const movedToLesson2 = page.url().includes(seeded.courses.enrolledSecondSubSectionId);

                // Open Add Review modal, select 5 stars, write review, submit
                await page.getByRole("button", { name: /Add Review/i }).click();
                await page.waitForSelector("#courseExperience", { timeout: 10000 });
                // Click the 5th star rendered by react-stars
                const stars = page.locator('span[data-index="4"]');
                if ((await stars.count()) > 0) {
                    await stars.first().click();
                } else {
                    // Fallback: 5th star span inside review modal
                    await page.locator('.react-stars span').nth(4).click();
                }
                await page.fill("#courseExperience", "Great isolated course playback and curriculum!");
                const [ratingResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/createRating"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /Submit Review/i }).click(),
                ]);
                await page.waitForTimeout(600);
                const modalClosed = (await page.locator("#courseExperience").count()) === 0;

                const passed =
                    videoState.present &&
                    videoState.src.includes("sample-video.mp4") &&
                    progResp.status() === 200 &&
                    progressUpdated &&
                    movedToLesson2 &&
                    ratingResp.status() === 200 &&
                    modalClosed;

                record(
                    "E2E-18",
                    "Live ViewCourse Video Playback + Mark Complete + Add Review",
                    passed,
                    `videoPresent=${videoState.present}, progStatus=${progResp.status()}, progressUpdated=${progressUpdated}, movedToLesson2=${movedToLesson2}, ratingStatus=${ratingResp.status()}, modalClosed=${modalClosed}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-19 & E2E-20: Live Instructor Create Course (3 steps + uploads + publish)
        //                  + Edit Course + Delete Course + Instructor Dashboard Chart
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await uiLogin(page, FIXTURES.instructorEmail, TEST_PASSWORD);

                // --- E2E-19: Create Course (Step 1 -> Step 2 -> Step 3 Publish) ---
                await page.goto(`${FRONTEND_URL}/#/dashboard/add-course`, { waitUntil: "networkidle" });
                await page.waitForSelector('input[name="courseTitle"]', { timeout: 15000 });

                const initialCourseTitle = "E2E Playwright Created Course";
                await page.fill('input[name="courseTitle"]', initialCourseTitle);
                await page.fill(
                    'textarea[name="courseShortDesc"]',
                    "Created end-to-end against isolated local MongoDB test environment."
                );
                await page.fill('input[name="coursePrice"]', "1199");
                await page.selectOption('select[name="courseCategory"]', seeded.categories.webDevId);

                // Tags (ChipInput)
                await page.fill("#courseTags", "Playwright");
                await page.press("#courseTags", "Enter");

                // Thumbnail upload (mocked Cloudinary on test backend)
                await page.locator('input[type="file"][accept="image/*"]').setInputFiles(samplePngPath);

                // Benefits
                await page.fill(
                    'textarea[name="courseBenefits"]',
                    "Master automated testing against isolated databases."
                );

                // Requirements
                await page.fill("#courseRequirements", "Node.js 18+");
                await page.getByRole("button", { name: /^Add$/i }).click();

                const [createResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/createCourse"), {
                        timeout: 20000,
                    }),
                    page.getByRole("button", { name: /^Next$/i }).click(),
                ]);

                // Step 2: Course Builder (Add Section + Add SubSection with Video)
                await page.waitForSelector("#sectionName", { timeout: 15000 });
                await page.fill("#sectionName", "E2E Module 1");
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/addSection"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Create Section/i }).click(),
                ]);
                await page.waitForSelector("text=Add Lecture", { timeout: 10000 });
                await page.getByRole("button", { name: /Add Lecture/i }).click();

                await page.waitForSelector("#lectureTitle", { timeout: 10000 });
                await page.locator('input[type="file"][accept="video/*"]').setInputFiles(sampleVideoPath);
                await page.fill("#lectureTitle", "E2E Lesson 1");
                await page.fill("#lectureDesc", "Mocked video upload verification");
                await page.fill("#lectureDuration", "180");

                const [subResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/addSubSection"), {
                        timeout: 20000,
                    }),
                    page.getByRole("button", { name: /^Save$/i }).click(),
                ]);
                await page.waitForTimeout(700);

                // Advance to Step 3: Publish Course
                await page.getByRole("button", { name: /^Next$/i }).click();
                await page.waitForSelector("#public", { timeout: 10000 });
                await page.check("#public");
                const [publishResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/editCourse"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Save Changes/i }).click(),
                ]);

                await waitForHash(page, "/dashboard/my-courses");
                await page.waitForSelector(`text=${initialCourseTitle}`, { timeout: 15000 });
                const myCoursesBody = await page.locator("body").innerText();
                const e2e19Passed =
                    createResp.status() === 200 &&
                    subResp.status() === 200 &&
                    publishResp.status() === 200 &&
                    myCoursesBody.includes(initialCourseTitle) &&
                    myCoursesBody.includes("Published");

                record(
                    "E2E-19",
                    "Live Instructor Create Course (3 steps) + Upload Thumbnail & Video + Publish",
                    e2e19Passed,
                    `create=${createResp.status()}, subSection=${subResp.status()}, publish=${publishResp.status()}, visibleInMyCourses=${myCoursesBody.includes(initialCourseTitle)}`
                );

                // --- E2E-20: Edit Course + Delete Course + Instructor Dashboard Chart ---
                const updatedTitle = "E2E Playwright Edited Course";
                const courseRow = page.locator("tr", { hasText: initialCourseTitle }).first();
                await courseRow.locator('button[title="Edit"]').click();
                await waitForHash(page, "/dashboard/edit-course/");
                await page.waitForSelector('input[name="courseTitle"]', { timeout: 15000 });
                await page.fill('input[name="courseTitle"]', updatedTitle);

                const [editResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/editCourse"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Save Changes/i }).click(),
                ]);
                await page.waitForTimeout(600);

                // Return to My Courses, verify updated title, then delete with ConfirmationModal
                await page.goto(`${FRONTEND_URL}/#/dashboard/my-courses`, { waitUntil: "networkidle" });
                await page.waitForSelector(`text=${updatedTitle}`, { timeout: 15000 });

                const editedRow = page.locator("tr", { hasText: updatedTitle }).first();
                await editedRow.locator('button[title="Delete"]').click();
                await page.waitForSelector("text=Do you want to delete this course?", { timeout: 10000 });
                const [delResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/deleteCourse"), {
                        timeout: 15000,
                    }),
                    page.getByText("Delete", { exact: true }).click(),
                ]);
                await page.waitForTimeout(800);
                const removedAfterDelete = !(await page.locator("body").innerText()).includes(updatedTitle);

                // Visit Instructor Dashboard & verify analytics + Chart.js canvas
                await page.goto(`${FRONTEND_URL}/#/dashboard/instructor`, { waitUntil: "networkidle" });
                await page.waitForSelector("canvas", { timeout: 15000 });
                const instDashText = await page.locator("body").innerText();
                const hasChartCanvas = (await page.locator("canvas").count()) > 0;
                const hasStats =
                    instDashText.includes("Total Courses") &&
                    instDashText.includes("Total Students") &&
                    instDashText.includes("Total Income");

                record(
                    "E2E-20",
                    "Live Edit Course + Delete Course + Instructor Dashboard Chart",
                    editResp.status() === 200 &&
                        delResp.status() === 200 &&
                        removedAfterDelete &&
                        hasChartCanvas &&
                        hasStats,
                    `edit=${editResp.status()}, delete=${delResp.status()}, removed=${removedAfterDelete}, chartCanvas=${hasChartCanvas}, statsVisible=${hasStats}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-21: Live Update Password + Delete Account Confirmation Modal
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const newPassword = `${TEST_PASSWORD}!Updated`;
                await uiLogin(page, FIXTURES.disposableEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/settings`, { waitUntil: "networkidle" });

                // Update Password
                await page.fill("#oldPassword", TEST_PASSWORD);
                await page.fill("#newPassword", newPassword);
                await page.fill("#confirmNewPassword", newPassword);
                const [pwResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/changepassword"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /^Update$/i }).click(),
                ]);
                await waitForHash(page, "/dashboard/my-profile");

                // Logout and confirm login with new password works
                await uiLogout(page);
                const newLoginStatus = await uiLogin(page, FIXTURES.disposableEmail, newPassword);
                await waitForHash(page, "/dashboard/my-profile");

                // Go back to Settings -> Test Delete Account Confirmation Modal (Cancel then Confirm)
                await page.goto(`${FRONTEND_URL}/#/dashboard/settings`, { waitUntil: "networkidle" });
                await page.getByRole("button", { name: /I want to permanently delete my account/i }).click();
                await page.waitForSelector("text=Delete Account Permanently?", { timeout: 10000 });

                // Click Cancel first — modal closes, user remains on settings
                await page.getByRole("button", { name: /^Cancel$/i }).last().click();
                await page.waitForTimeout(400);
                const modalDismissedOnCancel =
                    (await page.locator("text=Delete Account Permanently?").count()) === 0;

                // Open modal again & confirm permanent deletion
                await page.getByRole("button", { name: /I want to permanently delete my account/i }).click();
                await page.waitForSelector("text=Delete Account Permanently?", { timeout: 10000 });
                const [delAcctResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/profile/deleteProfile"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /^Delete$/i }).click(),
                ]);
                await page.waitForTimeout(1000);
                const tokenClearedAfterDelete = await page.evaluate(() => localStorage.getItem("token") === null);

                // Verify deleted account can no longer log in
                const deletedLoginStatus = await uiLogin(page, FIXTURES.disposableEmail, newPassword);

                record(
                    "E2E-21",
                    "Live Update Password + Delete Account Confirmation Modal",
                    pwResp.status() === 200 &&
                        newLoginStatus === 200 &&
                        modalDismissedOnCancel &&
                        delAcctResp.status() === 200 &&
                        tokenClearedAfterDelete &&
                        deletedLoginStatus === 401,
                    `pwUpdate=${pwResp.status()}, newLogin=${newLoginStatus}, cancelWorked=${modalDismissedOnCancel}, deleteStatus=${delAcctResp.status()}, tokenCleared=${tokenClearedAfterDelete}, postDeleteLogin=${deletedLoginStatus}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-22 (GAP-005): Student Free (₹0) Course Enrollment — Zero Razorpay Calls
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                let razorpayHitCount = 0;
                page.on("request", (req) => {
                    const url = req.url();
                    if (url.includes("razorpay.com") || url.includes("/payment/capturePayment")) {
                        razorpayHitCount++;
                    }
                });

                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);

                // Catalog shows "Free" label on free course
                await page.goto(`${FRONTEND_URL}/#/catalog/web-dev`, { waitUntil: "networkidle" });
                await page.waitForSelector(`text=${seeded.courses.freeCourseName}`, { timeout: 15000 });
                const catalogText = await page.locator("body").innerText();
                const catalogShowsFree = catalogText.includes("Free");

                // Open Free Course Details -> verify Free, Enroll Now, no Buy Now / Add to Cart
                await page.goto(`${FRONTEND_URL}/#/courses/${seeded.courses.freeCourseId}`, {
                    waitUntil: "networkidle",
                });
                const enrollBtn = page.locator('button:has-text("Enroll Now"):visible').first();
                await enrollBtn.waitFor({ state: "visible", timeout: 15000 });
                const detailsText = await page.locator("body").innerText();
                const hasFreeLabel = detailsText.includes("Free") && !detailsText.includes("Buy Now");
                const noAddToCart = (await page.locator('button:has-text("Add to Cart"):visible').count()) === 0;

                // Click Enroll Now -> calls /payment/enrollFreeCourse -> redirects to Enrolled Courses
                const [enrollResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/payment/enrollFreeCourse"), {
                        timeout: 15000,
                    }),
                    enrollBtn.click(),
                ]);
                await waitForHash(page, "/dashboard/enrolled-courses");
                await page.waitForSelector(`text=${seeded.courses.freeCourseName}`, { timeout: 15000 });

                // Verify course access works in ViewCourse
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/getFullCourseDetails"), {
                        timeout: 15000,
                    }),
                    page.goto(
                        `${FRONTEND_URL}/#/view-course/${seeded.courses.freeCourseId}/section/${seeded.courses.freeCourseSectionId}/sub-section/${seeded.courses.freeCourseSubSectionId}`,
                        { waitUntil: "networkidle" }
                    ),
                ]);
                await page.waitForSelector("video", { timeout: 15000 });
                await page.waitForSelector("text=Lesson 1: Free JS Primer", { timeout: 15000 });
                const canAccessLesson = (await page.locator("body").innerText()).includes(
                    "Lesson 1: Free JS Primer"
                );

                // Revisit Course Details -> now shows "Go To Course" (already enrolled)
                await page.goto(`${FRONTEND_URL}/#/courses/${seeded.courses.freeCourseId}`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector('button:has-text("Go To Course"):visible', { timeout: 15000 });
                const showsGoToCourse =
                    (await page.locator('button:has-text("Go To Course"):visible').count()) > 0;

                record(
                    "E2E-22",
                    "GAP-005 Free Course Direct Enrollment & Content Access (Zero Razorpay)",
                    catalogShowsFree &&
                        hasFreeLabel &&
                        noAddToCart &&
                        enrollResp.status() === 200 &&
                        razorpayHitCount === 0 &&
                        canAccessLesson &&
                        showsGoToCourse,
                    `enrollStatus=${enrollResp.status()}, razorpayHits=${razorpayHitCount}, catalogFree=${catalogShowsFree}, noCartBtn=${noAddToCart}, canAccessLesson=${canAccessLesson}, showsGoToCourse=${showsGoToCourse}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-23 (GAP-005): Instructor Creates & Publishes Free (₹0) Course via CoursesTable
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await uiLogin(page, FIXTURES.instructorEmail, TEST_PASSWORD);

                await page.goto(`${FRONTEND_URL}/#/dashboard/add-course`, { waitUntil: "networkidle" });
                await page.waitForSelector('input[name="courseTitle"]', { timeout: 15000 });

                const freeCourseTitle = "E2E Free Published Course";
                await page.fill('input[name="courseTitle"]', freeCourseTitle);
                await page.fill(
                    'textarea[name="courseShortDesc"]',
                    "Free course created with price 0 and published from CoursesTable."
                );
                await page.fill('input[name="coursePrice"]', "0");
                await page.selectOption('select[name="courseCategory"]', seeded.categories.webDevId);
                await page.fill("#courseTags", "Free");
                await page.press("#courseTags", "Enter");
                await page.locator('input[type="file"][accept="image/*"]').setInputFiles(samplePngPath);
                await page.fill('textarea[name="courseBenefits"]', "Free learning for everyone.");
                await page.fill("#courseRequirements", "Curiosity");
                await page.getByRole("button", { name: /^Add$/i }).click();

                const [createFreeResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/createCourse"), {
                        timeout: 20000,
                    }),
                    page.getByRole("button", { name: /^Next$/i }).click(),
                ]);

                // Add 1 Section + 1 Lecture so publish validation passes, keep as Draft
                await page.waitForSelector("#sectionName", { timeout: 15000 });
                await page.fill("#sectionName", "Free Module 1");
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/addSection"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Create Section/i }).click(),
                ]);
                await page.waitForSelector("text=Add Lecture", { timeout: 10000 });
                await page.getByRole("button", { name: /Add Lecture/i }).click();
                await page.waitForSelector("#lectureTitle", { timeout: 10000 });
                await page.locator('input[type="file"][accept="video/*"]').setInputFiles(sampleVideoPath);
                await page.fill("#lectureTitle", "Free Lecture 1");
                await page.fill("#lectureDesc", "Welcome lecture");
                await page.fill("#lectureDuration", "60");
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/addSubSection"), {
                        timeout: 20000,
                    }),
                    page.getByRole("button", { name: /^Save$/i }).click(),
                ]);
                await page.waitForTimeout(600);

                // Navigate to My Courses and publish the ₹0 Draft course directly via CoursesTable status pill
                await page.goto(`${FRONTEND_URL}/#/dashboard/my-courses`, { waitUntil: "networkidle" });
                const freeRow = page.locator("tr", { hasText: freeCourseTitle }).first();
                await freeRow.waitFor({ state: "visible", timeout: 15000 });
                const rowTextBefore = await freeRow.innerText();
                const displaysFreeInTable = rowTextBefore.includes("Free");

                const [togglePublishResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/editCourse"), { timeout: 15000 }),
                    freeRow.locator('button[title="Click to publish"]').click(),
                ]);
                await page.waitForTimeout(800);
                const rowTextAfter = await page.locator("tr", { hasText: freeCourseTitle }).first().innerText();
                const publishedNow = rowTextAfter.includes("Published");

                record(
                    "E2E-23",
                    "GAP-005 Instructor Create & Publish ₹0 Free Course via CoursesTable",
                    createFreeResp.status() === 200 &&
                        displaysFreeInTable &&
                        togglePublishResp.status() === 200 &&
                        publishedNow,
                    `create=${createFreeResp.status()}, displaysFree=${displaysFreeInTable}, publishToggle=${togglePublishResp.status()}, publishedNow=${publishedNow}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-24 (GAP-004): Global Navbar Search, Debounced Preview, Clear & Draft Exclusion
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                // Create an unpublished Draft course via isolated API to verify draft exclusion
                const instLoginRes = await fetchJson(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: FIXTURES.instructorEmail,
                        password: TEST_PASSWORD,
                    }),
                });
                const instToken = instLoginRes.data?.token;
                const draftTitle = "E2E Hidden Draft Quantum Course";
                const draftCreateRes = await fetchJson(`${API_BASE_URL}/course/createCourse`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${instToken}`,
                    },
                    body: JSON.stringify({
                        courseName: draftTitle,
                        courseDescription: "Draft course that must never appear in public search.",
                        whatYouWillLearn: "Hidden content",
                        price: 499,
                        category: seeded.categories.webDevId,
                        status: "Draft",
                    }),
                });
                const draftCreated = draftCreateRes.status === 200;

                // Public visitor searches from Navbar (case-insensitive partial title)
                await page.goto(`${FRONTEND_URL}/#/`, { waitUntil: "domcontentloaded" });
                const navInput = page.locator("#navbar-course-search");
                await navInput.waitFor({ state: "visible", timeout: 15000 });

                const [previewResp] = await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("bootcamp"),
                        { timeout: 15000 }
                    ),
                    navInput.fill("bootcamp"),
                ]);
                const suggestionBtn = page
                    .locator('div[role="region"][aria-label="Search suggestions"] button', {
                        hasText: seeded.courses.purchasableCourseName,
                    })
                    .first();
                await suggestionBtn.waitFor({ state: "visible", timeout: 10000 });
                await suggestionBtn.click();
                await waitForHash(page, `/courses/${seeded.courses.purchasableCourseId}`);
                const navigatedToDetails = page.url().includes(seeded.courses.purchasableCourseId);

                // Search for exact Draft title -> must NOT appear
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("Hidden"),
                        { timeout: 15000 }
                    ),
                    navInput.fill(draftTitle),
                ]);
                await page.waitForSelector('text=No courses found', { timeout: 10000 });
                const draftExcluded = !(await page
                    .locator('div[role="region"][aria-label="Search suggestions"]')
                    .innerText()).includes("₹499");

                // Clear button resets input & closes dropdown
                await page.locator('button[aria-label="Clear search"]').click();
                const clearedValue = await navInput.inputValue();

                // Submit with Enter navigates to /courses?q=Isolated
                await navInput.fill("Isolated");
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("q=Isolated"),
                        { timeout: 15000 }
                    ),
                    navInput.press("Enter"),
                ]);
                await waitForHash(page, "/courses?q=Isolated");
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });

                record(
                    "E2E-24",
                    "GAP-004 Navbar Search (Debounce Preview, Clear, Navigation & Draft Exclusion)",
                    draftCreated &&
                        previewResp.status() === 200 &&
                        navigatedToDetails &&
                        draftExcluded &&
                        clearedValue === "",
                    `draftCreated=${draftCreated}, preview=${previewResp.status()}, navDetails=${navigatedToDetails}, draftExcluded=${draftExcluded}, cleared=${clearedValue === ""}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-25 (GAP-004): Course Filtering, Combined Filters, All 5 Sorts, URL Sync & API Error Retry
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await page.goto(`${FRONTEND_URL}/#/courses`, { waitUntil: "networkidle" });
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });
                const initialText = await page.locator('[data-testid="search-results-grid"]').innerText();
                const hasFreeAndPaid =
                    initialText.includes(seeded.courses.freeCourseName) &&
                    initialText.includes(seeded.courses.purchasableCourseName);

                // Filter Free only
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("priceType=free"),
                        { timeout: 15000 }
                    ),
                    page.locator('input[name="priceType"][value="free"]').click(),
                ]);
                await page.waitForTimeout(300);
                const freeGridText = await page.locator('[data-testid="search-results-grid"]').innerText();
                const freeOnlyOk =
                    freeGridText.includes(seeded.courses.freeCourseName) &&
                    !freeGridText.includes(seeded.courses.purchasableCourseName);

                // Filter Paid only
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("priceType=paid"),
                        { timeout: 15000 }
                    ),
                    page.locator('input[name="priceType"][value="paid"]').click(),
                ]);
                await page.waitForTimeout(300);
                const paidGridText = await page.locator('[data-testid="search-results-grid"]').innerText();
                const paidOnlyOk =
                    paidGridText.includes(seeded.courses.purchasableCourseName) &&
                    !paidGridText.includes(seeded.courses.freeCourseName);

                // Combined filter: Category (Web Dev) + Price Range (1000..1600) + Min Rating (4+)
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/search"), { timeout: 15000 }),
                    page.selectOption("#filter-category", seeded.categories.webDevId),
                ]);
                await page.fill("#filter-min-price", "1000");
                await page.fill("#filter-max-price", "1600");
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("minPrice=1000"),
                        { timeout: 15000 }
                    ),
                    page.getByRole("button", { name: /Apply Price/i }).click(),
                ]);
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("minRating=4"),
                        { timeout: 15000 }
                    ),
                    page.locator('input[name="minRating"][value="4"]').click(),
                ]);
                await page.waitForTimeout(300);
                const combinedText = await page.locator('[data-testid="search-results-grid"]').innerText();
                const combinedOk =
                    combinedText.includes(seeded.courses.enrolledCourseName) &&
                    !combinedText.includes(seeded.courses.freeCourseName);

                // Reload page & verify URL query params restore exact combined filter state
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });
                const reloadedText = await page.locator('[data-testid="search-results-grid"]').innerText();
                const urlSyncOk =
                    page.url().includes("minPrice=1000") &&
                    page.url().includes("minRating=4") &&
                    reloadedText.includes(seeded.courses.enrolledCourseName);

                // Clear all filters & verify all 5 sort options
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/search"), { timeout: 15000 }),
                    page.locator("aside button", { hasText: /Clear all/i }).click(),
                ]);
                await page.waitForTimeout(300);

                // Price Low to High -> first card is Free
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("sort=price_asc"),
                        { timeout: 15000 }
                    ),
                    page.selectOption("#course-sort-select", "price_asc"),
                ]);
                await page.waitForTimeout(300);
                const firstAscText = await page
                    .locator('[data-testid="search-results-grid"] > a')
                    .first()
                    .innerText();
                const priceAscOk = firstAscText.includes("Free");

                // Price High to Low -> first card is ₹ 1499 (or higher)
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("sort=price_desc"),
                        { timeout: 15000 }
                    ),
                    page.selectOption("#course-sort-select", "price_desc"),
                ]);
                await page.waitForTimeout(300);
                const firstDescText = await page
                    .locator('[data-testid="search-results-grid"] > a')
                    .first()
                    .innerText();
                const priceDescOk = firstDescText.includes("₹") && !firstDescText.includes("Free");

                // Highest Rated -> first card is Isolated MERN Mastery (rated 5★ in E2E-18)
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("sort=rating"),
                        { timeout: 15000 }
                    ),
                    page.selectOption("#course-sort-select", "rating"),
                ]);
                await page.waitForTimeout(300);
                const firstRatedText = await page
                    .locator('[data-testid="search-results-grid"] > a')
                    .first()
                    .innerText();
                const ratingSortOk = firstRatedText.includes(seeded.courses.enrolledCourseName);

                // Most Popular -> HTTP 200
                const [popResp] = await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("sort=popular"),
                        { timeout: 15000 }
                    ),
                    page.selectOption("#course-sort-select", "popular"),
                ]);
                const popularSortOk = popResp.status() === 200;

                // API failure handling + Retry recovery
                let failOnce = true;
                await page.route("**/api/v1/course/search**", async (route) => {
                    if (failOnce) {
                        failOnce = false;
                        await route.fulfill({
                            status: 500,
                            contentType: "application/json",
                            body: JSON.stringify({ success: false, message: "Simulated search outage" }),
                        });
                    } else {
                        await route.continue();
                    }
                });
                await page.selectOption("#course-sort-select", "newest");
                await page.waitForSelector("text=Could not load courses", { timeout: 10000 });
                const errorDisplayed = (await page.locator("body").innerText()).includes(
                    "Simulated search outage"
                );
                await page.getByRole("button", { name: /^Retry$/i }).click();
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });
                await page.unroute("**/api/v1/course/search**");
                const retryRecovered =
                    (await page.locator('[data-testid="search-results-grid"] > a').count()) > 0;

                record(
                    "E2E-25",
                    "GAP-004 Filtering, Combined Filters, All 5 Sorts, URL Sync & API Error Retry",
                    hasFreeAndPaid &&
                        freeOnlyOk &&
                        paidOnlyOk &&
                        combinedOk &&
                        urlSyncOk &&
                        priceAscOk &&
                        priceDescOk &&
                        ratingSortOk &&
                        popularSortOk &&
                        errorDisplayed &&
                        retryRecovered,
                    `freeAndPaid=${hasFreeAndPaid}, free=${freeOnlyOk}, paid=${paidOnlyOk}, combined=${combinedOk}, urlSync=${urlSyncOk}, sorts=${priceAscOk}/${priceDescOk}/${ratingSortOk}/${popularSortOk}, errorRetry=${errorDisplayed && retryRecovered}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-26 (GAP-004): Server-Side Pagination, Out-of-Range Page & Mobile (375px) Search Usability
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await page.goto(`${FRONTEND_URL}/#/courses?limit=2&sort=price_asc`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });

                const page1Titles = await page
                    .locator('[data-testid="search-results-grid"] > a')
                    .evaluateAll((els) => els.map((el) => el.getAttribute("href")));

                // Click Next -> Page 2 preserves sort & limit and loads different courses
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("page=2"),
                        { timeout: 15000 }
                    ),
                    page.getByRole("button", { name: /^Next$/i }).click(),
                ]);
                await page.waitForTimeout(300);
                const page2Titles = await page
                    .locator('[data-testid="search-results-grid"] > a')
                    .evaluateAll((els) => els.map((el) => el.getAttribute("href")));

                const paginationPreserved =
                    page.url().includes("page=2") &&
                    page.url().includes("sort=price_asc") &&
                    page1Titles.length === 2 &&
                    page2Titles.length > 0 &&
                    !page2Titles.some((href) => page1Titles.includes(href));

                // Click Previous -> returns to Page 1
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("page=1"),
                        { timeout: 15000 }
                    ),
                    page.getByRole("button", { name: /^Previous$/i }).click(),
                ]);
                await page.waitForTimeout(300);
                const prevWorked = !page.url().includes("page=2");

                // Out-of-range page -> offers "Go to Page 1" recovery
                await page.goto(`${FRONTEND_URL}/#/courses?page=99&limit=2`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector("text=Go to Page 1", { timeout: 10000 });
                await page.getByRole("button", { name: /Go to Page 1/i }).click();
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });
                const oobRecovered =
                    (await page.locator('[data-testid="search-results-grid"] > a').count()) > 0;

                // Mobile 375px search & filter usability
                await page.setViewportSize({ width: 375, height: 812 });
                await page.goto(`${FRONTEND_URL}/#/`, { waitUntil: "networkidle" });
                const mobileToggle = page.locator('button[aria-label="Toggle course search"]');
                await mobileToggle.waitFor({ state: "visible", timeout: 10000 });
                await mobileToggle.click();

                const mobileInput = page.locator("#mobile-navbar-course-search");
                await mobileInput.waitFor({ state: "visible", timeout: 10000 });
                await mobileInput.fill("Free");
                await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/course/search") && r.url().includes("q=Free"),
                        { timeout: 15000 }
                    ),
                    mobileInput.press("Enter"),
                ]);
                await waitForHash(page, "/courses?q=Free");
                await page.waitForSelector('[data-testid="search-results-grid"]', { timeout: 15000 });

                // Toggle mobile Filters drawer and verify zero horizontal overflow
                await page.getByRole("button", { name: /Filters/i }).click();
                await page.waitForSelector("#filter-category", { state: "visible", timeout: 10000 });
                const mobileOverflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > window.innerWidth
                );

                record(
                    "E2E-26",
                    "GAP-004 Server-Side Pagination, Out-of-Range Recovery & Mobile (375px) Search",
                    paginationPreserved && prevWorked && oobRecovered && !mobileOverflow,
                    `paginationPreserved=${paginationPreserved}, prevWorked=${prevWorked}, oobRecovered=${oobRecovered}, mobileOverflow=${mobileOverflow}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-27 (GAP-001): Admin Route & API RBAC Security (Unauth, Student, Instructor)
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                // 1. Unauthenticated direct visit to /dashboard/admin -> redirects to /login
                await page.goto(`${FRONTEND_URL}/#/dashboard/admin`, { waitUntil: "networkidle" });
                await waitForHash(page, "/login");
                const unauthBlocked = page.url().includes("/login");

                // 2. Logged-in Student: zero Admin sidebar links & direct route redirects away + API 403
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                await waitForHash(page, "/dashboard/my-profile");
                const studentSidebarText = await page.locator("body").innerText();
                const studentNoAdminNav =
                    !studentSidebarText.includes("Admin Dashboard") &&
                    !studentSidebarText.includes("Manage Categories");

                await page.goto(`${FRONTEND_URL}/#/dashboard/admin/categories`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/my-profile");
                const studentRouteBlocked =
                    page.url().includes("/dashboard/my-profile") &&
                    !page.url().includes("/dashboard/admin");

                const studentApiStatus = await page.evaluate(async (apiBase) => {
                    const tok = localStorage.getItem("token");
                    const res = await fetch(`${apiBase}/course/adminDashboard`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    return res.status;
                }, API_BASE_URL);

                await uiLogout(page);

                // 3. Logged-in Instructor: zero Admin sidebar links & direct route redirects away + API 403
                await uiLogin(page, FIXTURES.instructorEmail, TEST_PASSWORD);
                await waitForHash(page, "/dashboard/my-profile");
                const instSidebarText = await page.locator("body").innerText();
                const instNoAdminNav =
                    !instSidebarText.includes("Admin Dashboard") &&
                    !instSidebarText.includes("Manage Categories");

                await page.goto(`${FRONTEND_URL}/#/dashboard/admin`, { waitUntil: "networkidle" });
                await waitForHash(page, "/dashboard/my-profile");
                const instRouteBlocked =
                    page.url().includes("/dashboard/my-profile") &&
                    !page.url().includes("/dashboard/admin");

                const instApiStatus = await page.evaluate(async (apiBase) => {
                    const tok = localStorage.getItem("token");
                    const res = await fetch(`${apiBase}/course/createCategory`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${tok}`,
                        },
                        body: JSON.stringify({ name: "Unauthorized Instructor Cat" }),
                    });
                    return res.status;
                }, API_BASE_URL);

                record(
                    "E2E-27",
                    "GAP-001 Admin Security & RBAC (Unauth, Student & Instructor Blocked)",
                    unauthBlocked &&
                        studentNoAdminNav &&
                        studentRouteBlocked &&
                        studentApiStatus === 403 &&
                        instNoAdminNav &&
                        instRouteBlocked &&
                        instApiStatus === 403,
                    `unauth=${unauthBlocked}, stuNav=${studentNoAdminNav}, stuRoute=${studentRouteBlocked}, stuApi=${studentApiStatus}, instNav=${instNoAdminNav}, instRoute=${instRouteBlocked}, instApi=${instApiStatus}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-28 (GAP-001): Admin Login, Dashboard, Category CRUD, Duplicates, Safe Delete & Error Retry
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const loginStatus = await uiLogin(page, FIXTURES.adminEmail, TEST_PASSWORD);
                await waitForHash(page, "/dashboard/admin");
                await page
                    .locator('h1:has-text("Admin Dashboard")')
                    .waitFor({ state: "visible", timeout: 15000 });

                const dashBody = await page.locator("body").innerText();
                const dashBodyLower = dashBody.toLowerCase();
                const dashLoaded =
                    dashBodyLower.includes("total categories") &&
                    dashBodyLower.includes("total courses") &&
                    dashBody.includes("Manage Categories");
                const noStudentCartIcon =
                    (await page.locator('a[href="#/dashboard/cart"]').count()) === 0;

                // Navigate to Category Management via visible sidebar/CTA link
                await page.locator('a[href="#/dashboard/admin/categories"]:visible').first().click();
                await waitForHash(page, "/dashboard/admin/categories");
                await page
                    .locator('h1:has-text("Category Management")')
                    .waitFor({ state: "visible", timeout: 15000 });

                // Safe delete block: attempting to delete "Web Dev" (in use) opens blocked dialog
                await page.locator('button[aria-label="Delete Web Dev"]:visible').first().click();
                await page.waitForSelector("text=Cannot Delete Category", { timeout: 10000 });
                const safeDeleteBlocked = (await page.locator("body").innerText()).includes(
                    "associated"
                );
                await page.getByRole("button", { name: /^Close$/i }).click();

                // Create new category "Cybersecurity"
                await page.getByRole("button", { name: /Create Category/i }).first().click();
                await page.waitForSelector("#category-name", { timeout: 10000 });
                await page.fill("#category-name", "Cybersecurity");
                await page.fill("#category-description", "Network defense and ethical hacking");
                const [createResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/createCategory"), {
                        timeout: 15000,
                    }),
                    page.locator('div[role="dialog"] button[type="submit"]').click(),
                ]);
                await page
                    .locator('button[aria-label="Edit Cybersecurity"]:visible')
                    .first()
                    .waitFor({ state: "visible", timeout: 10000 });

                // Duplicate prevention check (case-insensitive -> 409 inline error in modal)
                await page.getByRole("button", { name: /Create Category/i }).first().click();
                await page.fill("#category-name", "cybersecurity");
                const [dupResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/createCategory"), {
                        timeout: 15000,
                    }),
                    page.locator('div[role="dialog"] button[type="submit"]').click(),
                ]);
                await page.waitForTimeout(400);
                const dialogText = await page.locator('div[role="dialog"]').innerText();
                const dupErrorShown = dialogText.includes("already exists") || dupResp.status() === 409;
                await page.locator('div[role="dialog"] button[aria-label="Close modal"]').click();

                // Edit "Cybersecurity" -> "Cybersecurity Pro"
                await page.locator('button[aria-label="Edit Cybersecurity"]:visible').first().click();
                await page.waitForSelector("#category-name", { timeout: 10000 });
                await page.fill("#category-name", "Cybersecurity Pro");
                await page.fill("#category-description", "Advanced security engineering");
                const [updateResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/updateCategory"), {
                        timeout: 15000,
                    }),
                    page.locator('div[role="dialog"] button[type="submit"]').click(),
                ]);
                await page
                    .locator('button[aria-label="Delete Cybersecurity Pro"]:visible')
                    .first()
                    .waitFor({ state: "visible", timeout: 10000 });

                // Search categories table
                await page.fill("#admin-category-search", "Cybersecurity Pro");
                await page.waitForTimeout(200);
                const searchFiltered = (await page.locator("body").innerText()).includes(
                    "Showing 1 of"
                );
                await page.locator('button[aria-label="Clear category search"]').click();

                // Delete empty category "Cybersecurity Pro" via ConfirmationModal
                await page
                    .locator('button[aria-label="Delete Cybersecurity Pro"]:visible')
                    .first()
                    .click();
                await page.waitForSelector("text=Delete Category?", { timeout: 10000 });
                const [deleteResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/deleteCategory"), {
                        timeout: 15000,
                    }),
                    page.locator('button:has-text("Delete"):visible').last().click(),
                ]);
                await page.waitForTimeout(600);
                const deletedFromTable = !(await page.locator("body").innerText()).includes(
                    "Cybersecurity Pro"
                );

                // API failure recovery on Category Management
                let failOnce = true;
                await page.route("**/api/v1/course/adminDashboard**", async (route) => {
                    if (failOnce) {
                        failOnce = false;
                        await route.fulfill({
                            status: 500,
                            contentType: "application/json",
                            body: JSON.stringify({
                                success: false,
                                message: "Simulated admin outage",
                            }),
                        });
                    } else {
                        await route.continue();
                    }
                });
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForSelector("text=Could not load categories", { timeout: 10000 });
                const errorShown = (await page.locator("body").innerText()).includes(
                    "Simulated admin outage"
                );
                await page.getByRole("button", { name: /^Retry$/i }).click();
                await page
                    .locator('button[aria-label="Edit Web Dev"]:visible')
                    .first()
                    .waitFor({ state: "visible", timeout: 10000 });
                await page.unroute("**/api/v1/course/adminDashboard**");
                const retryOk = (await page.locator("body").innerText()).includes("Web Dev");

                record(
                    "E2E-28",
                    "GAP-001 Admin Dashboard, Category CRUD, Duplicate Guard, Safe Delete & Error Retry",
                    loginStatus === 200 &&
                        dashLoaded &&
                        noStudentCartIcon &&
                        safeDeleteBlocked &&
                        createResp.status() === 200 &&
                        dupResp.status() === 409 &&
                        dupErrorShown &&
                        updateResp.status() === 200 &&
                        searchFiltered &&
                        deleteResp.status() === 200 &&
                        deletedFromTable &&
                        errorShown &&
                        retryOk,
                    `login=${loginStatus}, dash=${dashLoaded}, noCart=${noStudentCartIcon}, safeBlock=${safeDeleteBlocked}, create=${createResp.status()}, dup=${dupResp.status()}, dupError=${dupErrorShown}, update=${updateResp.status()}, search=${searchFiltered}, delete=${deleteResp.status()}, deleted=${deletedFromTable}, errorRetry=${errorShown && retryOk}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-29 (GAP-001): Category Update Consistency Across Catalog, Search & Mobile 375px Admin UI
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await uiLogin(page, FIXTURES.adminEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/admin/categories`, {
                    waitUntil: "networkidle",
                });
                await page
                    .locator('button[aria-label="Edit Data Science"]:visible')
                    .first()
                    .waitFor({ state: "visible", timeout: 15000 });

                // Rename "Data Science" -> "Applied Data Science"
                await page.locator('button[aria-label="Edit Data Science"]:visible').first().click();
                await page.waitForSelector("#category-name", { timeout: 10000 });
                await page.fill("#category-name", "Applied Data Science");
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/updateCategory"), {
                        timeout: 15000,
                    }),
                    page.locator('div[role="dialog"] button[type="submit"]').click(),
                ]);
                await page
                    .locator('button[aria-label="Edit Applied Data Science"]:visible')
                    .first()
                    .waitFor({ state: "visible", timeout: 10000 });

                // Verify mobile 375px layout on Admin Category Management
                await page.setViewportSize({ width: 375, height: 812 });
                await page.waitForTimeout(300);
                const adminMobileOverflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > window.innerWidth
                );
                await page.setViewportSize({ width: 1280, height: 860 });

                // Verify Catalog route with updated slug still displays associated course
                await page.goto(`${FRONTEND_URL}/#/catalog/applied-data-science`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector("text=Isolated Data Science Essentials", {
                    timeout: 15000,
                });
                const catalogConsistent = (await page.locator("body").innerText()).includes(
                    "Applied Data Science"
                );

                // Verify Global Search category filter lists updated name and finds associated course
                await page.goto(`${FRONTEND_URL}/#/courses`, { waitUntil: "networkidle" });
                await page.waitForSelector("#filter-category", { timeout: 15000 });
                const categoryOptionsText = await page.locator("#filter-category").innerText();
                const searchHasUpdatedCat = categoryOptionsText.includes("Applied Data Science");
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/search"), {
                        timeout: 15000,
                    }),
                    page.selectOption("#filter-category", seeded.categories.dataScienceId),
                ]);
                await page.waitForSelector("text=Isolated Data Science Essentials", {
                    timeout: 10000,
                });
                const searchFilterConsistent = (
                    await page.locator('[data-testid="search-results-grid"]').innerText()
                ).includes("Isolated Data Science Essentials");

                // Restore original category name so downstream regression tests see canonical seeded names
                await page.goto(`${FRONTEND_URL}/#/dashboard/admin/categories`, {
                    waitUntil: "networkidle",
                });
                await page
                    .locator('button[aria-label="Edit Applied Data Science"]:visible')
                    .first()
                    .click();
                await page.fill("#category-name", "Data Science");
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/course/updateCategory"), {
                        timeout: 15000,
                    }),
                    page.locator('div[role="dialog"] button[type="submit"]').click(),
                ]);

                record(
                    "E2E-29",
                    "GAP-001 Category Consistency (Catalog + Global Search) & Mobile 375px Admin UI",
                    !adminMobileOverflow &&
                        catalogConsistent &&
                        searchHasUpdatedCat &&
                        searchFilterConsistent,
                    `adminMobileOverflow=${adminMobileOverflow}, catalogConsistent=${catalogConsistent}, searchHasUpdatedCat=${searchHasUpdatedCat}, searchFilterConsistent=${searchFilterConsistent}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-30 (GAP-008): Database-Backed Cart (Refresh, Logout/Login, Second Browser, Merge & Remove)
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);

                // Add Data Science course to persistent DB cart
                await page.goto(`${FRONTEND_URL}/#/courses/${seeded.courses.dataScienceCourseId}`, {
                    waitUntil: "networkidle",
                });
                const [addCartResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/cart/add"), { timeout: 15000 }),
                    page.locator('button:has-text("Add to Cart"):visible').first().click(),
                ]);

                // Verify cart & hard refresh persistence
                await page.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "domcontentloaded" });
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });
                const persistedAfterRefresh = (await page.locator("body").innerText()).includes("1299");

                // Logout & re-login -> DB cart must survive logout
                await uiLogout(page);
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "networkidle" });
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });
                const survivedLogout = (await page.locator("body").innerText()).includes(
                    "Isolated Data Science Essentials"
                );

                // Multi-browser persistence: brand new empty browser context logs in -> loads DB cart
                const { ctx: ctx2, page: page2 } = await newTrackedContext();
                let secondBrowserOk = false;
                try {
                    await uiLogin(page2, FIXTURES.studentEmail, TEST_PASSWORD);
                    await page2.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "networkidle" });
                    await page2.waitForSelector("text=Isolated Data Science Essentials", {
                        timeout: 15000,
                    });
                    secondBrowserOk = (await page2.locator("body").innerText()).includes("1299");
                } finally {
                    await ctx2.close();
                }

                // Remove from DB cart & verify empty across reload
                const [removeResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/cart/remove"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Remove/i }).first().click(),
                ]);
                await page.waitForSelector("text=Your Cart is Empty", { timeout: 10000 });

                // Anonymous local cart merge on login -> pre-seed localStorage before login
                await uiLogout(page);
                await page.evaluate((dsId) => {
                    localStorage.setItem("cart", JSON.stringify([{ _id: dsId, price: 1 }]));
                }, seeded.courses.dataScienceCourseId);
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "networkidle" });
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });
                const mergedWithAuthoritativePrice = (await page.locator("body").innerText()).includes(
                    "1299"
                );

                record(
                    "E2E-30",
                    "GAP-008 Persistent DB Cart (Refresh, Logout/Login, Multi-Browser, Remove & Merge)",
                    addCartResp.status() === 200 &&
                        persistedAfterRefresh &&
                        survivedLogout &&
                        secondBrowserOk &&
                        removeResp.status() === 200 &&
                        mergedWithAuthoritativePrice,
                    `add=${addCartResp.status()}, refresh=${persistedAfterRefresh}, logout=${survivedLogout}, secondBrowser=${secondBrowserOk}, remove=${removeResp.status()}, mergeAuthoritative=${mergedWithAuthoritativePrice}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-31 (GAP-008): Cancelled Payment Recording, Order History, Details Modal & Mobile 375px
        // =========================================================================
        let qaStudentPaidOrderId = null;
        {
            const { ctx, page } = await newTrackedContext();
            try {
                // Mock Razorpay to trigger modal.ondismiss (user cancelled payment)
                await page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) => {
                    await route.fulfill({
                        status: 200,
                        contentType: "application/javascript",
                        body: `
                            window.Razorpay = function(options) {
                                this.on = function() {};
                                this.open = function() {
                                    if (options.modal && typeof options.modal.ondismiss === "function") {
                                        options.modal.ondismiss();
                                    }
                                };
                            };
                        `,
                    });
                });

                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "networkidle" });
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });

                const [cancelResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/payment/markPaymentFailed"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /Buy Now/i }).click(),
                ]);
                await page.waitForTimeout(400);
                // Cart still intact after cancellation
                const cartStillHasCourse = (await page.locator("body").innerText()).includes(
                    "Isolated Data Science Essentials"
                );

                // Navigate to Order History via sidebar/direct route
                await page.goto(`${FRONTEND_URL}/#/dashboard/order-history`, {
                    waitUntil: "networkidle",
                });
                await page
                    .locator('button:has-text("View Details"):visible')
                    .first()
                    .waitFor({ state: "visible", timeout: 15000 });
                const histText = await page.locator("body").innerText();
                const hasPaidAndCancelled =
                    histText.includes("PAID") &&
                    histText.includes("CANCELLED") &&
                    histText.includes("Isolated DevOps Bootcamp") &&
                    histText.includes("Isolated Free JavaScript Primer");

                // Open Order Details modal on first PAID order
                await page.selectOption("#order-status-filter", "PAID");
                await page.waitForTimeout(500);
                const [detailResp] = await Promise.all([
                    page.waitForResponse((r) => /\/payment\/orders\/[a-f0-9]{24}$/i.test(r.url()), {
                        timeout: 15000,
                    }),
                    page.locator('button:has-text("View Details"):visible').first().click(),
                ]);
                const detailJson = await detailResp.json();
                qaStudentPaidOrderId = detailJson?.data?.order?._id || null;
                await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
                const modalText = await page.locator('div[role="dialog"]').innerText();
                const modalOk =
                    modalText.includes("Order Details") &&
                    modalText.includes("Receipt Reference") &&
                    modalText.includes("PAID");
                await page.locator('button[aria-label="Close order details"]').click();

                // Mobile 375px layout check on Order History
                await page.setViewportSize({ width: 375, height: 812 });
                await page.waitForTimeout(300);
                const orderMobileOverflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > window.innerWidth
                );

                record(
                    "E2E-31",
                    "GAP-008 Payment Cancellation, Order History, Details Modal & Mobile 375px",
                    cancelResp.status() === 200 &&
                        cartStillHasCourse &&
                        hasPaidAndCancelled &&
                        Boolean(qaStudentPaidOrderId) &&
                        modalOk &&
                        !orderMobileOverflow,
                    `cancel=${cancelResp.status()}, cartIntact=${cartStillHasCourse}, paidAndCancelled=${hasPaidAndCancelled}, modalOk=${modalOk}, mobileOverflow=${orderMobileOverflow}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-32 (GAP-008): Mixed Free + Paid Cart Checkout & Cross-User Order Isolation
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await page.exposeFunction("__computeMixedRzpSig", (orderId, paymentId) => {
                    return crypto
                        .createHmac("sha256", TEST_RAZORPAY_SECRET)
                        .update(`${orderId}|${paymentId}`)
                        .digest("hex");
                });

                await page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) => {
                    await route.fulfill({
                        status: 200,
                        contentType: "application/javascript",
                        body: `
                            window.__mixedRzpOpts = null;
                            window.Razorpay = function(options) {
                                window.__mixedRzpOpts = {
                                    amount: options.amount,
                                    currency: options.currency,
                                    order_id: options.order_id,
                                };
                                this.on = function() {};
                                this.open = async function() {
                                    const paymentId = "pay_mixed_e2e_" + Date.now();
                                    const signature = await window.__computeMixedRzpSig(options.order_id, paymentId);
                                    options.handler({
                                        razorpay_order_id: options.order_id,
                                        razorpay_payment_id: paymentId,
                                        razorpay_signature: signature,
                                    });
                                };
                            };
                        `,
                    });
                });

                // Login as Student 2 (created in E2E-16)
                await uiLogin(page, "e2e16.student@isolated.test", TEST_PASSWORD);

                // Empty Order History + Cross-user 403 check on QA Student's order
                await page.goto(`${FRONTEND_URL}/#/dashboard/order-history`, {
                    waitUntil: "domcontentloaded",
                });
                await page.waitForSelector("text=No orders yet", { timeout: 15000 });
                const emptyHistoryOk = (await page.locator("body").innerText()).includes(
                    "No orders yet"
                );

                const crossOrderStatus = await page.evaluate(
                    async ({ apiBase, targetOrderId }) => {
                        const tok = localStorage.getItem("token");
                        const res = await fetch(`${apiBase}/payment/orders/${targetOrderId}`, {
                            headers: { Authorization: `Bearer ${tok}` },
                        });
                        return res.status;
                    },
                    { apiBase: API_BASE_URL, targetOrderId: qaStudentPaidOrderId }
                );

                // Add both Free (₹0) and Paid (₹1299) courses to Student 2's persistent cart
                await page.evaluate(
                    async ({ apiBase, freeId, paidId }) => {
                        const tok = localStorage.getItem("token");
                        for (const courseId of [freeId, paidId]) {
                            await fetch(`${apiBase}/cart/add`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${tok}`,
                                },
                                body: JSON.stringify({ courseId }),
                            });
                        }
                    },
                    {
                        apiBase: API_BASE_URL,
                        freeId: seeded.courses.freeCourseId,
                        paidId: seeded.courses.dataScienceCourseId,
                    }
                );

                await page.goto(`${FRONTEND_URL}/#/dashboard/cart`, { waitUntil: "domcontentloaded" });
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });
                const mixedCartText = await page.locator("body").innerText();
                const mixedNoticeOk =
                    mixedCartText.includes("only charged for paid courses") &&
                    mixedCartText.includes("1299");

                const buyNowBtn = page.getByRole("button", { name: /Buy Now/i });
                await buyNowBtn.waitFor({ state: "visible", timeout: 15000 });
                await page.waitForTimeout(500);

                // Complete mixed checkout -> charges ONLY ₹1299 (129900 paise), enrolls BOTH courses
                const [verifyResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/payment/verifyPayment"), {
                        timeout: 25000,
                    }),
                    buyNowBtn.click(),
                ]);
                await waitForHash(page, "/dashboard/enrolled-courses");
                await page.waitForSelector("text=Isolated Data Science Essentials", { timeout: 15000 });
                const enrolledText = await page.locator("body").innerText();
                const bothEnrolled =
                    enrolledText.includes("Isolated Data Science Essentials") &&
                    enrolledText.includes("Isolated Free JavaScript Primer");
                const rzpOpts = await page.evaluate(() => window.__mixedRzpOpts);

                record(
                    "E2E-32",
                    "GAP-008 Mixed Free+Paid Cart Checkout & Cross-User Order Isolation",
                    emptyHistoryOk &&
                        crossOrderStatus === 403 &&
                        mixedNoticeOk &&
                        verifyResp.status() === 200 &&
                        rzpOpts?.amount === "129900" &&
                        bothEnrolled,
                    `emptyHist=${emptyHistoryOk}, cross403=${crossOrderStatus}, mixedNotice=${mixedNoticeOk}, verify=${verifyResp.status()}, rzpAmount=${rzpOpts?.amount}, bothEnrolled=${bothEnrolled}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-33 (GAP-007): Password Policy on Signup (Instructor) & Settings Change Password
        // =========================================================================
        const policyEmail = "e2e33.policy.instructor@isolated.test";
        const initial8CharPwd = "InitPwd8";
        const changedValidPwd = "ChangedPwd9!";
        {
            const { ctx, page } = await newTrackedContext();
            try {
                let sendOtpCalls = 0;
                let changePwdCalls = 0;
                page.on("request", (req) => {
                    if (req.url().includes("/auth/sendotp")) sendOtpCalls += 1;
                    if (req.url().includes("/auth/changepassword")) changePwdCalls += 1;
                });

                await page.goto(`${FRONTEND_URL}/#/signup`, { waitUntil: "networkidle" });
                // Switch to Instructor tab
                await page.getByRole("button", { name: /^Instructor$/i }).click();
                await page.fill('input[name="firstName"]', "Policy");
                await page.fill('input[name="lastName"]', "Instructor");
                await page.fill('input[name="email"]', policyEmail);

                // 1. 7-char password blocked client-side with zero /auth/sendotp network requests
                await page.fill('input[name="password"]', "short7!");
                await page.fill('input[name="confirmPassword"]', "short7!");
                await page.getByRole("button", { name: /Create Account/i }).click();
                await page.waitForTimeout(300);
                const shortSignupAlert = await page.locator('[role="alert"]').first().innerText();
                const shortSignupBlocked =
                    shortSignupAlert.includes("at least 8 characters") && sendOtpCalls === 0;

                // 2. Exact 8-char password proceeds through OTP -> signup -> login
                await page.fill('input[name="password"]', initial8CharPwd);
                await page.fill('input[name="confirmPassword"]', initial8CharPwd);
                const [otpResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/sendotp"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Create Account/i }).click(),
                ]);
                await waitForHash(page, "/verify-email");

                const otpRes = await fetchJson(
                    `${API_BASE_URL}/__test__/otp?email=${encodeURIComponent(policyEmail)}`
                );
                const otp = otpRes.data?.otp || "";
                const otpInputs = page.locator('form input[placeholder="-"]');
                await otpInputs.first().click();
                await page.keyboard.type(otp, { delay: 35 });

                const [signupResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/signup"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Verify Email/i }).click(),
                ]);
                await waitForHash(page, "/login");

                const firstLoginStatus = await uiLogin(page, policyEmail, initial8CharPwd);
                await waitForHash(page, "/dashboard/my-profile");

                // 3. Settings Change Password rejects 7-char new password with 0 network requests
                await page.goto(`${FRONTEND_URL}/#/dashboard/settings`, { waitUntil: "networkidle" });
                await page.waitForSelector("#oldPassword", { timeout: 15000 });
                await page.fill("#oldPassword", initial8CharPwd);
                await page.fill("#newPassword", "short7!");
                await page.fill("#confirmNewPassword", "short7!");
                await page.locator('button[type="submit"]:has-text("Update")').click();
                await page.waitForTimeout(300);
                const settingsBody = await page.locator("body").innerText();
                const shortChangeBlocked =
                    settingsBody.includes("at least 8 characters") && changePwdCalls === 0;

                // 4. Wrong current password rejected by backend (401)
                await page.fill("#oldPassword", "WrongOld8");
                await page.fill("#newPassword", changedValidPwd);
                await page.fill("#confirmNewPassword", changedValidPwd);
                const [wrongOldResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/changepassword"), {
                        timeout: 15000,
                    }),
                    page.locator('button[type="submit"]:has-text("Update")').click(),
                ]);
                await page.waitForTimeout(300);

                // 5. Valid current password + valid >=8-char new password succeeds (200) & re-login works
                await page.fill("#oldPassword", initial8CharPwd);
                await page.fill("#newPassword", changedValidPwd);
                await page.fill("#confirmNewPassword", changedValidPwd);
                const [validChangeResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/changepassword"), {
                        timeout: 15000,
                    }),
                    page.locator('button[type="submit"]:has-text("Update")').click(),
                ]);
                await waitForHash(page, "/dashboard/my-profile");

                await uiLogout(page);
                const reloginStatus = await uiLogin(page, policyEmail, changedValidPwd);

                record(
                    "E2E-33",
                    "GAP-007 Signup (Instructor) & Settings Change Password Policy Enforcement",
                    shortSignupBlocked &&
                        otpResp.status() === 200 &&
                        signupResp.status() === 200 &&
                        firstLoginStatus === 200 &&
                        shortChangeBlocked &&
                        wrongOldResp.status() === 401 &&
                        validChangeResp.status() === 200 &&
                        reloginStatus === 200,
                    `shortSignupBlocked=${shortSignupBlocked}, signup=${signupResp.status()}, firstLogin=${firstLoginStatus}, shortChangeBlocked=${shortChangeBlocked}, wrongOld=${wrongOldResp.status()}, validChange=${validChangeResp.status()}, relogin=${reloginStatus}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-34 (GAP-007): Forgot Password -> Reset Password Policy, Single-Use Token & Login
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                let resetApiCalls = 0;
                page.on("request", (req) => {
                    if (req.url().includes("/auth/reset-password") && !req.url().includes("-token")) {
                        resetApiCalls += 1;
                    }
                });

                // 1. Request password reset link from /#/forgot-password
                await page.goto(`${FRONTEND_URL}/#/forgot-password`, { waitUntil: "networkidle" });
                await page.fill('input[name="email"]', policyEmail);
                const [tokenResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/reset-password-token"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /Reset Password/i }).click(),
                ]);
                await page.waitForSelector("text=Check your email", { timeout: 10000 });

                // 2. Capture reset token from isolated mock email outbox
                const emailsRes = await fetchJson(`${API_BASE_URL}/__test__/emails`);
                const resetEmails = (emailsRes.data?.emails || []).filter(
                    (m) => m.to === policyEmail && m.subject === "Password Reset Link"
                );
                const latestResetEmail = resetEmails[resetEmails.length - 1];
                const tokenMatch = (latestResetEmail?.html || "").match(
                    /\/#\/update-password\/([a-zA-Z0-9-]+)/
                );
                const resetToken = tokenMatch ? tokenMatch[1] : "";

                // 3. Open reset password page & verify <8-char and mismatch are blocked client-side
                await page.goto(`${FRONTEND_URL}/#/update-password/${resetToken}`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector('input[name="password"]', { timeout: 15000 });

                await page.fill('input[name="password"]', "1234567");
                await page.fill('input[name="confirmPassword"]', "1234567");
                await page.getByRole("button", { name: /Reset Password/i }).click();
                await page.waitForTimeout(300);
                const shortResetAlert = await page.locator('[role="alert"]').first().innerText();
                const shortResetBlocked =
                    shortResetAlert.includes("at least 8 characters") && resetApiCalls === 0;

                await page.fill('input[name="password"]', "ResetFinal9!");
                await page.fill('input[name="confirmPassword"]', "Mismatch99!");
                await page.getByRole("button", { name: /Reset Password/i }).click();
                await page.waitForTimeout(300);
                const mismatchBlocked = resetApiCalls === 0;

                // 4. Submit valid >=8-char password -> 200 & confirmation screen
                await page.fill('input[name="password"]', "ResetFinal9!");
                await page.fill('input[name="confirmPassword"]', "ResetFinal9!");
                const [validResetResp] = await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/auth/reset-password") && !r.url().includes("-token"),
                        { timeout: 15000 }
                    ),
                    page.getByRole("button", { name: /Reset Password/i }).click(),
                ]);
                await page.waitForSelector("text=Password Reset Successfully", { timeout: 10000 });
                const successScreenShown = (await page.locator("body").innerText()).includes(
                    "Password Reset Successfully"
                );

                // 5. Single-use token verification: reload same reset URL -> reusing token returns 401
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForSelector('input[name="password"]', { timeout: 15000 });
                await page.fill('input[name="password"]', "AnotherNew9!");
                await page.fill('input[name="confirmPassword"]', "AnotherNew9!");
                const [reuseResp] = await Promise.all([
                    page.waitForResponse(
                        (r) => r.url().includes("/auth/reset-password") && !r.url().includes("-token"),
                        { timeout: 15000 }
                    ),
                    page.getByRole("button", { name: /Reset Password/i }).click(),
                ]);

                // 6. Login succeeds with the newly reset password
                const postResetLogin = await uiLogin(page, policyEmail, "ResetFinal9!");

                record(
                    "E2E-34",
                    "GAP-007 Forgot/Reset Password Policy, Single-Use Token & Post-Reset Login",
                    tokenResp.status() === 200 &&
                        Boolean(resetToken) &&
                        shortResetBlocked &&
                        mismatchBlocked &&
                        validResetResp.status() === 200 &&
                        successScreenShown &&
                        reuseResp.status() === 401 &&
                        postResetLogin === 200,
                    `tokenReq=${tokenResp.status()}, tokenCaptured=${Boolean(resetToken)}, shortBlocked=${shortResetBlocked}, mismatchBlocked=${mismatchBlocked}, reset=${validResetResp.status()}, successUI=${successScreenShown}, reuseStatus=${reuseResp.status()}, postResetLogin=${postResetLogin}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-35 (GAP-002): Pending Instructor Signup, Route Guard, Hard-Refresh Spoofing Defense & API 403
        // =========================================================================
        const pendingInstEmail = "e2e35.pending.inst@isolated.test";
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await page.goto(`${FRONTEND_URL}/#/signup`, { waitUntil: "networkidle" });
                await page.getByRole("button", { name: /^Instructor$/i }).click();
                await page.fill('input[name="firstName"]', "Aarav");
                await page.fill('input[name="lastName"]', "Applicant");
                await page.fill('input[name="email"]', pendingInstEmail);
                await page.fill('input[name="password"]', TEST_PASSWORD);
                await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);

                const [otpResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/sendotp"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Create Account/i }).click(),
                ]);
                await waitForHash(page, "/verify-email");

                const otpRes = await fetchJson(
                    `${API_BASE_URL}/__test__/otp?email=${encodeURIComponent(pendingInstEmail)}`
                );
                const otp = otpRes.data?.otp || "";
                await page.locator('form input[placeholder="-"]').first().click();
                await page.keyboard.type(otp, { delay: 30 });

                const [signupResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/signup"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Verify Email/i }).click(),
                ]);
                await waitForHash(page, "/login");

                // Verify application-received email captured in mock outbox
                const emailsRes = await fetchJson(`${API_BASE_URL}/__test__/emails`);
                const appEmailCaptured = (emailsRes.data?.emails || []).some(
                    (m) => m.to === pendingInstEmail && /Application Received/i.test(m.subject)
                );

                // Login as newly registered pending instructor
                const loginStatus = await uiLogin(page, pendingInstEmail, TEST_PASSWORD);
                await waitForHash(page, "/dashboard/my-profile");
                await page.waitForSelector('[data-testid="profile-instructor-pending-banner"]', {
                    timeout: 15000,
                });
                const profileHasPendingBanner = await page
                    .locator('[data-testid="profile-instructor-pending-banner"]')
                    .isVisible();

                // Sidebar must NOT show My Courses or Add Course for pending instructor
                const bodyText = await page.locator("body").innerText();
                const sidebarHidesCourseLinks =
                    !bodyText.includes("Add Course") && !bodyText.includes("My Courses");

                // Direct URL access to /dashboard/add-course redirects cleanly to /dashboard/instructor
                await page.goto(`${FRONTEND_URL}/#/dashboard/add-course`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/instructor");
                await page.waitForSelector('[data-testid="instructor-approval-notice"]', {
                    timeout: 15000,
                });
                const pendingNoticeShown = (
                    await page.locator('[data-testid="instructor-approval-notice"]').innerText()
                ).includes("Instructor Account Pending Approval");

                // Spoof localStorage.user to APPROVED and perform hard reload -> backend hydration restores PENDING!
                await page.evaluate(() => {
                    const stored = JSON.parse(localStorage.getItem("user") || "{}");
                    stored.approvalStatus = "APPROVED";
                    stored.approved = true;
                    localStorage.setItem("user", JSON.stringify(stored));
                });
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/profile/getUserDetails"), {
                        timeout: 15000,
                    }),
                    page.reload({ waitUntil: "domcontentloaded" }),
                ]);
                await page.waitForSelector('[data-testid="instructor-approval-notice"]', {
                    timeout: 15000,
                });
                const hardRefreshDefeatedSpoof = (
                    await page.locator('[data-testid="instructor-approval-notice"]').innerText()
                ).includes("Pending Approval");

                // Direct API call with pending JWT must return 403
                const directApiStatuses = await page.evaluate(async (apiBase) => {
                    const tok = localStorage.getItem("token");
                    const createRes = await fetch(`${apiBase}/course/createCourse`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${tok}`,
                        },
                        body: JSON.stringify({
                            courseName: "Blocked Direct Course",
                            courseDescription: "Blocked",
                            whatYouWillLearn: "None",
                            price: 100,
                            approved: true,
                            approvalStatus: "APPROVED",
                        }),
                    });
                    const dashRes = await fetch(`${apiBase}/profile/instructorDashboard`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    return { createStatus: createRes.status, dashStatus: dashRes.status };
                }, API_BASE_URL);

                record(
                    "E2E-35",
                    "GAP-002 Pending Instructor Signup, Route Guard, Hard-Refresh Spoof Defense & Direct API 403",
                    otpResp.status() === 200 &&
                        signupResp.status() === 200 &&
                        appEmailCaptured &&
                        loginStatus === 200 &&
                        profileHasPendingBanner &&
                        sidebarHidesCourseLinks &&
                        pendingNoticeShown &&
                        hardRefreshDefeatedSpoof &&
                        directApiStatuses.createStatus === 403 &&
                        directApiStatuses.dashStatus === 403,
                    `appEmail=${appEmailCaptured}, profileBanner=${profileHasPendingBanner}, sidebarHidden=${sidebarHidesCourseLinks}, notice=${pendingNoticeShown}, hardRefresh=${hardRefreshDefeatedSpoof}, api=${JSON.stringify(directApiStatuses)}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-36 (GAP-002): Admin User Management UI, KPIs, Details Modal, Mobile 375px & Approve -> Unlock
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await uiLogin(page, FIXTURES.adminEmail, TEST_PASSWORD);
                await waitForHash(page, "/dashboard/admin");
                await page.waitForSelector('[data-testid="admin-pending-instructors-banner"]', {
                    timeout: 15000,
                });

                // Navigate to User Management via callout link and await initial stats load
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/admin/users/stats"), {
                        timeout: 15000,
                    }),
                    page.locator('[data-testid="admin-pending-instructors-banner"] a').click(),
                ]);
                await waitForHash(page, "/dashboard/admin/users");
                await page.waitForSelector(`[data-testid="user-row-${pendingInstEmail}"]`, {
                    timeout: 15000,
                });

                const statsPendingCount = Number(
                    await page.locator('[data-testid="stat-pending-instructors"]').innerText()
                );

                // Search for our newly registered pending instructor
                await page.fill('input[aria-label="Search users by name or email"]', pendingInstEmail);
                await page.waitForTimeout(500);
                await page.waitForSelector(`[data-testid="user-row-${pendingInstEmail}"]`, {
                    timeout: 15000,
                });

                // Open Details modal and verify safe details
                await page
                    .locator(`button[aria-label="View details for ${pendingInstEmail}"]:visible`)
                    .first()
                    .click();
                await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
                await page.waitForSelector(`text=${pendingInstEmail}`, { timeout: 10000 });
                const detailsText = await page.locator('div[role="dialog"]').innerText();
                const detailsModalOk =
                    detailsText.includes("Aarav Applicant") &&
                    detailsText.includes(pendingInstEmail) &&
                    !detailsText.includes("$2b$");
                await page.locator('button[aria-label="Close user details"]').click();

                // Verify Mobile 375px layout on Admin User Management
                await page.setViewportSize({ width: 375, height: 812 });
                await page.waitForTimeout(300);
                const mobileOverflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > window.innerWidth
                );
                await page.setViewportSize({ width: 1280, height: 860 });

                // Approve instructor via confirmation modal
                await page
                    .locator(`button[aria-label="Approve ${pendingInstEmail}"]:visible`)
                    .first()
                    .click();
                await page.waitForSelector("text=Approve Instructor?", { timeout: 10000 });
                const [approveResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/approve"), { timeout: 15000 }),
                    page.getByRole("button", { name: /^Approve Instructor$/i }).click(),
                ]);
                await page.waitForTimeout(500);

                // Verify approval email captured in mock outbox
                const emailsRes = await fetchJson(`${API_BASE_URL}/__test__/emails`);
                const approvalEmailCaptured = (emailsRes.data?.emails || []).some(
                    (m) => m.to === pendingInstEmail && /Approved/i.test(m.subject)
                );

                // Verify user now appears under Approved Instructors tab
                await page.getByRole("tab", { name: /Approved Instructors/i }).click();
                await page.waitForSelector(`[data-testid="user-row-${pendingInstEmail}"]`, {
                    timeout: 15000,
                });
                const inApprovedTab = await page
                    .locator(`[data-testid="user-row-${pendingInstEmail}"]`)
                    .isVisible();

                // Logout Admin, login as newly approved instructor -> full dashboard & Add Course unlocked!
                await uiLogout(page);
                await uiLogin(page, pendingInstEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/add-course`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/add-course");
                await page.waitForSelector('input[name="courseTitle"]', { timeout: 15000 });
                const addCourseUnlocked = (await page.locator("body").innerText()).includes(
                    "Course Information"
                );

                record(
                    "E2E-36",
                    "GAP-002 Admin User Management UI, Details Modal, Mobile 375px & Approve -> Instructor Unlock",
                    statsPendingCount >= 2 &&
                        detailsModalOk &&
                        !mobileOverflow &&
                        approveResp.status() === 200 &&
                        approvalEmailCaptured &&
                        inApprovedTab &&
                        addCourseUnlocked,
                    `pendingBefore=${statsPendingCount}, detailsOk=${detailsModalOk}, mobileOverflow=${mobileOverflow}, approve=${approveResp.status()}, email=${approvalEmailCaptured}, approvedTab=${inApprovedTab}, unlocked=${addCourseUnlocked}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-37 (GAP-002): Admin Instructor Rejection with Reason, Rejected UX & Backend 403
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const seededPendingEmail = seeded.users.pendingInstructorEmail;
                await uiLogin(page, FIXTURES.adminEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/admin/users?tab=PENDING`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector(`[data-testid="user-row-${seededPendingEmail}"]`, {
                    timeout: 15000,
                });

                await page
                    .locator(`button[aria-label="Reject ${seededPendingEmail}"]:visible`)
                    .first()
                    .click();
                await page.waitForSelector("#reject-reason-input", { timeout: 10000 });
                await page.fill("#reject-reason-input", "Please provide teaching credentials");
                const [rejectResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/reject"), { timeout: 15000 }),
                    page.getByRole("button", { name: /Confirm Rejection/i }).click(),
                ]);
                await page.waitForTimeout(500);

                // Verify rejection email captured with reason
                const emailsRes = await fetchJson(`${API_BASE_URL}/__test__/emails`);
                const rejectEmailCaptured = (emailsRes.data?.emails || []).some(
                    (m) =>
                        m.to === seededPendingEmail &&
                        /Application Update/i.test(m.subject) &&
                        (m.html || "").includes("Please provide teaching credentials")
                );

                // Verify user appears in Rejected Instructors tab
                await page.getByRole("tab", { name: /Rejected Instructors/i }).click();
                await page.waitForSelector(`[data-testid="user-row-${seededPendingEmail}"]`, {
                    timeout: 15000,
                });
                const inRejectedTab = await page
                    .locator(`[data-testid="user-row-${seededPendingEmail}"]`)
                    .isVisible();

                // Login as rejected instructor -> sees rejection banner + reason, blocked from /add-course & API
                await uiLogout(page);
                await uiLogin(page, seededPendingEmail, TEST_PASSWORD);
                await page.waitForSelector('[data-testid="profile-instructor-rejected-banner"]', {
                    timeout: 15000,
                });
                await page.goto(`${FRONTEND_URL}/#/dashboard/add-course`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/instructor");
                await page.waitForSelector('[data-testid="instructor-approval-notice"]', {
                    timeout: 15000,
                });
                const rejectedNoticeText = await page
                    .locator('[data-testid="instructor-approval-notice"]')
                    .innerText();
                const rejectedNoticeOk =
                    rejectedNoticeText.includes("Instructor Application Not Approved") &&
                    rejectedNoticeText.includes("Please provide teaching credentials") &&
                    rejectedNoticeText.includes("Contact Support");

                const rejectedApiStatus = await page.evaluate(async (apiBase) => {
                    const tok = localStorage.getItem("token");
                    const res = await fetch(`${apiBase}/course/createCourse`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${tok}`,
                        },
                        body: JSON.stringify({
                            courseName: "Rejected Attempt",
                            courseDescription: "Blocked",
                            whatYouWillLearn: "None",
                            price: 100,
                        }),
                    });
                    return res.status;
                }, API_BASE_URL);

                record(
                    "E2E-37",
                    "GAP-002 Admin Instructor Rejection with Reason, Rejected UX & Backend 403",
                    rejectResp.status() === 200 &&
                        rejectEmailCaptured &&
                        inRejectedTab &&
                        rejectedNoticeOk &&
                        rejectedApiStatus === 403,
                    `reject=${rejectResp.status()}, email=${rejectEmailCaptured}, rejectedTab=${inRejectedTab}, noticeOk=${rejectedNoticeOk}, apiStatus=${rejectedApiStatus}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-38 (GAP-002): Admin User Management RBAC (Student & Instructor Blocked from UI & API)
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                // Student blocked from /dashboard/admin/users UI and /api/v1/admin/* APIs
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/admin/users`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/my-profile");
                const studentBlockedUi = (await page.url()).includes("/dashboard/my-profile");
                const studentApi403 = await page.evaluate(async (apiBase) => {
                    const tok = localStorage.getItem("token");
                    const r1 = await fetch(`${apiBase}/admin/users/stats`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    const r2 = await fetch(`${apiBase}/admin/users`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    return r1.status === 403 && r2.status === 403;
                }, API_BASE_URL);

                // Approved Instructor blocked from /dashboard/admin/users UI and approve API
                await uiLogout(page);
                await uiLogin(page, FIXTURES.instructorEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/admin/users`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/my-profile");
                const instructorBlockedUi = (await page.url()).includes("/dashboard/my-profile");
                const instructorApi403 = await page.evaluate(
                    async ({ apiBase, targetId }) => {
                        const tok = localStorage.getItem("token");
                        const r = await fetch(`${apiBase}/admin/instructors/${targetId}/approve`, {
                            method: "PUT",
                            headers: { Authorization: `Bearer ${tok}` },
                        });
                        return r.status === 403;
                    },
                    { apiBase: API_BASE_URL, targetId: seeded.users.pendingInstructorId }
                );

                record(
                    "E2E-38",
                    "GAP-002 Admin User Management RBAC Protection (Student & Instructor Blocked)",
                    studentBlockedUi && studentApi403 && instructorBlockedUi && instructorApi403,
                    `studentUi=${studentBlockedUi}, studentApi403=${studentApi403}, instructorUi=${instructorBlockedUi}, instructorApi403=${instructorApi403}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-39 (F-INS-11): Instructor My Courses -> Manage Students -> Roster -> Student Completes Lecture -> Updated Progress
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const targetCourseId = seeded.courses.freeCourseId;
                const targetCourseName = seeded.courses.freeCourseName;
                const trackedStudentEmail = "e2e16.student@isolated.test";

                // 1. Approved Instructor logs in and opens My Courses
                await uiLogin(page, FIXTURES.instructorEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/my-courses`, {
                    waitUntil: "networkidle",
                });
                const manageBtn = page
                    .locator(`button[aria-label="Manage Students for ${targetCourseName}"]:visible`)
                    .first();
                await manageBtn.waitFor({ state: "visible", timeout: 15000 });

                // 2. Click Manage Students -> lands on CourseStudents roster page
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/enrolled-students"), {
                        timeout: 15000,
                    }),
                    manageBtn.click(),
                ]);
                await waitForHash(page, `/dashboard/course-students/${targetCourseId}`);
                await page.waitForSelector(`[data-testid="roster-row-${trackedStudentEmail}"]`, {
                    timeout: 15000,
                });

                const rowBeforeText = await page
                    .locator(`[data-testid="roster-row-${trackedStudentEmail}"]`)
                    .innerText();
                const initialProgressOk =
                    rowBeforeText.includes("0 / 1 completed") &&
                    rowBeforeText.includes("0%") &&
                    !rowBeforeText.includes("Not recorded");

                // 3. Search filter narrows roster cleanly
                await page.fill(
                    'input[aria-label="Search enrolled students by name or email"]',
                    trackedStudentEmail
                );
                await page.waitForTimeout(500);
                await page.waitForSelector(`[data-testid="roster-row-${trackedStudentEmail}"]`, {
                    timeout: 10000,
                });
                const searchRowCount = await page.locator("tbody tr").count();
                await page.locator('button[aria-label="Clear student search"]').click();
                await page.waitForTimeout(500);

                // 4. Verify Mobile 375px layout on Roster page
                await page.setViewportSize({ width: 375, height: 812 });
                await page.waitForTimeout(300);
                const rosterMobileOverflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > window.innerWidth
                );
                await page.setViewportSize({ width: 1280, height: 860 });

                // 5. In a separate student context, complete the lecture in ViewCourse
                const { ctx: stuCtx, page: stuPage } = await newTrackedContext();
                let lectureCompleteStatus = 0;
                try {
                    await uiLogin(stuPage, trackedStudentEmail, TEST_PASSWORD);
                    await stuPage.goto(
                        `${FRONTEND_URL}/#/view-course/${targetCourseId}/section/${seeded.courses.freeCourseSectionId}/sub-section/${seeded.courses.freeCourseSubSectionId}`,
                        { waitUntil: "networkidle" }
                    );
                    await stuPage.waitForSelector("video", { timeout: 15000 });
                    await stuPage.evaluate(() => {
                        const v = document.querySelector("video");
                        if (v) v.dispatchEvent(new Event("ended"));
                    });
                    const markBtn = stuPage.getByRole("button", { name: /Mark As Completed/i });
                    await markBtn.waitFor({ state: "visible", timeout: 10000 });
                    const [progResp] = await Promise.all([
                        stuPage.waitForResponse((r) => r.url().includes("/course/updateCourseProgress"), {
                            timeout: 15000,
                        }),
                        markBtn.click(),
                    ]);
                    lectureCompleteStatus = progResp.status();
                } finally {
                    await stuCtx.close();
                }

                // 6. Instructor reloads Student Roster -> sees updated 100% (1 / 1 completed)
                await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/enrolled-students"), {
                        timeout: 15000,
                    }),
                    page.reload({ waitUntil: "domcontentloaded" }),
                ]);
                await page.waitForSelector(`[data-testid="roster-row-${trackedStudentEmail}"]`, {
                    timeout: 15000,
                });
                const rowAfterText = await page
                    .locator(`[data-testid="roster-row-${trackedStudentEmail}"]`)
                    .innerText();
                const updatedProgressOk =
                    rowAfterText.includes("1 / 1 completed") &&
                    rowAfterText.includes("100%") &&
                    rowAfterText.includes("Completed");

                record(
                    "E2E-39",
                    "F-INS-11 Instructor Student Roster, Search, Mobile 375px & Live Progress Sync",
                    initialProgressOk &&
                        searchRowCount === 1 &&
                        !rosterMobileOverflow &&
                        lectureCompleteStatus === 200 &&
                        updatedProgressOk,
                    `initialOk=${initialProgressOk}, searchCount=${searchRowCount}, mobileOverflow=${rosterMobileOverflow}, completeStatus=${lectureCompleteStatus}, updatedOk=${updatedProgressOk}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-40 (F-INS-11): Student Roster Cross-Instructor Ownership & Role/Approval Isolation
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const targetCourseId = seeded.courses.freeCourseId;

                // 1. Second Approved Instructor (not the owner) gets 403 UI error & 403 API even with spoofed instructorId
                await uiLogin(page, pendingInstEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/course-students/${targetCourseId}`, {
                    waitUntil: "networkidle",
                });
                await page.waitForSelector('[role="alert"]', { timeout: 15000 });
                const otherInstAlert = (await page.locator('[role="alert"]').first().innerText()).toLowerCase();
                const otherInstUiBlocked = otherInstAlert.includes("permission");
                const otherInstApi403 = await page.evaluate(
                    async ({ apiBase, cid, spoofOwnerId }) => {
                        const tok = localStorage.getItem("token");
                        const res = await fetch(
                            `${apiBase}/course/${cid}/enrolled-students?instructorId=${spoofOwnerId}`,
                            { headers: { Authorization: `Bearer ${tok}` } }
                        );
                        return res.status === 403;
                    },
                    {
                        apiBase: API_BASE_URL,
                        cid: targetCourseId,
                        spoofOwnerId: seeded.users.instructorId,
                    }
                );

                // 2. Student blocked from roster API (403)
                await uiLogout(page);
                await uiLogin(page, FIXTURES.studentEmail, TEST_PASSWORD);
                const studentApi403 = await page.evaluate(
                    async ({ apiBase, cid }) => {
                        const tok = localStorage.getItem("token");
                        const res = await fetch(`${apiBase}/course/${cid}/enrolled-students`, {
                            headers: { Authorization: `Bearer ${tok}` },
                        });
                        return res.status === 403;
                    },
                    { apiBase: API_BASE_URL, cid: targetCourseId }
                );

                // 3. Rejected Instructor redirected away from roster UI to /dashboard/instructor & gets 403 API
                await uiLogout(page);
                await uiLogin(page, seeded.users.pendingInstructorEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/course-students/${targetCourseId}`, {
                    waitUntil: "networkidle",
                });
                await waitForHash(page, "/dashboard/instructor");
                const rejectedUiBlocked = (await page.url()).includes("/dashboard/instructor");
                const rejectedApi403 = await page.evaluate(
                    async ({ apiBase, cid }) => {
                        const tok = localStorage.getItem("token");
                        const res = await fetch(`${apiBase}/course/${cid}/enrolled-students`, {
                            headers: { Authorization: `Bearer ${tok}` },
                        });
                        return res.status === 403;
                    },
                    { apiBase: API_BASE_URL, cid: targetCourseId }
                );

                record(
                    "E2E-40",
                    "F-INS-11 Roster Cross-Instructor Ownership, Student & Rejected Instructor Isolation",
                    otherInstUiBlocked &&
                        otherInstApi403 &&
                        studentApi403 &&
                        rejectedUiBlocked &&
                        rejectedApi403,
                    `otherInstUi=${otherInstUiBlocked}, otherInstApi403=${otherInstApi403}, studentApi403=${studentApi403}, rejectedUi=${rejectedUiBlocked}, rejectedApi403=${rejectedApi403}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-41 (SEC-003): Immediate JWT Revocation after Password Change
        // =========================================================================
        let e2e41FreshToken = null;
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const secEmail = "e2e41.security@isolated.test";
                const initialPass = "OldPassword@1234";
                const updatedPass = "NewPassword@5678";

                // 1. Create a dedicated user via API
                await fetchJson(`${API_BASE_URL}/auth/sendotp`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: secEmail }),
                });
                const otpRes = await fetchJson(
                    `${API_BASE_URL}/__test__/otp?email=${encodeURIComponent(secEmail)}`
                );
                const otp = otpRes.data?.otp || "";
                await fetchJson(`${API_BASE_URL}/auth/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        firstName: "Sec",
                        lastName: "Tester",
                        email: secEmail,
                        password: initialPass,
                        confirmPassword: initialPass,
                        accountType: "Student",
                        otp,
                    }),
                });

                // 2. UI Login and capture Token A
                await uiLogin(page, secEmail, initialPass);
                await waitForHash(page, "/dashboard/my-profile");
                const tokenA = await page.evaluate(() => localStorage.getItem("token"));

                // 3. Verify Token A is initially valid
                const initialCheck = await page.evaluate(async ({ apiBase, tok }) => {
                    const res = await fetch(`${apiBase}/profile/getUserDetails`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    return res.status;
                }, { apiBase: API_BASE_URL, tok: tokenA });
                const tokenAInitiallyValid = initialCheck === 200;

                // 4. Navigate to Settings and update password
                await page.goto(`${FRONTEND_URL}/#/dashboard/settings`, { waitUntil: "networkidle" });
                await page.fill("#oldPassword", initialPass);
                await page.fill("#newPassword", updatedPass);
                await page.fill("#confirmNewPassword", updatedPass);
                const [pwResp] = await Promise.all([
                    page.waitForResponse((r) => r.url().includes("/auth/changepassword"), {
                        timeout: 15000,
                    }),
                    page.getByRole("button", { name: /^Update$/i }).click(),
                ]);
                const pwChangeOk = pwResp.status() === 200;
                await waitForHash(page, "/dashboard/my-profile");

                // 5. SEC-003: Token A MUST be immediately revoked by the backend (401 TOKEN_REVOKED)
                const staleTokenCheck = await page.evaluate(async ({ apiBase, tok }) => {
                    const res = await fetch(`${apiBase}/profile/getUserDetails`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    const json = await res.json();
                    return { status: res.status, code: json?.code };
                }, { apiBase: API_BASE_URL, tok: tokenA });

                const staleTokenRevoked =
                    staleTokenCheck.status === 401 && staleTokenCheck.code === "TOKEN_REVOKED";

                // 6. UI Logout and login with the new password
                await uiLogout(page);
                const newLoginStatus = await uiLogin(page, secEmail, updatedPass);
                await waitForHash(page, "/dashboard/my-profile");
                const tokenB = await page.evaluate(() => localStorage.getItem("token"));
                e2e41FreshToken = tokenB;

                // 7. Token B is valid
                const freshCheck = await page.evaluate(async ({ apiBase, tok }) => {
                    const res = await fetch(`${apiBase}/profile/getUserDetails`, {
                        headers: { Authorization: `Bearer ${tok}` },
                    });
                    return res.status;
                }, { apiBase: API_BASE_URL, tok: tokenB });
                const tokenBValid = freshCheck === 200;

                record(
                    "E2E-41",
                    "SEC-003 Immediate JWT Revocation after Password Change (Stale Token 401 TOKEN_REVOKED, Re-login 200)",
                    tokenAInitiallyValid && pwChangeOk && staleTokenRevoked && newLoginStatus === 200 && tokenBValid,
                    `tokenAValid=${tokenAInitiallyValid}, pwChange=${pwChangeOk}, staleRevoked=${staleTokenRevoked}, reLogin=${newLoginStatus}, tokenBValid=${tokenBValid}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-42 (SEC-001, SEC-004, SEC-006): Review Email Privacy, Body JWT Rejection & CORS
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                // Navigate to frontend origin so evaluate runs within the approved origin
                await page.goto(`${FRONTEND_URL}/#/`, { waitUntil: "networkidle" });

                // 1. SEC-004: Public reviews endpoint MUST NOT expose student email
                const reviewsCheck = await page.evaluate(async (apiBase) => {
                    const res = await fetch(`${apiBase}/course/getReviews`);
                    const json = await res.json();
                    const reviews = json.data || [];
                    const emailExposed = reviews.some((r) => r.user && r.user.email);
                    return {
                        status: res.status,
                        count: reviews.length,
                        emailExposed,
                    };
                }, API_BASE_URL);

                const reviewEmailProtected = reviewsCheck.status === 200 && !reviewsCheck.emailExposed;

                // 2. SEC-006: Passing token ONLY in request body MUST be rejected with 401
                const bodyTokenCheck = await page.evaluate(async ({ apiBase, tok }) => {
                    const res = await fetch(`${apiBase}/profile/updateProfile`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            token: tok,
                            gender: "Other",
                            contactNumber: "9876543210",
                        }),
                    });
                    const json = await res.json();
                    return {
                        status: res.status,
                        message: json.message,
                    };
                }, { apiBase: API_BASE_URL, tok: e2e41FreshToken });

                const bodyTokenRejected =
                    bodyTokenCheck.status === 401 && /token is missing/i.test(bodyTokenCheck.message);

                record(
                    "E2E-42",
                    "SEC-004 Student Review Privacy (No Email) & SEC-006 Request Body JWT Rejection",
                    reviewEmailProtected && bodyTokenRejected,
                    `reviewsStatus=${reviewsCheck.status}, emailExposed=${reviewsCheck.emailExposed}, bodyTokenStatus=${bodyTokenCheck.status}, msg="${bodyTokenCheck.message}"`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-43: Asynchronous Webhook Reconciliation After Browser Disconnect / Close
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const studentEmail = `e2e43.student.${Date.now()}@isolated.test`;
                await createTestStudent(studentEmail, TEST_PASSWORD, "Async", "Student");

                // Log in via API to get student token
                const loginRes = await fetchJson(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: studentEmail, password: TEST_PASSWORD }),
                });
                const token = loginRes.data?.token;

                // Student captures order for purchasable course
                const captureRes = await fetchJson(`${API_BASE_URL}/payment/capturePayment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ courses: [seeded.courses.purchasableCourseId] }),
                });
                const rzpOrderId = captureRes.data?.message?.id;

                // Browser closes / disconnects: NO verifyPayment callback is ever called!
                // Webhook order.paid arrives asynchronously from Razorpay
                const eventId = `evt_e2e43_${Date.now()}`;
                const paymentId = `pay_e2e43_${Date.now()}`;
                const payload = {
                    entity: "event",
                    account_id: "acc_test",
                    event: "order.paid",
                    contains: ["payment", "order"],
                    payload: {
                        payment: {
                            entity: {
                                id: paymentId,
                                entity: "payment",
                                amount: 99900,
                                currency: "INR",
                                status: "captured",
                                order_id: rzpOrderId,
                            },
                        },
                        order: {
                            entity: {
                                id: rzpOrderId,
                                entity: "order",
                                amount: 99900,
                                currency: "INR",
                                status: "paid",
                            },
                        },
                    },
                    created_at: Math.floor(Date.now() / 1000),
                };

                const { rawBody, signature } = signWebhookBody(payload);
                const webhookRes = await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": signature,
                        "x-razorpay-event-id": eventId,
                    },
                    body: rawBody,
                });
                const webhookIngested = webhookRes.status === 200;

                // Wait 1.5 seconds for background worker to process event
                await new Promise((r) => setTimeout(r, 1500));

                // Student opens browser, logs in via UI
                await uiLogin(page, studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/enrolled-courses`, { waitUntil: "networkidle" });
                await page.waitForSelector(`text=${seeded.courses.purchasableCourseName}`, { timeout: 15000 });

                // Course must appear in enrolled courses list
                const enrolledBody = await page.locator("body").innerText();
                const courseVisibleInEnrolled = enrolledBody.includes(seeded.courses.purchasableCourseName);

                // Student can navigate to course view
                await page.goto(
                    `${FRONTEND_URL}/#/courses/${seeded.courses.purchasableCourseId}`,
                    { waitUntil: "networkidle" }
                );
                await page.waitForTimeout(600);
                const detailsText = await page.locator("body").innerText();
                const showsGoToCourse = /Go To Course/i.test(detailsText);

                record(
                    "E2E-43",
                    "Async Webhook Reconciliation After Browser Disconnect / Close (Course Enrolled & Accessible)",
                    webhookIngested && courseVisibleInEnrolled && showsGoToCourse,
                    `webhookStatus=${webhookRes.status}, enrolledVisible=${courseVisibleInEnrolled}, showsGoToCourse=${showsGoToCourse}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-44: Student Browser Closes Immediately During Checkout Modal
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const studentEmail = `e2e44.student.${Date.now()}@isolated.test`;
                await createTestStudent(studentEmail, TEST_PASSWORD, "Modal", "Closer");

                let capturedOrderId = null;
                // Expose function so modal interceptor notifies us of order creation
                await page.exposeFunction("__onRzpOrderCaptured", (orderId) => {
                    capturedOrderId = orderId;
                });

                // Mock checkout script to record order_id; tab closes abruptly before any callback
                await page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) => {
                    await route.fulfill({
                        status: 200,
                        contentType: "application/javascript",
                        body: `
                            window.Razorpay = function(options) {
                                window.__onRzpOrderCaptured(options.order_id);
                                this.open = function() {
                                    // Modal opened; tab closes abruptly before callback
                                };
                            };
                        `,
                    });
                });

                await uiLogin(page, studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/courses/${seeded.courses.purchasableCourseId}`, {
                    waitUntil: "networkidle",
                });
                const buyBtn = page.getByRole("button", { name: /Buy Now/i });
                await buyBtn.waitFor({ state: "visible", timeout: 15000 });
                await buyBtn.click();
                await page.waitForTimeout(1500);

                // Simulate abrupt browser crash by closing page
                await page.close();

                // Payment was captured on gateway -> gateway sends payment.captured webhook
                const eventId = `evt_e2e44_${Date.now()}`;
                const paymentId = `pay_e2e44_${Date.now()}`;
                const payload = {
                    entity: "event",
                    account_id: "acc_test",
                    event: "payment.captured",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: paymentId,
                                entity: "payment",
                                amount: 99900,
                                currency: "INR",
                                status: "captured",
                                order_id: capturedOrderId,
                            },
                        },
                    },
                    created_at: Math.floor(Date.now() / 1000),
                };

                const { rawBody, signature } = signWebhookBody(payload);
                const webhookRes = await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": signature,
                        "x-razorpay-event-id": eventId,
                    },
                    body: rawBody,
                });

                // Wait for worker
                await new Promise((r) => setTimeout(r, 2000));

                // Student re-opens browser, visits enrolled courses
                const newPage = await ctx.newPage();
                await newPage.goto(`${FRONTEND_URL}/#/dashboard/enrolled-courses`, { waitUntil: "networkidle" });
                await newPage.waitForSelector(`text=${seeded.courses.purchasableCourseName}`, { timeout: 15000 });
                const enrolledText = await newPage.locator("body").innerText();
                const courseVisible = enrolledText.includes(seeded.courses.purchasableCourseName);

                record(
                    "E2E-44",
                    "Student Browser Crash During Checkout Modal -> Webhook Worker Finalization",
                    Boolean(capturedOrderId) && webhookRes.status === 200 && courseVisible,
                    `capturedOrderId=${capturedOrderId}, webhookStatus=${webhookRes.status}, courseVisible=${courseVisible}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-45: Race Condition: Concurrent Webhook Delivery & Frontend Verification
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const studentEmail = `e2e45.student.${Date.now()}@isolated.test`;
                await createTestStudent(studentEmail, TEST_PASSWORD, "Race", "Condition");

                const loginRes = await fetchJson(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: studentEmail, password: TEST_PASSWORD }),
                });
                const token = loginRes.data?.token;

                // Capture order
                const captureRes = await fetchJson(`${API_BASE_URL}/payment/capturePayment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ courses: [seeded.courses.purchasableCourseId] }),
                });
                const rzpOrderId = captureRes.data?.message?.id;
                const sharedPaymentId = `pay_race_${Date.now()}`;

                // Prepare client verify payload
                const clientSig = crypto
                    .createHmac("sha256", TEST_RAZORPAY_SECRET)
                    .update(`${rzpOrderId}|${sharedPaymentId}`)
                    .digest("hex");

                // Prepare webhook payload
                const eventId = `evt_race_${Date.now()}`;
                const payload = {
                    entity: "event",
                    account_id: "acc_test",
                    event: "order.paid",
                    contains: ["payment", "order"],
                    payload: {
                        payment: {
                            entity: {
                                id: sharedPaymentId,
                                amount: 99900,
                                currency: "INR",
                                status: "captured",
                                order_id: rzpOrderId,
                            },
                        },
                        order: {
                            entity: {
                                id: rzpOrderId,
                                amount: 99900,
                                currency: "INR",
                                status: "paid",
                            },
                        },
                    },
                };
                const { rawBody, signature } = signWebhookBody(payload);

                // Fire BOTH simultaneously
                const [clientVerifyRes, webhookRes] = await Promise.all([
                    fetchJson(`${API_BASE_URL}/payment/verifyPayment`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            razorpay_order_id: rzpOrderId,
                            razorpay_payment_id: sharedPaymentId,
                            razorpay_signature: clientSig,
                            courses: [seeded.courses.purchasableCourseId],
                        }),
                    }),
                    fetchJson(`${API_BASE_URL}/payment/webhook`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Razorpay-Signature": signature,
                            "x-razorpay-event-id": eventId,
                        },
                        body: rawBody,
                    }),
                ]);

                // Wait 1 second for any background tasks to settle
                await new Promise((r) => setTimeout(r, 1000));

                // Student logs in via UI and checks Enrolled Courses
                await uiLogin(page, studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/enrolled-courses`, { waitUntil: "networkidle" });
                await page.waitForTimeout(800);

                // Verify course appears and only once
                const courseCards = await page.locator(`text=${seeded.courses.purchasableCourseName}`).count();

                record(
                    "E2E-45",
                    "Race Condition: Concurrent Webhook & Client verifyPayment (Zero Duplicates)",
                    clientVerifyRes.status === 200 && webhookRes.status === 200 && courseCards === 1,
                    `clientStatus=${clientVerifyRes.status}, webhookStatus=${webhookRes.status}, cardCount=${courseCards}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-46: Webhook Delivery Idempotency Across Repeated Retries
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const studentEmail = `e2e46.student.${Date.now()}@isolated.test`;
                await createTestStudent(studentEmail, TEST_PASSWORD, "Retry", "Idempotent");

                const loginRes = await fetchJson(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: studentEmail, password: TEST_PASSWORD }),
                });
                const token = loginRes.data?.token;

                const captureRes = await fetchJson(`${API_BASE_URL}/payment/capturePayment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ courses: [seeded.courses.purchasableCourseId] }),
                });
                const rzpOrderId = captureRes.data?.message?.id;

                const sharedEventId = `evt_retry_${Date.now()}`;
                const sharedPaymentId = `pay_retry_${Date.now()}`;
                const payload = {
                    entity: "event",
                    account_id: "acc_test",
                    event: "payment.captured",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: sharedPaymentId,
                                amount: 99900,
                                currency: "INR",
                                status: "captured",
                                order_id: rzpOrderId,
                            },
                        },
                    },
                };
                const { rawBody, signature } = signWebhookBody(payload);

                // Send 3 duplicate deliveries
                const sendDelivery = () =>
                    fetchJson(`${API_BASE_URL}/payment/webhook`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Razorpay-Signature": signature,
                            "x-razorpay-event-id": sharedEventId,
                        },
                        body: rawBody,
                    });

                const d1 = await sendDelivery();
                const d2 = await sendDelivery();
                const d3 = await sendDelivery();

                const d1Ok = d1.status === 200 && d1.data?.success === true;
                const d2Dup = d2.status === 200 && d2.data?.duplicate === true;
                const d3Dup = d3.status === 200 && d3.data?.duplicate === true;

                // Wait for worker
                await new Promise((r) => setTimeout(r, 1200));

                await uiLogin(page, studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/enrolled-courses`, { waitUntil: "networkidle" });
                await page.waitForTimeout(800);
                const courseCards = await page.locator(`text=${seeded.courses.purchasableCourseName}`).count();

                record(
                    "E2E-46",
                    "Webhook Delivery Idempotency Across Repeated Retries (Acknowledge Duplicate = True)",
                    d1Ok && d2Dup && d3Dup && courseCards === 1,
                    `d1=${d1.status}, d2Dup=${d2.data?.duplicate}, d3Dup=${d3.data?.duplicate}, cardCount=${courseCards}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-47: Tampered Webhook Signature & Mismatched Amount Rejection
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const studentEmail = `e2e47.student.${Date.now()}@isolated.test`;
                await createTestStudent(studentEmail, TEST_PASSWORD, "Tamper", "Guard");

                const loginRes = await fetchJson(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: studentEmail, password: TEST_PASSWORD }),
                });
                const token = loginRes.data?.token;

                const captureRes = await fetchJson(`${API_BASE_URL}/payment/capturePayment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ courses: [seeded.courses.purchasableCourseId] }),
                });
                const rzpOrderId = captureRes.data?.message?.id;

                // 1. Invalid signature rejected (400)
                const badPayload = JSON.stringify({
                    entity: "event",
                    event: "payment.captured",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: `pay_bad_${Date.now()}`,
                                amount: 99900,
                                currency: "INR",
                                status: "captured",
                                order_id: rzpOrderId,
                            },
                        },
                    },
                });

                const badSigRes = await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
                        "x-razorpay-event-id": `evt_bad_${Date.now()}`,
                    },
                    body: badPayload,
                });
                const badSigRejected = badSigRes.status === 400;

                // 2. Amount mismatch (underpayment: 100 subunits instead of 99900)
                const mismatchEventId = `evt_underpay_${Date.now()}`;
                const mismatchPayload = {
                    entity: "event",
                    event: "payment.captured",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: `pay_underpay_${Date.now()}`,
                                amount: 100, // Underpayment!
                                currency: "INR",
                                status: "captured",
                                order_id: rzpOrderId,
                            },
                        },
                    },
                };
                const { rawBody: underBody, signature: underSig } = signWebhookBody(mismatchPayload);
                const underpayRes = await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": underSig,
                        "x-razorpay-event-id": mismatchEventId,
                    },
                    body: underBody,
                });
                const underpayIngested = underpayRes.status === 200;

                // Wait 1.5 seconds for worker
                await new Promise((r) => setTimeout(r, 1500));

                // Student logs in via UI: course must NOT be enrolled; Buy Now must still be visible
                await uiLogin(page, studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/courses/${seeded.courses.purchasableCourseId}`, {
                    waitUntil: "networkidle",
                });
                await page.waitForTimeout(800);
                const coursePageText = await page.locator("body").innerText();
                const buyNowStillVisible = coursePageText.includes("Buy Now");
                const goToCourseNotPresent = !coursePageText.includes("Go to Course");

                record(
                    "E2E-47",
                    "Tampered Webhook Signature (400) & Underpayment Amount Mismatch (Access Denied)",
                    badSigRejected && underpayIngested && buyNowStillVisible && goToCourseNotPresent,
                    `badSigStatus=${badSigRes.status}, underpayStatus=${underpayRes.status}, buyNowVisible=${buyNowStillVisible}, noGoToCourse=${goToCourseNotPresent}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // E2E-48: Out-of-Order Delivery & State Protection (Never Downgrade PAID Order)
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                const studentEmail = `e2e48.student.${Date.now()}@isolated.test`;
                await createTestStudent(studentEmail, TEST_PASSWORD, "Resilient", "State");

                const loginRes = await fetchJson(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: studentEmail, password: TEST_PASSWORD }),
                });
                const token = loginRes.data?.token;

                const captureRes = await fetchJson(`${API_BASE_URL}/payment/capturePayment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ courses: [seeded.courses.purchasableCourseId] }),
                });
                const rzpOrderId = captureRes.data?.message?.id;

                // 1. payment.failed arrives first
                const failEventId = `evt_fail1_${Date.now()}`;
                const failPayload = {
                    entity: "event",
                    event: "payment.failed",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: `pay_fail_${Date.now()}`,
                                amount: 99900,
                                currency: "INR",
                                status: "failed",
                                order_id: rzpOrderId,
                                error_description: "Card declined by bank",
                            },
                        },
                    },
                };
                const { rawBody: failBody, signature: failSig } = signWebhookBody(failPayload);
                await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": failSig,
                        "x-razorpay-event-id": failEventId,
                    },
                    body: failBody,
                });
                await new Promise((r) => setTimeout(r, 1000));

                // 2. Later, payment.captured arrives for same order
                const succEventId = `evt_succ_${Date.now()}`;
                const succPaymentId = `pay_succ_${Date.now()}`;
                const succPayload = {
                    entity: "event",
                    event: "payment.captured",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: succPaymentId,
                                amount: 99900,
                                currency: "INR",
                                status: "captured",
                                order_id: rzpOrderId,
                            },
                        },
                    },
                };
                const { rawBody: succBody, signature: succSig } = signWebhookBody(succPayload);
                await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": succSig,
                        "x-razorpay-event-id": succEventId,
                    },
                    body: succBody,
                });
                await new Promise((r) => setTimeout(r, 1200));

                // 3. Out-of-order / delayed payment.failed arrives AFTER order is PAID
                const lateFailEventId = `evt_latefail_${Date.now()}`;
                const lateFailPayload = {
                    entity: "event",
                    event: "payment.failed",
                    contains: ["payment"],
                    payload: {
                        payment: {
                            entity: {
                                id: `pay_late_fail_${Date.now()}`,
                                amount: 99900,
                                currency: "INR",
                                status: "failed",
                                order_id: rzpOrderId,
                                error_description: "Delayed notification from previous decline",
                            },
                        },
                    },
                };
                const { rawBody: lateBody, signature: lateSig } = signWebhookBody(lateFailPayload);
                const lateFailRes = await fetchJson(`${API_BASE_URL}/payment/webhook`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Razorpay-Signature": lateSig,
                        "x-razorpay-event-id": lateFailEventId,
                    },
                    body: lateBody,
                });
                await new Promise((r) => setTimeout(r, 1200));

                // Student logs in via UI: Order must still be PAID, enrollment intact
                await uiLogin(page, studentEmail, TEST_PASSWORD);
                await page.goto(`${FRONTEND_URL}/#/dashboard/enrolled-courses`, { waitUntil: "networkidle" });
                await page.waitForTimeout(800);
                const enrolledText = await page.locator("body").innerText();
                const courseStillEnrolled = enrolledText.includes(seeded.courses.purchasableCourseName);

                record(
                    "E2E-48",
                    "Out-of-Order Recovery (payment.failed -> payment.captured) & Immunity to Late payment.failed",
                    lateFailRes.status === 200 && courseStillEnrolled,
                    `lateFailStatus=${lateFailRes.status}, courseStillEnrolled=${courseStillEnrolled}`
                );
            } finally {
                await ctx.close();
            }
        }

        // =========================================================================
        // Regression Checks against Isolated Environment (Footer, 404, 401 Interceptor, Mobile)
        // =========================================================================
        {
            const { ctx, page } = await newTrackedContext();
            try {
                await page.goto(`${FRONTEND_URL}/#/`, { waitUntil: "domcontentloaded" });
                await page.waitForTimeout(1000);
                const footerHrefs = await page.locator("footer a").evaluateAll((els) =>
                    els.map((a) => a.getAttribute("href")).filter((h) => h && !h.startsWith("http"))
                );
                const uniqueHrefs = [...new Set(footerHrefs)];
                const broken = [];
                for (const href of uniqueHrefs) {
                    await page.goto(`${FRONTEND_URL}/${href}`, { waitUntil: "domcontentloaded" });
                    await page.waitForTimeout(400);
                    const text = (await page.locator("body").innerText()).toLowerCase();
                    if (text.includes("upside down") || text.includes("category not found")) {
                        broken.push(href);
                    }
                }
                record(
                    "REG-01",
                    "Footer Internal Links Regression (Isolated Env)",
                    broken.length === 0 && uniqueHrefs.length >= 5,
                    `checked=${uniqueHrefs.length}, broken=${JSON.stringify(broken)}`
                );

                // Error page direct landing
                const errPage = await ctx.newPage();
                await errPage.goto(`${FRONTEND_URL}/#/nonexistent-cycle4-route`, { waitUntil: "domcontentloaded" });
                await errPage.waitForTimeout(500);
                const overflow = await errPage.evaluate(() => getComputedStyle(document.body).overflow);
                await errPage.locator('a[aria-label="Go to right side up"]').click({ force: true });
                await errPage.waitForTimeout(700);
                const homeOk = (await errPage.locator("body").innerText()).includes("Empower Your Future");
                await errPage.close();
                record(
                    "REG-02",
                    "Error Page Direct Landing Regression",
                    overflow !== "hidden" && homeOk,
                    `bodyOverflow=${overflow}, ctaNavigatedHome=${homeOk}`
                );

                // Mobile 375px check
                await page.setViewportSize({ width: 375, height: 812 });
                await page.goto(`${FRONTEND_URL}/#/`, { waitUntil: "domcontentloaded" });
                await page.waitForTimeout(500);
                const horizOverflow = await page.evaluate(
                    () => document.documentElement.scrollWidth > window.innerWidth
                );
                record(
                    "REG-03",
                    "Mobile 375px Layout Regression",
                    !horizOverflow,
                    `horizontalOverflow=${horizOverflow}`
                );
            } finally {
                await ctx.close();
            }
        }
    } finally {
        await browser.close();
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    }

    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;

    console.log("\n=== ISOLATED AUTHENTICATED E2E SUMMARY ===");
    console.log("PAGE ERRORS:", pageErrors.length, pageErrors);
    console.log("SWIPER WARNINGS:", swiperWarnings.length);
    console.log(`TOTAL: ${results.length} PASSED: ${passed} FAILED: ${failed}`);

    if (failed > 0 || pageErrors.length > 0) {
        process.exit(1);
    }
}

runAuthenticatedE2E().catch((err) => {
    console.error("ISOLATED E2E FATAL ERROR:", err);
    process.exit(1);
});
