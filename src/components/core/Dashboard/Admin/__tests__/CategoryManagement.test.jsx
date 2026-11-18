import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import CategoryManagement from "../CategoryManagement";
import {
  fetchAdminDashboard,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../../../../services/operations/adminAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../../../services/operations/adminAPI", () => ({
  fetchAdminDashboard: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
}));

const makeStore = () =>
  configureStore({
    reducer: {
      auth: () => ({ token: "admin-jwt-token" }),
      profile: () => ({ user: { firstName: "QA", lastName: "Admin", accountType: "Admin" } }),
    },
  });

const setInputValue = (el, value) => {
  const proto =
    el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("CategoryManagement Component (GAP-001)", () => {
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

  test("handles API error with Retry, displays categories, and filters via search", async () => {
    fetchAdminDashboard
      .mockRejectedValueOnce(new Error("Admin API unreachable"))
      .mockResolvedValueOnce({
        categories: [
          {
            _id: "c1",
            name: "Web Dev",
            description: "Full-stack web",
            slug: "web-dev",
            totalCourseCount: 2,
          },
          {
            _id: "c2",
            name: "Cybersecurity",
            description: "Security basics",
            slug: "cybersecurity",
            totalCourseCount: 0,
          },
        ],
      });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <CategoryManagement />
        </Provider>
      );
    });
    await flush();

    expect(container.textContent).toContain("Could not load categories");
    expect(container.textContent).toContain("Admin API unreachable");

    const retryBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Retry"
    );
    await act(async () => {
      retryBtn.click();
    });
    await flush();

    expect(container.textContent).toContain("Web Dev");
    expect(container.textContent).toContain("Cybersecurity");

    // Search filters list
    const searchInput = container.querySelector("#admin-category-search");
    act(() => {
      setInputValue(searchInput, "Cyber");
    });
    expect(container.textContent).toContain("Cybersecurity");
    expect(container.textContent).toContain("Showing 1 of 2 categories");
  });

  test("validates empty form, creates a category, and edits an existing category", async () => {
    fetchAdminDashboard.mockResolvedValue({
      categories: [
        {
          _id: "c1",
          name: "Web Dev",
          description: "Web courses",
          slug: "web-dev",
          totalCourseCount: 1,
        },
      ],
    });
    createCategory.mockResolvedValue({ success: true, data: { _id: "c2", name: "AI" } });
    updateCategory.mockResolvedValue({ success: true, data: { _id: "c1", name: "Web Engineering" } });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <CategoryManagement />
        </Provider>
      );
    });
    await flush();

    // Open Create modal & test empty validation
    const openCreateBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Create Category")
    );
    act(() => {
      openCreateBtn.click();
    });

    const form = container.querySelector('div[role="dialog"] form');
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain("Category name is required.");
    expect(createCategory).not.toHaveBeenCalled();

    // Submit valid new category
    act(() => {
      setInputValue(container.querySelector("#category-name"), "AI & ML");
      setInputValue(container.querySelector("#category-description"), "Machine learning tracks");
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(createCategory).toHaveBeenCalledWith(
      { name: "AI & ML", description: "Machine learning tracks" },
      "admin-jwt-token"
    );

    // Edit existing category
    const editBtn = container.querySelector('button[aria-label="Edit Web Dev"]');
    act(() => {
      editBtn.click();
    });
    const editForm = container.querySelector('div[role="dialog"] form');
    act(() => {
      setInputValue(container.querySelector("#category-name"), "Web Engineering");
    });
    await act(async () => {
      editForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(updateCategory).toHaveBeenCalledWith(
      { categoryId: "c1", name: "Web Engineering", description: "Web courses" },
      "admin-jwt-token"
    );
  });

  test("blocks deleting category with associated courses and confirms deletion for empty category", async () => {
    fetchAdminDashboard.mockResolvedValue({
      categories: [
        {
          _id: "c_used",
          name: "Web Dev",
          description: "Used",
          slug: "web-dev",
          totalCourseCount: 2,
        },
        {
          _id: "c_empty",
          name: "Empty Topic",
          description: "Unused",
          slug: "empty-topic",
          totalCourseCount: 0,
        },
      ],
    });
    deleteCategory.mockResolvedValue({ success: true });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <CategoryManagement />
        </Provider>
      );
    });
    await flush();

    // Attempt delete on category with 2 courses -> opens safe-block dialog, never calls API
    const deleteUsedBtn = container.querySelector('button[aria-label="Delete Web Dev"]');
    act(() => {
      deleteUsedBtn.click();
    });
    expect(container.textContent).toContain("Cannot Delete Category");
    expect(container.textContent).toContain("2 associated courses");
    expect(deleteCategory).not.toHaveBeenCalled();

    const closeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Close"
    );
    act(() => {
      closeBtn.click();
    });

    // Attempt delete on 0-course category -> opens confirmation modal -> calls deleteCategory on confirm
    const deleteEmptyBtn = container.querySelector('button[aria-label="Delete Empty Topic"]');
    act(() => {
      deleteEmptyBtn.click();
    });
    expect(container.textContent).toContain("Delete Category?");

    const confirmDeleteBtn = Array.from(container.querySelectorAll("button"))
      .filter((b) => b.textContent.trim() === "Delete")
      .pop();
    await act(async () => {
      confirmDeleteBtn.click();
    });
    await flush();

    expect(deleteCategory).toHaveBeenCalledWith("c_empty", "admin-jwt-token");
  });
});
