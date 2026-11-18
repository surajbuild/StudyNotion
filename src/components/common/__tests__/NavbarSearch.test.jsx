import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import NavbarSearch from "../NavbarSearch";
import { searchCourses } from "../../../services/operations/courseDetailsAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("../../../__mocks__/react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock("../../../services/operations/courseDetailsAPI", () => ({
  searchCourses: jest.fn(),
}));

const setInputValue = (input, value) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("NavbarSearch Component (GAP-004)", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
  });

  test("debounces typing, renders matching Free and Paid courses, and navigates on click", async () => {
    searchCourses.mockResolvedValue({
      courses: [
        {
          _id: "c_free",
          courseName: "Free JS Primer",
          price: 0,
          averageRating: 4.5,
          instructor: { firstName: "QA", lastName: "Instructor" },
        },
        {
          _id: "c_paid",
          courseName: "JS Pro Bootcamp",
          price: 999,
          averageRating: 0,
          instructor: { firstName: "QA", lastName: "Instructor" },
        },
      ],
      pagination: { totalCourses: 2 },
    });

    const onNavigate = jest.fn();
    act(() => {
      root.render(<NavbarSearch onNavigate={onNavigate} />);
    });

    const input = container.querySelector('input[type="search"]');
    act(() => {
      setInputValue(input, "J");
      setInputValue(input, "JS");
    });

    // Debounce has not elapsed yet -> zero API calls
    expect(searchCourses).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Only 1 debounced call fired for final value
    expect(searchCourses).toHaveBeenCalledTimes(1);
    expect(searchCourses).toHaveBeenCalledWith({ q: "JS", limit: 5, page: 1 });

    expect(container.textContent).toContain("Free JS Primer");
    expect(container.textContent).toContain("Free");
    expect(container.textContent).toContain("JS Pro Bootcamp");
    expect(container.textContent).toContain("₹999");
    expect(container.textContent).toContain("View all 2 results");

    const courseBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Free JS Primer")
    );
    act(() => {
      courseBtn.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/courses/c_free");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  test("supports clear button, empty state, error retry, and form submit navigation", async () => {
    searchCourses
      .mockRejectedValueOnce(new Error("Search service offline"))
      .mockResolvedValueOnce({ courses: [], pagination: { totalCourses: 0 } });

    act(() => {
      root.render(<NavbarSearch />);
    });

    const input = container.querySelector('input[type="search"]');
    act(() => {
      setInputValue(input, "UnknownTopic");
    });

    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });

    // Error state rendered with Retry
    expect(container.textContent).toContain("Search service offline");
    const retryBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Retry")
    );
    expect(retryBtn).toBeTruthy();

    await act(async () => {
      retryBtn.click();
      await Promise.resolve();
    });

    // Empty state rendered after retry
    expect(container.textContent).toContain('No courses found for "UnknownTopic"');

    // Clear button resets query and hides dropdown
    const clearBtn = container.querySelector('button[aria-label="Clear search"]');
    expect(clearBtn).toBeTruthy();
    act(() => {
      clearBtn.click();
    });
    expect(input.value).toBe("");
    expect(container.textContent).not.toContain("No courses found");

    // Typing and submitting navigates to /courses?q=...
    act(() => {
      setInputValue(input, "DevOps");
    });
    const form = container.querySelector("form");
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(mockNavigate).toHaveBeenCalledWith("/courses?q=DevOps");
  });
});
