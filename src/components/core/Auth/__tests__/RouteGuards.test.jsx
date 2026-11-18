import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../../../../slices/authSlice";
import PrivateRoute from "../PrivateRoute";
import OpenRoute from "../OpenRoute";

global.IS_REACT_ACT_ENVIRONMENT = true;

const createMockStore = (initialToken = null) => {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        token: initialToken,
        loading: false,
        signupData: null,
      },
    },
  });
};

describe("Route Guards", () => {
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

  describe("PrivateRoute", () => {
    it("should render children when authenticated (token exists)", () => {
      const store = createMockStore("valid-token-123");
      act(() => {
        root.render(
          <Provider store={store}>
            <PrivateRoute>
              <div data-testid="protected">Protected Area</div>
            </PrivateRoute>
          </Provider>
        );
      });

      expect(container.textContent).toContain("Protected Area");
      expect(container.querySelector('[data-testid="redirect-to"]')).toBeNull();
    });

    it("should redirect to /login when not authenticated (token is null)", () => {
      const store = createMockStore(null);
      act(() => {
        root.render(
          <Provider store={store}>
            <PrivateRoute>
              <div data-testid="protected">Protected Area</div>
            </PrivateRoute>
          </Provider>
        );
      });

      expect(container.textContent).not.toContain("Protected Area");
      const redirectEl = container.querySelector('[data-testid="redirect-to"]');
      expect(redirectEl).not.toBeNull();
      expect(redirectEl.textContent).toBe("/login");
    });
  });

  describe("OpenRoute", () => {
    it("should render public children when not logged in (token is null)", () => {
      const store = createMockStore(null);
      act(() => {
        root.render(
          <Provider store={store}>
            <OpenRoute>
              <div data-testid="login-form">Login Form</div>
            </OpenRoute>
          </Provider>
        );
      });

      expect(container.textContent).toContain("Login Form");
      expect(container.querySelector('[data-testid="redirect-to"]')).toBeNull();
    });

    it("should redirect to /dashboard/my-profile when already logged in", () => {
      const store = createMockStore("logged-in-token");
      act(() => {
        root.render(
          <Provider store={store}>
            <OpenRoute>
              <div data-testid="login-form">Login Form</div>
            </OpenRoute>
          </Provider>
        );
      });

      expect(container.textContent).not.toContain("Login Form");
      const redirectEl = container.querySelector('[data-testid="redirect-to"]');
      expect(redirectEl).not.toBeNull();
      expect(redirectEl.textContent).toBe("/dashboard/my-profile");
    });
  });
});
