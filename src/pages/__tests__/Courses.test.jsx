import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import Courses from "../Courses";
import { apiConnector } from "../../services/apiconnector";
import { searchCourses } from "../../services/operations/courseDetailsAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockInitialParamsString = "";

jest.mock("react-router-dom", () => {
  const ReactLib = require("react");
  const actual = jest.requireActual("../../__mocks__/react-router-dom");
  return {
    ...actual,
    useSearchParams: () => {
      const [params, setParams] = ReactLib.useState(
        () => new URLSearchParams(mockInitialParamsString)
      );
      const updateParams = ReactLib.useCallback((next) => {
        setParams((prev) => {
          if (typeof next === "function") return new URLSearchParams(next(prev));
          return new URLSearchParams(next);
        });
      }, []);
      return [params, updateParams];
    },
  };
});

jest.mock("../../services/apiconnector", () => ({
  apiConnector: jest.fn(),
}));

jest.mock("../../services/operations/courseDetailsAPI", () => ({
  searchCourses: jest.fn(),
}));

jest.mock("../../components/common/Footer", () => () => <div data-testid="mock-footer" />);

const setInputValue = (input, value) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const flushMicrotasks = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("Courses Page — Search, Filtering, Sorting & Pagination (GAP-004)", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitialParamsString = "";
    window.scrollTo = jest.fn();

    apiConnector.mockResolvedValue({
      data: {
        success: true,
        data: [
          { _id: "cat_web", name: "Web Dev" },
          { _id: "cat_ds", name: "Data Science" },
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
  });

  test("hydrates filters from URL params, updates Free/Sort/Pagination, and preserves filters across pages", async () => {
    mockInitialParamsString = "q=React&priceType=paid&sort=price_asc&page=1";
    searchCourses.mockResolvedValue({
      courses: [
        {
          _id: "c1",
          courseName: "React Pro",
          price: 999,
          thumbnail: "thumb.png",
          instructor: { firstName: "Jane", lastName: "Doe" },
          ratingAndReviews: [{ rating: 5 }],
        },
      ],
      pagination: {
        page: 1,
        limit: 9,
        totalCourses: 18,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });

    await act(async () => {
      root.render(<Courses />);
    });
    await flushMicrotasks();

    expect(searchCourses).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "React",
        priceType: "paid",
        sort: "price_asc",
        page: 1,
        limit: 9,
      })
    );
    expect(container.textContent).toContain("React Pro");
    expect(container.textContent).toContain("Showing 1–1 of 18 courses");

    // Click Next page -> preserves q, priceType, sort while advancing page to 2
    const nextBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Next"
    );
    expect(nextBtn).toBeTruthy();

    await act(async () => {
      nextBtn.click();
    });
    await flushMicrotasks();

    expect(searchCourses).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "React",
        priceType: "paid",
        sort: "price_asc",
        page: 2,
      })
    );

    // Switch to Free filter -> resets page back to 1
    const freeRadio = container.querySelector('input[name="priceType"][value="free"]');
    await act(async () => {
      freeRadio.click();
    });
    await flushMicrotasks();

    expect(searchCourses).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "React",
        priceType: "free",
        page: 1,
      })
    );
  });

  test("validates invalid price range inline and handles API failure + retry + empty state", async () => {
    searchCourses
      .mockRejectedValueOnce(new Error("Backend search failed"))
      .mockResolvedValueOnce({
        courses: [],
        pagination: {
          page: 1,
          limit: 9,
          totalCourses: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

    await act(async () => {
      root.render(<Courses />);
    });
    await flushMicrotasks();

    // Error state with Retry button
    expect(container.textContent).toContain("Could not load courses");
    expect(container.textContent).toContain("Backend search failed");

    const retryBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Retry"
    );
    await act(async () => {
      retryBtn.click();
    });
    await flushMicrotasks();

    // Empty state rendered after retry
    expect(container.textContent).toContain("No matching courses found");

    // Inline price range validation (min > max blocks API call)
    const callsBeforeValidation = searchCourses.mock.calls.length;
    const minInput = container.querySelector("#filter-min-price");
    const maxInput = container.querySelector("#filter-max-price");
    act(() => {
      setInputValue(minInput, "2000");
      setInputValue(maxInput, "500");
    });

    const applyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Apply Price")
    );
    act(() => {
      applyBtn.click();
    });

    expect(container.textContent).toContain(
      "Minimum price cannot be greater than maximum price."
    );
    expect(searchCourses.mock.calls.length).toBe(callsBeforeValidation);
  });
});
