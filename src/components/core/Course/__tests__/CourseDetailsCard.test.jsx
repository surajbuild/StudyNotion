import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import CourseDetailsCard from "../CourseDetailsCard";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("copy-to-clipboard", () => jest.fn());
jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const makeStore = (user = { _id: "student_1", accountType: "Student" }, token = "tok") =>
  configureStore({
    reducer: {
      profile: () => ({ user }),
      auth: () => ({ token }),
    },
  });

const baseCourse = {
  _id: "course_1",
  courseName: "Test Course",
  thumbnail: "https://example.com/thumb.png",
  price: 0,
  studentEnrolled: [],
  instructions: ["Laptop required"],
};

describe("CourseDetailsCard Free vs Paid UI (GAP-005)", () => {
  let container;
  let root;

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
  });

  test("renders Free pricing, Enroll Now CTA, hides Add to Cart, and calls handleFreeEnroll", () => {
    const handleBuyCourse = jest.fn();
    const handleFreeEnroll = jest.fn();

    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <CourseDetailsCard
            course={{ ...baseCourse, price: 0 }}
            setConfirmationModal={jest.fn()}
            handleBuyCourse={handleBuyCourse}
            handleFreeEnroll={handleFreeEnroll}
          />
        </Provider>
      );
    });

    expect(container.textContent).toContain("Free");
    expect(container.textContent).toContain("Enroll Now");
    expect(container.textContent).toContain("Free Lifetime Access");
    expect(container.textContent).not.toContain("Add to Cart");
    expect(container.textContent).not.toContain("Buy Now");

    const enrollBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Enroll Now")
    );
    act(() => {
      enrollBtn.click();
    });

    expect(handleFreeEnroll).toHaveBeenCalledTimes(1);
    expect(handleBuyCourse).not.toHaveBeenCalled();
  });

  test("preserves paid course UI (Rs. price, Buy Now, Add to Cart, Money-Back Guarantee)", () => {
    const handleBuyCourse = jest.fn();
    const handleFreeEnroll = jest.fn();

    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <CourseDetailsCard
            course={{ ...baseCourse, price: 999 }}
            setConfirmationModal={jest.fn()}
            handleBuyCourse={handleBuyCourse}
            handleFreeEnroll={handleFreeEnroll}
          />
        </Provider>
      );
    });

    expect(container.textContent).toContain("Rs. 999");
    expect(container.textContent).toContain("Buy Now");
    expect(container.textContent).toContain("Add to Cart");
    expect(container.textContent).toContain("30-Day Money-Back Guarantee");

    const buyBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Buy Now")
    );
    act(() => {
      buyBtn.click();
    });

    expect(handleBuyCourse).toHaveBeenCalledTimes(1);
    expect(handleFreeEnroll).not.toHaveBeenCalled();
  });

  test("disables Enroll Now button and shows Enrolling... while loading", () => {
    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <CourseDetailsCard
            course={{ ...baseCourse, price: 0 }}
            setConfirmationModal={jest.fn()}
            handleBuyCourse={jest.fn()}
            handleFreeEnroll={jest.fn()}
            isEnrolling={true}
          />
        </Provider>
      );
    });

    const enrollingBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Enrolling...")
    );
    expect(enrollingBtn).toBeTruthy();
    expect(enrollingBtn.disabled).toBe(true);
  });

  test("shows Go To Course when student is already enrolled", () => {
    act(() => {
      root.render(
        <Provider store={makeStore({ _id: "student_1", accountType: "Student" })}>
          <CourseDetailsCard
            course={{ ...baseCourse, price: 0, studentEnrolled: ["student_1"] }}
            setConfirmationModal={jest.fn()}
            handleBuyCourse={jest.fn()}
            handleFreeEnroll={jest.fn()}
          />
        </Provider>
      );
    });

    expect(container.textContent).toContain("Go To Course");
    expect(container.textContent).not.toContain("Enroll Now");
  });
});
