import * as Sentry from "@sentry/react";

let sentryInitialized = false;

export function initFrontendSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;

  if (!dsn || process.env.NODE_ENV === "test") {
    return { enabled: false };
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      release: process.env.REACT_APP_VERSION || "studynotion-frontend@1.0.0",
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // Redact any auth tokens or email data in breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => {
            if (b.data && typeof b.data === "object") {
              delete b.data.password;
              delete b.data.token;
            }
            return b;
          });
        }
        return event;
      },
    });

    sentryInitialized = true;
    return { enabled: true };
  } catch (err) {
    console.warn("[Sentry] Frontend init error:", err);
    return { enabled: false, error: err.message };
  }
}

export function captureFrontendException(error, context = {}) {
  if (sentryInitialized) {
    Sentry.captureException(error, { extra: context });
  }
}

export { Sentry };
