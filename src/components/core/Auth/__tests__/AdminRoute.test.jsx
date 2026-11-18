import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import AdminRoute from "../AdminRoute";
import OpenRoute from "../OpenRoute";

global.IS_REACT_ACT_ENVIRONMENT = true;

const makeStore = (token, user) =>
  configureStore({
    reducer: {
      auth: () => ({ token }),
      profile: () => ({ user }),
    },
  });

describe("AdminRoute Guard (GAP-001 Security)", () => {
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
          <AdminRoute>
            <div>Secret Admin Area</div>
          </AdminRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Secret Admin Area");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe("/login");
  });

  test("redirects authenticated Student away to /dashboard/my-profile", () => {
    act(() => {
      root.render(
        <Provider store={makeStore("student-jwt", { accountType: "Student" })}>
          <AdminRoute>
            <div>Secret Admin Area</div>
          </AdminRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Secret Admin Area");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe(
      "/dashboard/my-profile"
    );
  });

  test("redirects authenticated Instructor away to /dashboard/my-profile", () => {
    act(() => {
      root.render(
        <Provider store={makeStore("instructor-jwt", { accountType: "Instructor" })}>
          <AdminRoute>
            <div>Secret Admin Area</div>
          </AdminRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Secret Admin Area");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe(
      "/dashboard/my-profile"
    );
  });

  test("renders protected children for authenticated Admin", () => {
    act(() => {
      root.render(
        <Provider store={makeStore("admin-jwt", { accountType: "Admin" })}>
          <AdminRoute>
            <div>Secret Admin Area</div>
          </AdminRoute>
        </Provider>
      );
    });

    expect(container.textContent).toContain("Secret Admin Area");
  });

  test("OpenRoute redirects authenticated Admin directly to /dashboard/admin (BUG-030)", () => {
    act(() => {
      root.render(
        <Provider store={makeStore("admin-jwt", { accountType: "Admin" })}>
          <OpenRoute>
            <div>Login Form</div>
          </OpenRoute>
        </Provider>
      );
    });

    expect(container.textContent).not.toContain("Login Form");
    expect(container.querySelector('[data-testid="redirect-to"]').textContent).toBe(
      "/dashboard/admin"
    );
  });
});
