import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import OrderHistory from "../OrderHistory";
import {
  fetchOrderHistory,
  fetchOrderDetails,
} from "../../../../services/operations/studentFeatureAPI";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../../services/operations/studentFeatureAPI", () => ({
  fetchOrderHistory: jest.fn(),
  fetchOrderDetails: jest.fn(),
}));

const makeStore = () =>
  configureStore({
    reducer: {
      auth: () => ({ token: "student-jwt" }),
      profile: () => ({ user: { firstName: "QA", accountType: "Student" } }),
    },
  });

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("OrderHistory Component (GAP-008)", () => {
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

  test("handles API failure with Retry and renders empty state when student has no orders", async () => {
    fetchOrderHistory
      .mockRejectedValueOnce(new Error("Orders API down"))
      .mockResolvedValueOnce({
        orders: [],
        pagination: {
          page: 1,
          limit: 8,
          totalOrders: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <OrderHistory />
        </Provider>
      );
    });
    await flush();

    expect(container.textContent).toContain("Could not load order history");
    expect(container.textContent).toContain("Orders API down");

    const retryBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Retry"
    );
    await act(async () => {
      retryBtn.click();
    });
    await flush();

    expect(container.textContent).toContain("No orders yet");
  });

  test("renders orders, opens Order Details modal, and supports pagination", async () => {
    const sampleOrder = {
      _id: "507f1f77bcf86cd799439055",
      amount: 999,
      currency: "INR",
      status: "PAID",
      receipt: "rcpt_12345",
      razorpayOrderId: "order_rzp_1",
      razorpayPaymentId: "pay_rzp_1",
      createdAt: "2026-11-18T10:00:00.000Z",
      paidAt: "2026-11-18T10:01:00.000Z",
      courseSnapshots: [
        {
          course: "c1",
          courseName: "Isolated DevOps Bootcamp",
          priceAtPurchase: 999,
          instructorName: "QA Instructor",
        },
      ],
    };

    fetchOrderHistory.mockResolvedValue({
      orders: [sampleOrder],
      pagination: {
        page: 1,
        limit: 8,
        totalOrders: 12,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });
    fetchOrderDetails.mockResolvedValue(sampleOrder);

    await act(async () => {
      root.render(
        <Provider store={makeStore()}>
          <OrderHistory />
        </Provider>
      );
    });
    await flush();

    expect(container.textContent).toContain("Isolated DevOps Bootcamp");
    expect(container.textContent).toContain("PAID");
    expect(container.textContent).toContain("pay_rzp_1");

    // Open Order Details modal
    const detailsBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("View Details")
    );
    await act(async () => {
      detailsBtn.click();
    });
    await flush();

    expect(fetchOrderDetails).toHaveBeenCalledWith("student-jwt", "507f1f77bcf86cd799439055");
    expect(container.textContent).toContain("rcpt_12345");
    expect(container.textContent).toContain("order_rzp_1");

    // Close modal and click Next page
    const closeBtn = container.querySelector('button[aria-label="Close order details"]');
    act(() => {
      closeBtn.click();
    });

    const nextBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.trim() === "Next"
    );
    await act(async () => {
      nextBtn.click();
    });
    await flush();

    expect(fetchOrderHistory).toHaveBeenLastCalledWith("student-jwt", {
      page: 2,
      limit: 8,
      status: "",
    });
  });
});
