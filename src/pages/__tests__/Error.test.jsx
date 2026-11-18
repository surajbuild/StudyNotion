import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import Error from "../Error";

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("Error Page (Regression BUG-026)", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
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

  it("should render a Link pointing directly to '/' without global html/body style overrides", () => {
    act(() => {
      root.render(<Error />);
    });

    const homeLink = container.querySelector('a[aria-label="Go to right side up"]');
    expect(homeLink).not.toBeNull();
    expect(homeLink.getAttribute("href")).toBe("/");

    const styleTag = container.querySelector("style");
    expect(styleTag.textContent).not.toContain("html, body, #root");
    expect(styleTag.textContent).not.toContain("overflow: hidden !important");
  });
});
