const { isTestMode } = require("./testSafety");

/**
 * Normalizes an origin string by trimming whitespace, stripping trailing slashes,
 * and normalizing protocol/hostname via URL parsing when possible.
 *
 * @param {string} origin
 * @returns {string} Normalized origin (e.g. "https://studynotion.com")
 */
function normalizeOrigin(origin) {
    if (!origin || typeof origin !== "string") {
        return "";
    }
    const trimmed = origin.trim();
    try {
        const url = new URL(trimmed);
        return url.origin.toLowerCase();
    } catch {
        return trimmed.replace(/\/+$/, "").toLowerCase();
    }
}

/**
 * Returns the authoritative Set of allowed origins based on environment configuration.
 *
 * Rules:
 * 1. Explicitly configured origins in ALLOWED_ORIGINS (comma-separated) are always included.
 * 2. Explicitly configured FRONTEND_URL is always included.
 * 3. In development or test mode, standard local development origins are included.
 * 4. In production mode, arbitrary local or wildcard domains are strictly disallowed.
 *
 * @returns {Set<string>} Set of normalized allowed origins
 */
function getAllowedOrigins() {
    const origins = new Set();

    // 1. Explicit comma-separated origins from environment
    if (process.env.ALLOWED_ORIGINS) {
        process.env.ALLOWED_ORIGINS.split(",")
            .map((o) => normalizeOrigin(o))
            .filter(Boolean)
            .forEach((o) => origins.add(o));
    }

    // 2. Explicit frontend URL from environment
    if (process.env.FRONTEND_URL) {
        const normalized = normalizeOrigin(process.env.FRONTEND_URL);
        if (normalized) {
            origins.add(normalized);
        }
    }

    // 3. Local development and testing origins (active in non-production or test mode)
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd || isTestMode()) {
        origins.add("http://localhost:3000");
        origins.add("http://127.0.0.1:3000");
        origins.add("http://localhost:3001");
        origins.add("http://127.0.0.1:3001");
    }

    return origins;
}

/**
 * Validates whether an incoming request origin is permitted.
 *
 * Requests without an Origin header (such as server-to-server calls, curl,
 * Postman, and mobile clients) are permitted. Browser requests with an
 * Origin header must exactly match one of the explicitly allowed origins.
 *
 * Wildcards such as "*.vercel.app" and substring/lookalike matches are rejected.
 *
 * @param {string|undefined} origin
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin) {
    if (!origin) {
        // Allow requests without Origin header (server-to-server, curl, non-browser)
        return true;
    }
    const normalized = normalizeOrigin(origin);
    const allowed = getAllowedOrigins();
    return allowed.has(normalized);
}

/**
 * Creates the Express CORS middleware configuration object.
 *
 * @returns {import("cors").CorsOptions}
 */
function createCorsOptions() {
    return {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                const error = new Error(`CORS blocked for origin: ${origin}`);
                error.status = 403;
                callback(error);
            }
        },
        credentials: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        optionsSuccessStatus: 204,
    };
}

module.exports = {
    normalizeOrigin,
    getAllowedOrigins,
    isOriginAllowed,
    createCorsOptions,
};
