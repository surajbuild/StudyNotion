const {
    TestSafetyError,
    isTestMode,
    sanitizeMongoUri,
    assertSafeTestDatabaseUri,
    assertSafeForDestructiveOp,
} = require("../config/testSafety");

describe("Test Database Safety Guardrails (server/config/testSafety.js)", () => {
    const validTestEnv = {
        NODE_ENV: "test",
        STUDYNOTION_TEST_MODE: "true",
        MONGODB_URL: "mongodb+srv://produser:prodpass@cluster0.abcde.mongodb.net/studynotion",
    };

    test("accepts isolated localhost URI with explicit test database name", () => {
        const result = assertSafeTestDatabaseUri(
            "mongodb://127.0.0.1:27018/studynotion_test",
            validTestEnv
        );
        expect(result.safe).toBe(true);
        expect(result.dbName).toBe("studynotion_test");
        expect(result.sanitizedUri).toBe("mongodb://127.0.0.1:27018/studynotion_test");
    });

    test("rejects when test mode is not explicitly enabled", () => {
        expect(() =>
            assertSafeTestDatabaseUri("mongodb://127.0.0.1:27018/studynotion_test", {
                NODE_ENV: "development",
            })
        ).toThrow(TestSafetyError);
    });

    test("rejects empty or missing MONGODB_TEST_URL (no fallback to production)", () => {
        expect(() => assertSafeTestDatabaseUri("", validTestEnv)).toThrow(/MONGODB_TEST_URL/i);
        expect(() => assertSafeTestDatabaseUri(undefined, validTestEnv)).toThrow(/MONGODB_TEST_URL/i);
    });

    test("rejects MongoDB Atlas SRV connection strings and masks credentials in error", () => {
        const atlasUri = "mongodb+srv://admin:supersecret@cluster0.xyz.mongodb.net/studynotion_test";
        let thrown;
        try {
            assertSafeTestDatabaseUri(atlasUri, validTestEnv);
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(TestSafetyError);
        expect(thrown.message).not.toContain("supersecret");
        expect(thrown.message).toContain("***@");
    });

    test("rejects non-local remote hosts even with mongodb:// protocol", () => {
        expect(() =>
            assertSafeTestDatabaseUri("mongodb://prod-db.example.com:27017/studynotion_test", validTestEnv)
        ).toThrow(TestSafetyError);
    });

    test("rejects database names that do not contain 'test' or target system/prod DBs", () => {
        expect(() =>
            assertSafeTestDatabaseUri("mongodb://127.0.0.1:27018/studynotion", validTestEnv)
        ).toThrow(TestSafetyError);
        expect(() =>
            assertSafeTestDatabaseUri("mongodb://127.0.0.1:27018/admin", validTestEnv)
        ).toThrow(TestSafetyError);
        expect(() =>
            assertSafeTestDatabaseUri("mongodb://127.0.0.1:27018/", validTestEnv)
        ).toThrow(TestSafetyError);
    });

    test("rejects MONGODB_TEST_URL that matches MONGODB_URL", () => {
        const sameUri = "mongodb://127.0.0.1:27017/studynotion_test";
        expect(() =>
            assertSafeTestDatabaseUri(sameUri, {
                NODE_ENV: "test",
                MONGODB_URL: sameUri,
            })
        ).toThrow(/cannot match production MONGODB_URL/i);
    });

    test("sanitizeMongoUri masks embedded credentials", () => {
        expect(sanitizeMongoUri("mongodb://user:pass123@127.0.0.1:27018/studynotion_test")).toBe(
            "mongodb://***@127.0.0.1:27018/studynotion_test"
        );
    });

    test("assertSafeForDestructiveOp blocks non-test DBs, Atlas hosts, and non-test NODE_ENV", () => {
        expect(() =>
            assertSafeForDestructiveOp(
                { db: { databaseName: "studynotion" }, host: "127.0.0.1" },
                validTestEnv
            )
        ).toThrow(TestSafetyError);

        expect(() =>
            assertSafeForDestructiveOp(
                { db: { databaseName: "studynotion_test" }, host: "cluster0.abcde.mongodb.net" },
                validTestEnv
            )
        ).toThrow(TestSafetyError);

        expect(() =>
            assertSafeForDestructiveOp(
                { db: { databaseName: "studynotion_test" }, host: "127.0.0.1" },
                { NODE_ENV: "production" }
            )
        ).toThrow(TestSafetyError);

        expect(
            assertSafeForDestructiveOp(
                { db: { databaseName: "studynotion_test" }, host: "127.0.0.1" },
                validTestEnv
            )
        ).toEqual({ safe: true, dbName: "studynotion_test", host: "127.0.0.1" });
    });

    test("isTestMode returns false by default and true only when explicitly enabled", () => {
        expect(isTestMode({ NODE_ENV: "production" })).toBe(false);
        expect(isTestMode({ NODE_ENV: "development" })).toBe(false);
        expect(isTestMode({ NODE_ENV: "test" })).toBe(true);
        expect(isTestMode({ STUDYNOTION_TEST_MODE: "true" })).toBe(true);
    });
});
