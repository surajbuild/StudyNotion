import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import InstructorApprovalNotice from "../InstructorApprovalNotice";
import { refreshCurrentUser } from "../../../../../services/operations/profileAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../../../services/operations/profileAPI", () => ({
  refreshCurrentUser: jest.fn(),
}));

jest.mock("react-hot-toast", () => {
  const fn = jest.fn();
  fn.success = jest.fn();
  fn.error = jest.fn();
  return { toast: fn };
});

const makeStore = (user) =>
  configureStore({
    reducer: {
      auth: () => ({ token: "inst-jwt" }),
      profile: () => ({ user }),
    },
  });

describe("InstructorApprovalNotice Component (GAP-002)", () => {
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

  test("renders pending approval guidance for PENDING instructor", () => {
    act(() => {
      root.render(
        <Provider
          store={makeStore({
            firstName: "Asha",
            accountType: "Instructor",
            approvalStatus: "PENDING",
            approved: false,
          })}
        >
          <InstructorApprovalNotice />
        </Provider>
      );
    });

    expect(container.textContent).toContain("Instructor Account Pending Approval");
    expect(container.textContent).toContain("Pending Approval");
    expect(container.textContent).toContain("awaiting administrator approval");
  });

  test("renders rejection message, admin note, and Contact Support link for REJECTED instructor", () => {
    act(() => {
      root.render(
        <Provider
          store={makeStore({
            firstName: "Vikram",
            accountType: "Instructor",
            approvalStatus: "REJECTED",
            approved: false,
            rejectionReason: "Missing portfolio link",
          })}
        >
          <InstructorApprovalNotice />
        </Provider>
      );
    });

    expect(container.textContent).toContain("Instructor Application Not Approved");
    expect(container.textContent).toContain("Rejected");
    expect(container.textContent).toContain("Missing portfolio link");
    expect(container.textContent).toContain("Contact Support");
  });

  test("Refresh Status button calls refreshCurrentUser to re-query backend approval status", async () => {
    refreshCurrentUser.mockResolvedValueOnce({
      firstName: "Asha",
      accountType: "Instructor",
      approvalStatus: "APPROVED",
      approved: true,
    });

    act(() => {
      root.render(
        <Provider
          store={makeStore({
            firstName: "Asha",
            accountType: "Instructor",
            approvalStatus: "PENDING",
            approved: false,
          })}
        >
          <InstructorApprovalNotice />
        </Provider>
      );
    });

    const refreshBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Refresh Status")
    );
    await act(async () => {
      refreshBtn.click();
    });

    expect(refreshCurrentUser).toHaveBeenCalledWith("inst-jwt", expect.any(Function));
  });
});
