import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import UpdatePassword from "../UpdatePassword";
import { changePassword } from "../../../../../services/operations/SettingsAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../../../services/operations/SettingsAPI", () => ({
  changePassword: jest.fn(),
}));

const makeStore = () =>
  configureStore({
    reducer: {
      auth: () => ({ token: "student-jwt-token" }),
    },
  });

const setInputValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
};

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("Settings Change Password Form (GAP-007)", () => {
  let container;
  let root;

  beforeEach(() => {
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
  });

  test("rejects a 7-character new password without calling changePassword API", async () => {
    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <UpdatePassword />
        </Provider>
      );
    });

    act(() => {
      setInputValue(container.querySelector("#oldPassword"), "currentPass1");
      setInputValue(container.querySelector("#newPassword"), "short7!");
      setInputValue(container.querySelector("#confirmNewPassword"), "short7!");
    });

    await act(async () => {
      container
        .querySelector("form")
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(changePassword).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Password must be at least 8 characters long"
    );
  });

  test("allows a legacy <8-character current password when updating to a valid >=8-character new password", async () => {
    changePassword.mockResolvedValue(true);

    act(() => {
      root.render(
        <Provider store={makeStore()}>
          <UpdatePassword />
        </Provider>
      );
    });

    act(() => {
      setInputValue(container.querySelector("#oldPassword"), "old5!");
      setInputValue(container.querySelector("#newPassword"), "NewValid8!");
      setInputValue(container.querySelector("#confirmNewPassword"), "NewValid8!");
    });

    await act(async () => {
      container
        .querySelector("form")
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(changePassword).toHaveBeenCalledTimes(1);
    expect(changePassword).toHaveBeenCalledWith("student-jwt-token", {
      oldPassword: "old5!",
      newPassword: "NewValid8!",
      confirmNewPassword: "NewValid8!",
    });
  });
});
