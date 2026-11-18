import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import Footer from "../Footer";
import { apiConnector } from "../../../services/apiconnector";

jest.mock("../../../services/apiconnector", () => ({
  apiConnector: jest.fn(),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const VALID_STATIC_ROUTES = new Set(["/", "/about", "/contact", "/signup", "/login"]);

describe("Footer Navigation Links (Regression BUG-023)", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    apiConnector.mockResolvedValue({
      data: {
        success: true,
        data: [
          { _id: "cat1", name: "Web Dev" },
          { _id: "cat2", name: "Data Science" },
        ],
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  it("should only render internal links matching real App.jsx routes or /catalog/:slug", async () => {
    await act(async () => {
      root.render(<Footer />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const anchors = Array.from(container.querySelectorAll("a"));
    expect(anchors.length).toBeGreaterThan(0);

    const internalLinks = anchors
      .map((a) => a.getAttribute("href"))
      .filter((href) => href && !href.startsWith("http"));

    expect(internalLinks.length).toBeGreaterThan(0);
    for (const href of internalLinks) {
      const isValid = VALID_STATIC_ROUTES.has(href) || href.startsWith("/catalog/");
      expect({ href, isValid }).toEqual({ href, isValid: true });
    }

    // Dynamic categories from API should appear
    expect(internalLinks).toContain("/catalog/web-dev");
    expect(internalLinks).toContain("/catalog/data-science");
  });

  it("should keep external social links with rel='noopener noreferrer'", async () => {
    await act(async () => {
      root.render(<Footer />);
      await Promise.resolve();
    });

    const externalAnchors = Array.from(container.querySelectorAll('a[target="_blank"]'));
    expect(externalAnchors.length).toBe(4);
    for (const a of externalAnchors) {
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});
