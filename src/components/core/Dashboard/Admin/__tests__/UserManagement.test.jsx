import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import UserManagement from "../UserManagement";
import {
  fetchAdminUserStats,
  fetchAdminUsers,
  fetchAdminUserDetails,
  approveInstructor,
  rejectInstructor,
} from "../../../../../services/operations/adminAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../../../services/operations/adminAPI", () => ({
  fetchAdminUserStats: jest.fn(),
  fetchAdminUsers: jest.fn(),
  fetchAdminUserDetails: jest.fn(),
  approveInstructor: jest.fn(),
  rejectInstructor: jest.fn(),
}));

const makeStore = () =>
  configureStore({
    reducer: {
      auth: () => ({ token: "admin-jwt-token" }),
      profile: () => ({
        user: { _id: "admin_self_1", firstName: "QA", lastName: "Admin", accountType: "Admin" },
      }),
    },
  });

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const setInputValue = (el, value) => {
  const proto =
    el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const sampleStats = {
  totalUsers: 6,
  totalStudents: 2,
  totalInstructors: 3,
  pendingInstructors: 1,
  approvedInstructors: 1,
  rejectedInstructors: 1,
  totalAdmins: 1,
};

const sampleUsers = [
  {
    _id: "inst_pending_1",
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.pending@test.com",
    accountType: "Instructor",
    approvalStatus: "PENDING",
    approved: false,
    image: "https://example.com/p.png",
    createdAt: "2026-11-10T00:00:00Z",
  },
  {
    _id: "stu_1",
    firstName: "Rahul",
    lastName: "Verma",
    email: "rahul.student@test.com",
    accountType: "Student",
    approvalStatus: null,
    approved: true,
    image: "https://example.com/r.png",
    createdAt: "2026-11-08T00:00:00Z",
  },
];

describe("Admin UserManagement Component (GAP-002)", () => {
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

  test("renders platform user overview stats and user listing with role & approval badges", async () => {
    fetchAdminUserStats.mockResolvedValue(sampleStats);
    fetchAdminUsers.mockResolvedValue({
      users: sampleUsers,
      pagination: {
        page: 1,
        limit: 8,
        totalUsers: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <UserManagement />
        </Provider>
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="stat-total-users"]').textContent).toBe("6");
    expect(container.querySelector('[data-testid="stat-pending-instructors"]').textContent).toBe("1");
    expect(container.textContent).toContain("Priya Sharma");
    expect(container.textContent).toContain("priya.pending@test.com");
    expect(container.textContent).toContain("Pending");
    expect(container.textContent).toContain("Rahul Verma");
  });

  test("handles error state with Retry and switches to Pending Instructors tab", async () => {
    fetchAdminUserStats
      .mockRejectedValueOnce(new Error("Admin stats service down"))
      .mockResolvedValue(sampleStats);
    fetchAdminUsers.mockResolvedValue({
      users: [sampleUsers[0]],
      pagination: {
        page: 1,
        limit: 8,
        totalUsers: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <UserManagement />
        </Provider>
      );
    });
    await flush();

    expect(container.textContent).toContain("Unable to load users");
    const retryBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Retry"
    );
    await act(async () => {
      retryBtn.click();
    });
    await flush();

    const pendingTab = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) =>
      b.textContent.includes("Pending Instructors")
    );
    await act(async () => {
      pendingTab.click();
    });
    await flush();

    expect(fetchAdminUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountType: "Instructor",
        approvalStatus: "PENDING",
        page: 1,
      }),
      "admin-jwt-token"
    );
  });

  test("opens Details modal and confirms instructor approval", async () => {
    fetchAdminUserStats.mockResolvedValue(sampleStats);
    fetchAdminUsers.mockResolvedValue({
      users: [sampleUsers[0]],
      pagination: {
        page: 1,
        limit: 8,
        totalUsers: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    fetchAdminUserDetails.mockResolvedValue({
      ...sampleUsers[0],
      coursesCount: 0,
      contactNumber: "9000011111",
      additionalDetails: { about: "Senior JS Mentor", gender: "Female" },
    });
    approveInstructor.mockResolvedValue({
      success: true,
      data: { ...sampleUsers[0], approvalStatus: "APPROVED", approved: true },
    });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <UserManagement />
        </Provider>
      );
    });
    await flush();

    // Open Details modal
    const detailsBtn = container.querySelector('button[aria-label="View details for priya.pending@test.com"]');
    await act(async () => {
      detailsBtn.click();
    });
    await flush();

    expect(fetchAdminUserDetails).toHaveBeenCalledWith("inst_pending_1", "admin-jwt-token");
    expect(container.textContent).toContain("Senior JS Mentor");

    // Click Approve Instructor inside details modal -> opens ConfirmationModal
    const approveFromModal = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Approve Instructor")
    );
    act(() => {
      approveFromModal.click();
    });
    expect(container.textContent).toContain("Approve Instructor?");

    // Confirm approval
    const confirmApprove = Array.from(container.querySelectorAll("button"))
      .filter((b) => b.textContent.trim() === "Approve Instructor")
      .pop();
    await act(async () => {
      confirmApprove.click();
    });
    await flush();

    expect(approveInstructor).toHaveBeenCalledWith("inst_pending_1", "admin-jwt-token");
  });

  test("confirms instructor rejection with optional reason", async () => {
    fetchAdminUserStats.mockResolvedValue(sampleStats);
    fetchAdminUsers.mockResolvedValue({
      users: [sampleUsers[0]],
      pagination: {
        page: 1,
        limit: 8,
        totalUsers: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    rejectInstructor.mockResolvedValue({
      success: true,
      data: { ...sampleUsers[0], approvalStatus: "REJECTED", approved: false },
    });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <UserManagement />
        </Provider>
      );
    });
    await flush();

    const rejectBtn = container.querySelector('button[aria-label="Reject priya.pending@test.com"]');
    act(() => {
      rejectBtn.click();
    });

    expect(container.textContent).toContain("Reject Instructor Application?");
    const reasonBox = container.querySelector("#reject-reason-input");
    act(() => {
      setInputValue(reasonBox, "Need portfolio samples");
    });

    const form = container.querySelector('div[role="dialog"] form');
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(rejectInstructor).toHaveBeenCalledWith(
      "inst_pending_1",
      "Need portfolio samples",
      "admin-jwt-token"
    );
  });
});
