import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import CourseStudents from "../CourseStudents";
import { fetchCourseEnrolledStudents } from "../../../../../services/operations/courseDetailsAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("../../../../../__mocks__/react-router-dom");
  return {
    ...actual,
    useParams: () => ({ courseId: "507f1f77bcf86cd799439099" }),
  };
});

jest.mock("../../../../../services/operations/courseDetailsAPI", () => ({
  fetchCourseEnrolledStudents: jest.fn(),
}));

const makeStore = () =>
  configureStore({
    reducer: {
      auth: () => ({ token: "approved-inst-jwt" }),
      profile: () => ({
        user: {
          _id: "inst_1",
          firstName: "QA",
          lastName: "Instructor",
          accountType: "Instructor",
          approvalStatus: "APPROVED",
        },
      }),
    },
  });

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const setInputValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("CourseStudents Roster Component (F-INS-11)", () => {
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

  test("renders course summary KPIs, enrolled students, progress bars, and unavailable enrollment date fallback", async () => {
    fetchCourseEnrolledStudents.mockResolvedValueOnce({
      course: {
        _id: "507f1f77bcf86cd799439099",
        courseName: "Isolated MERN Mastery",
        status: "Published",
        totalLectures: 2,
        totalEnrolled: 2,
      },
      summary: {
        totalEnrolled: 2,
        totalLectures: 2,
        averageCompletionPercentage: 75,
        completedStudentsCount: 1,
      },
      students: [
        {
          _id: "s1",
          firstName: "Anya",
          lastName: "Patel",
          email: "anya@test.com",
          image: "https://example.com/a.png",
          enrolledAt: "2026-11-15T10:00:00.000Z",
          progress: {
            totalLectures: 2,
            completedLectures: 2,
            remainingLectures: 0,
            completionPercentage: 100,
          },
        },
        {
          _id: "s2",
          firstName: "Zain",
          lastName: "Legacy",
          email: "zain@test.com",
          image: "https://example.com/z.png",
          enrolledAt: null,
          progress: {
            totalLectures: 2,
            completedLectures: 1,
            remainingLectures: 1,
            completionPercentage: 50,
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 8,
        totalStudents: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <CourseStudents />
        </Provider>
      );
    });
    await flush();

    expect(container.textContent).toContain("Isolated MERN Mastery — Students");
    expect(container.querySelector('[data-testid="roster-total-enrolled"]').textContent).toBe("2");
    expect(container.querySelector('[data-testid="roster-total-lectures"]').textContent).toBe("2");
    expect(container.querySelector('[data-testid="roster-avg-completion"]').textContent).toBe("75%");
    expect(container.querySelector('[data-testid="roster-completed-count"]').textContent).toBe("1");
    expect(container.textContent).toContain("Anya Patel");
    expect(container.textContent).toContain("2 / 2 completed");
    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("Zain Legacy");
    expect(container.textContent).toContain("Not recorded");
    expect(container.textContent).toContain("50%");
  });

  test("handles empty roster cleanly", async () => {
    fetchCourseEnrolledStudents.mockResolvedValueOnce({
      course: { _id: "507f1f77bcf86cd799439099", courseName: "New Course", status: "Draft" },
      summary: {
        totalEnrolled: 0,
        totalLectures: 0,
        averageCompletionPercentage: 0,
        completedStudentsCount: 0,
      },
      students: [],
      pagination: {
        page: 1,
        limit: 8,
        totalStudents: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <CourseStudents />
        </Provider>
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="roster-empty-state"]').textContent).toContain(
      "No students enrolled yet"
    );
  });

  test("handles API error with Retry and supports search + Next pagination", async () => {
    fetchCourseEnrolledStudents
      .mockRejectedValueOnce(new Error("Roster service temporarily unavailable"))
      .mockResolvedValueOnce({
        course: { _id: "507f1f77bcf86cd799439099", courseName: "MERN", status: "Published" },
        summary: {
          totalEnrolled: 10,
          totalLectures: 4,
          averageCompletionPercentage: 25,
          completedStudentsCount: 0,
        },
        students: [
          {
            _id: "s1",
            firstName: "Page1",
            lastName: "Student",
            email: "p1@test.com",
            image: "https://example.com/1.png",
            enrolledAt: null,
            progress: { totalLectures: 4, completedLectures: 1, remainingLectures: 3, completionPercentage: 25 },
          },
        ],
        pagination: {
          page: 1,
          limit: 8,
          totalStudents: 10,
          totalPages: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      })
      .mockResolvedValue({
        course: { _id: "507f1f77bcf86cd799439099", courseName: "MERN", status: "Published" },
        summary: {
          totalEnrolled: 10,
          totalLectures: 4,
          averageCompletionPercentage: 25,
          completedStudentsCount: 0,
        },
        students: [
          {
            _id: "s9",
            firstName: "Page2",
            lastName: "Student",
            email: "p2@test.com",
            image: "https://example.com/2.png",
            enrolledAt: null,
            progress: { totalLectures: 4, completedLectures: 2, remainingLectures: 2, completionPercentage: 50 },
          },
        ],
        pagination: {
          page: 2,
          limit: 8,
          totalStudents: 10,
          totalPages: 2,
          hasNextPage: false,
          hasPrevPage: true,
        },
      });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <CourseStudents />
        </Provider>
      );
    });
    await flush();

    expect(container.textContent).toContain("Unable to load enrolled students");
    expect(container.textContent).toContain("Roster service temporarily unavailable");

    const retryBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Retry"
    );
    await act(async () => {
      retryBtn.click();
    });
    await flush();

    expect(container.textContent).toContain("Page1 Student");

    // Navigate to Next page
    const nextBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Next"
    );
    await act(async () => {
      nextBtn.click();
    });
    await flush();

    expect(fetchCourseEnrolledStudents).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439099",
      expect.objectContaining({ page: 2, limit: 8 }),
      "approved-inst-jwt"
    );
    expect(container.textContent).toContain("Page2 Student");

    // Debounced search resets to page 1
    const searchBox = container.querySelector(
      'input[aria-label="Search enrolled students by name or email"]'
    );
    act(() => {
      setInputValue(searchBox, "Page2");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 320));
    });
    expect(fetchCourseEnrolledStudents).toHaveBeenLastCalledWith(
      "507f1f77bcf86cd799439099",
      expect.objectContaining({ search: "Page2", page: 1 }),
      "approved-inst-jwt"
    );
  });
});
