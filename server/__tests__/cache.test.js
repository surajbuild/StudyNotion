const cache = require("../utils/cache");

describe("Cache Utility (server/utils/cache.js)", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("should return null for non-existent key", () => {
    expect(cache.get("non-existent-key")).toBeNull();
  });

  it("should store and retrieve value before expiry", () => {
    cache.set("user:123", { name: "Alice" }, 10000);
    expect(cache.get("user:123")).toEqual({ name: "Alice" });
  });

  it("should delete value when requested", () => {
    cache.set("key1", "val1");
    expect(cache.get("key1")).toBe("val1");
    cache.del("key1");
    expect(cache.get("key1")).toBeNull();
  });

  it("should clear all values", () => {
    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.clear();
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBeNull();
  });

  it("should expire items after TTL", (done) => {
    cache.set("fast-expiring", "value", 50); // 50ms TTL
    expect(cache.get("fast-expiring")).toBe("value");

    setTimeout(() => {
      expect(cache.get("fast-expiring")).toBeNull();
      done();
    }, 70);
  });
});
