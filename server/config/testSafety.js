const ALLOWED_TEST_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
    "mongo-test",
    "mongodb-test",
    "studynotion-mongo-test",
]);

const FORBIDDEN_DB_NAMES = new Set([
    "",
    "admin",
    "local",
    "config",
    "prod",
    "production",
    "studynotion",
    "studynotion_prod",
    "studynotion_production",
]);

class TestSafetyError extends Error {
    constructor(message) {
        super(`[TEST SAFETY VIOLATION] ${message}`);
        this.name = "TestSafetyError";
    }
}

/**
 * Returns true only when test mode has been explicitly enabled via environment variables.
 */
const isTestMode = (env = process.env) => {
    return env?.NODE_ENV === "test" || env?.STUDYNOTION_TEST_MODE === "true";
};

/**
 * Returns true when external third-party services (SMTP, Cloudinary, Razorpay)
 * should use deterministic test stubs instead of live network endpoints.
 */
const isExternalMockMode = (env = process.env) => {
    return isTestMode(env) && env?.TEST_MOCK_EXTERNAL_SERVICES === "true";
};

/**
 * Masks any embedded username/password in a MongoDB connection URI before logging.
 */
const sanitizeMongoUri = (uri) => {
    if (!uri || typeof uri !== "string") return "<empty>";
    return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^/@]+@)/i, "$1***@");
};

/**
 * Extracts protocol, host list, and database name from a MongoDB URI.
 */
const parseMongoTarget = (uri) => {
    if (!uri || typeof uri !== "string") {
        throw new TestSafetyError("MongoDB URI is missing or invalid.");
    }

    const trimmed = uri.trim();
    const match = trimmed.match(/^(mongodb(?:\+srv)?):\/\/(?:[^/@]+@)?([^/?]+)(?:\/([^?]*))?/i);
    if (!match) {
        throw new TestSafetyError(`Malformed MongoDB URI: ${sanitizeMongoUri(trimmed)}`);
    }

    const protocol = match[1].toLowerCase();
    const rawHosts = match[2].toLowerCase();
    const hosts = rawHosts.split(",").map((entry) => {
        // Strip port from IPv4/hostname or bracketed IPv6
        if (entry.startsWith("[")) {
            const endBracket = entry.indexOf("]");
            return endBracket !== -1 ? entry.slice(0, endBracket + 1) : entry;
        }
        return entry.split(":")[0];
    });
    const dbName = (match[3] || "").trim();

    return { protocol, hosts, dbName, sanitizedUri: sanitizeMongoUri(trimmed) };
};

/**
 * Validates that a connection string is strictly isolated and safe for automated testing.
 * Rejects production/Atlas URIs, missing test flags, non-local hosts, and non-test DB names.
 */
const assertSafeTestDatabaseUri = (testUri, env = process.env) => {
    if (!isTestMode(env)) {
        throw new TestSafetyError(
            "Test database access requires explicit test mode (NODE_ENV=test or STUDYNOTION_TEST_MODE=true)."
        );
    }

    if (!testUri || typeof testUri !== "string" || !testUri.trim()) {
        throw new TestSafetyError(
            "MONGODB_TEST_URL must be explicitly set in test mode. Refusing to fall back to production MONGODB_URL."
        );
    }

    const parsed = parseMongoTarget(testUri);

    if (parsed.protocol === "mongodb+srv") {
        throw new TestSafetyError(
            `Refusing SRV/cloud MongoDB URI in test mode: ${parsed.sanitizedUri}`
        );
    }

    for (const host of parsed.hosts) {
        if (host.endsWith(".mongodb.net") || host.includes("atlas")) {
            throw new TestSafetyError(
                `Refusing MongoDB Atlas host in test mode: ${parsed.sanitizedUri}`
            );
        }
        if (!ALLOWED_TEST_HOSTS.has(host)) {
            throw new TestSafetyError(
                `Host "${host}" is not an allowed isolated test host (${[...ALLOWED_TEST_HOSTS].join(", ")}).`
            );
        }
    }

    const dbLower = parsed.dbName.toLowerCase();
    if (FORBIDDEN_DB_NAMES.has(dbLower) || !dbLower.includes("test")) {
        throw new TestSafetyError(
            `Test database name "${parsed.dbName || "<none>"}" must explicitly contain "test" and cannot be a system or production database.`
        );
    }

    // Reject if MONGODB_TEST_URL matches production MONGODB_URL or points to the same target
    if (env?.MONGODB_URL && typeof env.MONGODB_URL === "string" && env.MONGODB_URL.trim()) {
        const normalizedTest = testUri.trim();
        const normalizedProd = env.MONGODB_URL.trim();
        if (normalizedTest === normalizedProd) {
            throw new TestSafetyError(
                "MONGODB_TEST_URL cannot match production MONGODB_URL."
            );
        }
        try {
            const prodParsed = parseMongoTarget(normalizedProd);
            const sameHost = parsed.hosts.some((h) => prodParsed.hosts.includes(h));
            if (sameHost && prodParsed.dbName && prodParsed.dbName.toLowerCase() === dbLower) {
                throw new TestSafetyError(
                    `MONGODB_TEST_URL points to the same host and database ("${parsed.dbName}") as MONGODB_URL.`
                );
            }
        } catch (err) {
            if (err instanceof TestSafetyError) throw err;
        }
    }

    return {
        safe: true,
        dbName: parsed.dbName,
        hosts: parsed.hosts,
        sanitizedUri: parsed.sanitizedUri,
    };
};

/**
 * Validates an active Mongoose connection immediately before executing destructive operations
 * such as deleteMany({}) or dropDatabase().
 */
const assertSafeForDestructiveOp = (connection, env = process.env) => {
    if (!isTestMode(env)) {
        throw new TestSafetyError(
            "Destructive test cleanup blocked: explicit test mode is not enabled."
        );
    }

    const dbName = connection?.db?.databaseName || connection?.name || "";
    const host = (connection?.host || "").toLowerCase();

    if (!dbName || FORBIDDEN_DB_NAMES.has(dbName.toLowerCase()) || !dbName.toLowerCase().includes("test")) {
        throw new TestSafetyError(
            `Destructive operation blocked on non-test database "${dbName || "<unknown>"}".`
        );
    }

    if (host && (host.endsWith(".mongodb.net") || host.includes("atlas") || !ALLOWED_TEST_HOSTS.has(host))) {
        throw new TestSafetyError(
            `Destructive operation blocked on non-isolated host "${host}".`
        );
    }

    return { safe: true, dbName, host };
};

module.exports = {
    TestSafetyError,
    ALLOWED_TEST_HOSTS,
    isTestMode,
    isExternalMockMode,
    sanitizeMongoUri,
    parseMongoTarget,
    assertSafeTestDatabaseUri,
    assertSafeForDestructiveOp,
};
