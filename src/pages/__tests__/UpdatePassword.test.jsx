import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { toast } from "react-hot-toast";
import UpdatePassword from "../UpdatePassword";
import { resetPassword } from "../../services/operations/authAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("../../__mocks__/react-router-dom"),
  useLocation: jest.fn(),
}));

jest.mock("react-hot-toast", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}));

jest.mock("../../services/operations/authAPI", () => ({
  resetPassword: jest.fn(),
}));

const { useLocation } = require("react-router-dom");

const makeStore = (loading = false) =>
  configureStore({
    reducer: {
      auth: () => ({ loading }),
    },
  });

const setInputValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("Reset Password Page (src/pages/UpdatePassword.jsx) Policy Validation (GAP-007)", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.clearAllMocks();
    useLocation.mockReturnValue({
      pathname: "/update-password/test-reset-token-123",
      search: "",
    });
    resetPassword.mockImplementation(() => () => Promise.resolve(true));
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

  const submitForm = async () => {
    const form = container.querySelector("form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
  };

  test("blocks submission and skips API call when password is fewer than 8 characters", async () => {
    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <UpdatePassword />
        </Provider>
      );
    });

    act(() => {
      setInputValue(container.querySelector('input[name="password"]'), "1234567");
      setInputValue(container.querySelector('input[name="confirmPassword"]'), "1234567");
    });

    await submitForm();

    expect(resetPassword).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Password must be at least 8 characters long"
    );
    expect(container.querySelector('[role="alert"]').textContent).toContain(
      "Password must be at least 8 characters long"
    );
  });

  test("blocks submission when confirmPassword does not match password", async () => {
    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <UpdatePassword />
        </Provider>
      );
    });

    act(() => {
      setInputValue(container.querySelector('input[name="password"]'), "ValidPass8");
      setInputValue(container.querySelector('input[name="confirmPassword"]'), "Different8");
    });

    await submitForm();

    expect(resetPassword).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Passwords do not match");
  });

  test("submits valid 8-character password with URL token and displays confirmation screen", async () => {
    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <UpdatePassword />
        </Provider>
      );
    });

    act(() => {
      setInputValue(container.querySelector('input[name="password"]'), "exact8ch");
      setInputValue(container.querySelector('input[name="confirmPassword"]'), "exact8ch");
    });

    await submitForm();

    expect(resetPassword).toHaveBeenCalledWith(
      "exact8ch",
      "exact8ch",
      "test-reset-token-123"
    );
    expect(container.textContent).toContain("Password Reset Successfully");
  });
});
