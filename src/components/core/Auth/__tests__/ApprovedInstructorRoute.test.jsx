import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import ApprovedInstructorRoute from "../ApprovedInstructorRoute";

global.IS_REACT_ACT_ENVIRONMENT = true;

const makeStore = (token, user) =>
  configureStore({
    reducer: {
      auth: () => ({ token }),
      profile: () => ({ user }),
    },
  });

describe("ApprovedInstructorRoute Guard (GAP-002)", () => {
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

  test("redirects unauthenticated users to /login", () => {
    act(() => {
      root.render(
        <Provider store={makeStore(null, null)}>
          <ApprovedInstructorRoute>
            <div>Course Builder</div>
          </ApprovedInstructorRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Course Builder");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe("/login");
  });

  test("redirects non-instructor (Student) to /dashboard/my-profile", () => {
    act(() => {
      root.render(
        <Provider store={makeStore("stu-jwt", { accountType: "Student" })}>
          <ApprovedInstructorRoute>
            <div>Course Builder</div>
          </ApprovedInstructorRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Course Builder");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe(
      "/dashboard/my-profile"
    );
  });

  test("redirects PENDING instructor away to /dashboard/instructor", () => {
    act(() => {
      root.render(
        <Provider
          store={makeStore("inst-jwt", {
            accountType: "Instructor",
            approvalStatus: "PENDING",
            approved: false,
          })}
        >
          <ApprovedInstructorRoute>
            <div>Course Builder</div>
          </ApprovedInstructorRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Course Builder");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe(
      "/dashboard/instructor"
    );
  });

  test("redirects REJECTED instructor away to /dashboard/instructor", () => {
    act(() => {
      root.render(
        <Provider
          store={makeStore("inst-jwt", {
            accountType: "Instructor",
            approvalStatus: "REJECTED",
            approved: false,
          })}
        >
          <ApprovedInstructorRoute>
            <div>Course Builder</div>
          </ApprovedInstructorRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Course Builder");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe(
      "/dashboard/instructor"
    );
  });

  test("renders children for APPROVED and legacy pre-migration instructors", () => {
    act(() => {
      root.render(
        <Provider
          store={makeStore("inst-jwt", {
            accountType: "Instructor",
            approvalStatus: "APPROVED",
            approved: true,
          })}
        >
          <ApprovedInstructorRoute>
            <div>Course Builder</div>
          </ApprovedInstructorRoute>
        </Provider>
      );
    });
    expect(container.textContent).toContain("Course Builder");

    act(() => {
      root.render(
        <Provider store={makeStore("legacy-jwt", { accountType: "Instructor" })}>
          <ApprovedInstructorRoute>
            <div>Legacy Course Builder</div>
          </ApprovedInstructorRoute>
        </Provider>
      );
    });
    expect(container.textContent).toContain("Legacy Course Builder");
  });
});
