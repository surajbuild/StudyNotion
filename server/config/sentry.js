const Sentry = require("@sentry/node");
const { isTestMode } = require("./testSafety");

let sentryInitialized = false;

function initSentry(app) {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn || isTestMode()) {
        return { enabled: false, message: "Sentry disabled in test mode or SENTRY_DSN not configured" };
    }

    try {
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || "development",
            release: process.env.RELEASE_VERSION || "studynotion@1.0.0",
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
            beforeSend(event) {
                // Sanitize and redact sensitive data before sending
                if (event.request) {
                    if (event.request.headers) {
                        delete event.request.headers["authorization"];
                        delete event.request.headers["cookie"];
                    }
                    if (event.request.data && typeof event.request.data === "object") {
                        delete event.request.data.password;
                        delete event.request.data.confirmPassword;
                        delete event.request.data.token;
                        delete event.request.data.otp;
                    }
                }
                return event;
            },
        });

        sentryInitialized = true;
        console.log("[Sentry] Backend SDK initialized successfully");
        return { enabled: true, initialized: true };
    } catch (err) {
        console.warn("[Sentry] Failed to initialize Sentry:", err?.message || err);
        return { enabled: false, error: err.message };
    }
}

function captureException(err, context = {}) {
    if (sentryInitialized) {
        return Sentry.captureException(err, { extra: context });
    }
    return null;
}

function isSentryEnabled() {
    return sentryInitialized;
}

module.exports = {
    initSentry,
    captureException,
    isSentryEnabled,
    Sentry,
};
