const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { assertSafeTestDatabaseUri, isTestMode } = require("../config/testSafety");

const DEFAULT_TEST_PORT = 27018;
const DEFAULT_TEST_DB_NAME = "studynotion_test";
const DEFAULT_TEST_URI = `mongodb://127.0.0.1:${DEFAULT_TEST_PORT}/${DEFAULT_TEST_DB_NAME}`;

const COMMON_MONGOD_PATHS = [
    process.env.MONGOD_BINARY,
    "mongod",
    "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe",
    "C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe",
    "C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe",
    "/usr/bin/mongod",
    "/usr/local/bin/mongod",
].filter(Boolean);

const isPortOpen = (host, port, timeoutMs = 800) =>
    new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const done = (result) => {
            if (!settled) {
                settled = true;
                socket.destroy();
                resolve(result);
            }
        };
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
        socket.once("timeout", () => done(false));
        socket.connect(port, host);
    });

const waitForPort = async (host, port, retries = 40, delayMs = 250) => {
    for (let i = 0; i < retries; i++) {
        if (await isPortOpen(host, port)) return true;
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
};

const findMongodBinary = () => {
    for (const candidate of COMMON_MONGOD_PATHS) {
        if (candidate === "mongod") continue;
        if (fs.existsSync(candidate)) return candidate;
    }
    return "mongod";
};

const parseHostPort = (uri) => {
    const match = uri.match(/^mongodb:\/\/(?:[^/@]+@)?([^:/?]+)(?::(\d+))?/i);
    if (!match) return { host: "127.0.0.1", port: DEFAULT_TEST_PORT };
    return {
        host: match[1] === "localhost" ? "127.0.0.1" : match[1],
        port: Number(match[2] || 27017),
    };
};

/**
 * Ensures an isolated local MongoDB test instance is running and returns
 * { uri, managedProcess, dbPath, stop }.
 *
 * Strategy:
 *  1. If MONGODB_TEST_URL is provided and already reachable (e.g., docker-compose.test.yml),
 *     validates it via assertSafeTestDatabaseUri() and uses it without spawning a child process.
 *  2. Otherwise, spawns an ephemeral local `mongod` bound strictly to 127.0.0.1 on port 27018
 *     with a fresh temporary dbpath inside os.tmpdir(), torn down cleanly on stop().
 */
const ensureIsolatedMongo = async ({ dbName = DEFAULT_TEST_DB_NAME, port = DEFAULT_TEST_PORT } = {}) => {
    if (!isTestMode()) {
        throw new Error("ensureIsolatedMongo requires NODE_ENV=test or STUDYNOTION_TEST_MODE=true.");
    }

    const requestedUri = (process.env.MONGODB_TEST_URL || "").trim();
    if (requestedUri) {
        assertSafeTestDatabaseUri(requestedUri, process.env);
        const target = parseHostPort(requestedUri);
        // Wait up to 30 seconds for external/CI service container (e.g. GitHub Actions container service or Docker)
        if (await waitForPort(target.host, target.port, 60, 500)) {
            return {
                uri: requestedUri,
                managed: false,
                dbPath: null,
                stop: async () => {},
            };
        }
        throw new Error(
            `Explicit MONGODB_TEST_URL was provided (${requestedUri}) but host ${target.host}:${target.port} did not become reachable within 30 seconds.`
        );
    }

    // Spawn a dedicated ephemeral mongod on 127.0.0.1:<port>
    const isolatedUri = requestedUri || `mongodb://127.0.0.1:${port}/${dbName}`;
    assertSafeTestDatabaseUri(isolatedUri, process.env);
    const target = parseHostPort(isolatedUri);

    if (await isPortOpen(target.host, target.port)) {
        return {
            uri: isolatedUri,
            managed: false,
            dbPath: null,
            stop: async () => {},
        };
    }

    const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), "studynotion-test-mongo-"));
    const mongodBin = findMongodBinary();
    const args = [
        "--dbpath",
        dbPath,
        "--port",
        String(target.port),
        "--bind_ip",
        "127.0.0.1",
        "--quiet",
    ];

    const child = spawn(mongodBin, args, {
        // Ignore stdout so MongoDB 8.0 JSON logs never fill an unread OS pipe buffer and deadlock mongod
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
    });

    let stderrBuf = "";
    child.stderr.on("data", (chunk) => {
        stderrBuf += chunk.toString();
    });

    const ready = await waitForPort("127.0.0.1", target.port, 50, 250);
    if (!ready) {
        try {
            child.kill("SIGTERM");
        } catch {}
        fs.rmSync(dbPath, { recursive: true, force: true });
        throw new Error(
            `Failed to start isolated mongod on 127.0.0.1:${target.port}. ` +
                `Ensure MongoDB is installed or run 'docker compose -f docker-compose.test.yml up -d'.\n${stderrBuf.slice(0, 400)}`
        );
    }

    const stop = async () => {
        if (!child.killed) {
            await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    try {
                        child.kill("SIGKILL");
                    } catch {}
                    resolve();
                }, 4000);
                child.once("exit", () => {
                    clearTimeout(timer);
                    resolve();
                });
                try {
                    child.kill("SIGTERM");
                } catch {
                    clearTimeout(timer);
                    resolve();
                }
            });
        }
        try {
            fs.rmSync(dbPath, { recursive: true, force: true });
        } catch {
            // Ignore transient Windows file lock on tmpdir cleanup
        }
    };

    return {
        uri: isolatedUri,
        managed: true,
        dbPath,
        stop,
    };
};

module.exports = {
    DEFAULT_TEST_PORT,
    DEFAULT_TEST_DB_NAME,
    DEFAULT_TEST_URI,
    ensureIsolatedMongo,
};
