import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { toast } from "react-hot-toast";
import SignupForm from "../SignupForm";
import authReducer from "../../../../slices/authSlice";
import { sendOtp } from "../../../../services/operations/authAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-hot-toast", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}));

jest.mock("../../../../services/operations/authAPI", () => ({
  sendOtp: jest.fn(() => () => Promise.resolve()),
}));

const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
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

describe("SignupForm Password Policy Validation (GAP-007)", () => {
  let container;
  let root;
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    sendOtp.mockImplementation(() => () => Promise.resolve());
    store = makeStore();
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

  const fillForm = ({
    firstName = "Ada",
    lastName = "Lovelace",
    email = "ada@example.com",
    password = "",
    confirmPassword = "",
  }) => {
    act(() => {
      setInputValue(container.querySelector('input[name="firstName"]'), firstName);
      setInputValue(container.querySelector('input[name="lastName"]'), lastName);
      setInputValue(container.querySelector('input[name="email"]'), email);
      setInputValue(container.querySelector('input[name="password"]'), password);
      setInputValue(
        container.querySelector('input[name="confirmPassword"]'),
        confirmPassword
      );
    });
  };

  const submitForm = () => {
    const form = container.querySelector("form");
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  };

  test("blocks submission and sends zero API requests for 7-character password", () => {
    act(() => {
      root.render(
        <Provider store={store}>
          <SignupForm />
        </Provider>
      );
    });

    fillForm({ password: "short7!", confirmPassword: "short7!" });
    submitForm();

    expect(sendOtp).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Password must be at least 8 characters long"
    );
    expect(container.querySelector('[role="alert"]').textContent).toContain(
      "Password must be at least 8 characters long"
    );
    expect(store.getState().auth.signupData).toBeNull();
  });

  test("blocks submission when password and confirm password do not match", () => {
    act(() => {
      root.render(
        <Provider store={store}>
          <SignupForm />
        </Provider>
      );
    });

    fillForm({ password: "ValidPass8", confirmPassword: "OtherPass8" });
    submitForm();

    expect(sendOtp).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Passwords Do Not Match");
    expect(container.querySelector('[role="alert"]').textContent).toContain(
      "Passwords Do Not Match"
    );
  });

  test("allows exact 8-character password for both Student and Instructor tabs and preserves visibility toggles", () => {
    act(() => {
      root.render(
        <Provider store={store}>
          <SignupForm />
        </Provider>
      );
    });

    // Verify password visibility toggle works
    const pwdInput = container.querySelector('input[name="password"]');
    expect(pwdInput.type).toBe("password");
    const toggleSpan = pwdInput.parentElement.querySelector("span");
    act(() => {
      toggleSpan.click();
    });
    expect(pwdInput.type).toBe("text");

    // Switch to Instructor tab
    const instructorTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent.trim() === "Instructor"
    );
    act(() => {
      instructorTab.click();
    });

    fillForm({ password: "exact8ch", confirmPassword: "exact8ch" });
    submitForm();

    expect(sendOtp).toHaveBeenCalledTimes(1);
    expect(sendOtp).toHaveBeenCalledWith("ada@example.com", expect.any(Function));
    expect(store.getState().auth.signupData).toEqual(
      expect.objectContaining({
        email: "ada@example.com",
        accountType: "Instructor",
      })
    );
  });
});
