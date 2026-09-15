// Tiny in-memory TTL cache for hot, read-heavy endpoints.
// Simple + dependency-free. Replace with Redis if you need multi-instance caching.
const cache = new Map();

const get = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.value;
};

const set = (key, value, ttlMs = 5 * 60 * 1000) => {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const del = (key) => {
    cache.delete(key);
};

const clear = () => cache.clear();

// Best-effort eviction of expired entries every 60s so the map doesn't grow unbounded.
const startSweeper = (intervalMs = 60 * 1000) => {
    if (typeof global.__cacheSweeperStarted === "boolean") return;
    global.__cacheSweeperStarted = true;
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of cache) {
            if (now > entry.expiresAt) cache.delete(key);
        }
    }, intervalMs);
};

module.exports = { get, set, del, clear, startSweeper };