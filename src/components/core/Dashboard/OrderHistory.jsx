import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { AiOutlineClose } from "react-icons/ai";
import { formatDate } from "../../../services/formatDate";
import {
  fetchOrderHistory,
  fetchOrderDetails,
} from "../../../services/operations/studentFeatureAPI";

const PAGE_LIMIT = 8;

const STATUS_BADGES = {
  PAID: "border-caribbeangreen-400/40 bg-caribbeangreen-900/40 text-caribbeangreen-100",
  PENDING: "border-yellow-50/40 bg-yellow-900/30 text-yellow-50",
  FAILED: "border-pink-400/40 bg-pink-900/30 text-pink-200",
  CANCELLED: "border-richblack-500 bg-richblack-700 text-richblack-200",
  REFUNDED: "border-blue-400/40 bg-blue-900/30 text-blue-100",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const OrderHistory = () => {
  const { token } = useSelector((state) => state.auth);

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    totalOrders: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchOrderHistory(token, {
        page,
        limit: PAGE_LIMIT,
        status: statusFilter,
      });
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      setPagination(
        data?.pagination || {
          page,
          limit: PAGE_LIMIT,
          totalOrders: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        }
      );
    } catch (err) {
      setError(err?.message || "Failed to load order history.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleOpenDetails = async (orderSummary) => {
    setSelectedOrder(orderSummary);
    setDetailError("");
    setDetailLoading(true);
    try {
      const fullOrder = await fetchOrderDetails(token, orderSummary._id);
      if (fullOrder) {
        setSelectedOrder(fullOrder);
      }
    } catch (err) {
      setDetailError(err?.message || "Could not refresh order details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    const cls = STATUS_BADGES[status] || STATUS_BADGES.CANCELLED;
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
      >
        {status}
      </span>
    );
  };

  const formatAmount = (order) => {
    if (Number(order?.amount) === 0) {
      return <span className="font-semibold text-caribbeangreen-100">Free (₹0)</span>;
    }
    const symbol = order?.currency === "INR" ? "₹" : `${order?.currency || "INR"} `;
    return (
      <span className="font-semibold text-richblack-5">
        {symbol}
        {order?.amount}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-richblack-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-richblack-5 sm:text-3xl">
            Order History
          </h1>
          <p className="mt-1 text-sm text-richblack-300">
            Track your course purchases, free enrollments, and payment verification status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="order-status-filter"
            className="whitespace-nowrap text-sm text-richblack-300"
          >
            Status:
          </label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-richblack-600 bg-richblack-800 px-3 py-2 text-sm text-richblack-5 focus:border-yellow-50 focus:outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div
          role="status"
          aria-label="Loading order history"
          className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-richblack-700 bg-richblack-800"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
          <p className="text-sm text-richblack-300">Loading your orders...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
        >
          <p className="text-lg font-semibold text-pink-200">
            Could not load order history
          </p>
          <p className="max-w-md text-sm text-richblack-300">{error}</p>
          <button
            type="button"
            onClick={loadOrders}
            className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-richblack-700 bg-richblack-800 p-8 text-center">
          <p className="text-lg font-semibold text-richblack-5">
            {statusFilter ? `No ${statusFilter.toLowerCase()} orders found` : "No orders yet"}
          </p>
          <p className="max-w-md text-sm text-richblack-300">
            {statusFilter
              ? "Try selecting a different payment status filter."
              : "Once you enroll in free courses or purchase paid courses, your orders will appear here."}
          </p>
          {statusFilter ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
              className="rounded-lg border border-richblack-600 px-5 py-2 text-sm text-richblack-100 hover:bg-richblack-700"
            >
              Show All Orders
            </button>
          ) : (
            <Link
              to="/courses"
              className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
            >
              Explore Courses
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-richblack-700 bg-richblack-800 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-richblack-700 bg-richblack-900/60 text-xs uppercase text-richblack-300">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Order</th>
                  <th className="px-5 py-3.5 font-semibold">Courses</th>
                  <th className="px-5 py-3.5 font-semibold">Amount</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Transaction Ref</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-richblack-700">
                {orders.map((order) => {
                  const snapshots = Array.isArray(order.courseSnapshots)
                    ? order.courseSnapshots
                    : [];
                  const firstTitle =
                    snapshots[0]?.courseName || `${order.courses?.length || 0} Course(s)`;
                  const extraCount = Math.max(0, snapshots.length - 1);

                  return (
                    <tr key={order._id} className="hover:bg-richblack-700/30">
                      <td className="px-5 py-4 align-top">
                        <p className="font-mono text-xs font-semibold text-richblack-5">
                          #{String(order._id).slice(-8).toUpperCase()}
                        </p>
                        <p className="mt-1 text-xs text-richblack-300">
                          {order.createdAt ? formatDate(order.createdAt) : "—"}
                        </p>
                      </td>
                      <td className="max-w-xs px-5 py-4 align-top">
                        <p className="truncate font-medium text-richblack-5">{firstTitle}</p>
                        {extraCount > 0 && (
                          <p className="mt-0.5 text-xs text-richblack-300">
                            +{extraCount} more {extraCount === 1 ? "course" : "courses"}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        {formatAmount(order)}
                        <span className="ml-1 text-xs text-richblack-400">
                          {order.currency || "INR"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        {renderStatusBadge(order.status)}
                      </td>
                      <td className="px-5 py-4 align-top font-mono text-xs text-richblack-300">
                        {order.razorpayPaymentId ||
                          (order.paymentProvider === "FREE"
                            ? "Free Enrollment"
                            : order.razorpayOrderId || "—")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(order)}
                          className="rounded-md border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-yellow-50 hover:border-yellow-50"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => {
              const snapshots = Array.isArray(order.courseSnapshots)
                ? order.courseSnapshots
                : [];
              return (
                <div
                  key={order._id}
                  className="rounded-xl border border-richblack-700 bg-richblack-800 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-richblack-5">
                        #{String(order._id).slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-richblack-400">
                        {order.createdAt ? formatDate(order.createdAt) : "—"}
                      </p>
                    </div>
                    {renderStatusBadge(order.status)}
                  </div>

                  <p className="mt-2 text-sm font-medium text-richblack-5">
                    {snapshots.map((s) => s.courseName).join(", ") ||
                      `${order.courses?.length || 0} Course(s)`}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-richblack-700 pt-3">
                    <div className="text-sm">{formatAmount(order)}</div>
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(order)}
                      className="rounded-md border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-yellow-50"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <nav
              aria-label="Order history pagination"
              className="flex items-center justify-center gap-3 pt-2"
            >
              <button
                type="button"
                disabled={!pagination.hasPrevPage || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-richblack-600 bg-richblack-800 px-3.5 py-1.5 text-sm text-richblack-100 hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-richblack-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-richblack-600 bg-richblack-800 px-3.5 py-1.5 text-sm text-richblack-100 hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          className="fixed inset-0 z-[1000] grid place-items-center bg-richblack-900/75 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-richblack-600 bg-richblack-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-richblack-700 pb-3">
              <div>
                <h2 id="order-detail-title" className="text-lg font-semibold text-richblack-5">
                  Order Details
                </h2>
                <p className="font-mono text-xs text-richblack-300">{selectedOrder._id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="rounded p-1 text-richblack-300 hover:bg-richblack-700 hover:text-richblack-5"
              >
                <AiOutlineClose className="text-lg" />
              </button>
            </div>

            {detailLoading && (
              <p className="mb-3 text-xs text-richblack-300">Refreshing order details...</p>
            )}
            {detailError && (
              <p role="alert" className="mb-3 text-xs text-pink-200">
                {detailError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-richblack-700 bg-richblack-900 p-4 text-xs">
              <div>
                <p className="text-richblack-400">Payment Status</p>
                <div className="mt-1">{renderStatusBadge(selectedOrder.status)}</div>
              </div>
              <div>
                <p className="text-richblack-400">Total Amount</p>
                <p className="mt-1 text-sm">
                  {formatAmount(selectedOrder)}{" "}
                  <span className="text-xs text-richblack-400">{selectedOrder.currency}</span>
                </p>
              </div>
              <div>
                <p className="text-richblack-400">Receipt Reference</p>
                <p className="mt-1 break-all font-mono text-richblack-100">
                  {selectedOrder.receipt || "—"}
                </p>
              </div>
              <div>
                <p className="text-richblack-400">Order Date</p>
                <p className="mt-1 text-richblack-100">
                  {selectedOrder.createdAt ? formatDate(selectedOrder.createdAt) : "—"}
                </p>
              </div>
              {selectedOrder.razorpayOrderId && (
                <div>
                  <p className="text-richblack-400">Razorpay Order ID</p>
                  <p className="mt-1 break-all font-mono text-richblack-100">
                    {selectedOrder.razorpayOrderId}
                  </p>
                </div>
              )}
              {selectedOrder.razorpayPaymentId && (
                <div>
                  <p className="text-richblack-400">Razorpay Payment ID</p>
                  <p className="mt-1 break-all font-mono text-richblack-100">
                    {selectedOrder.razorpayPaymentId}
                  </p>
                </div>
              )}
              {selectedOrder.paidAt && (
                <div className="col-span-2">
                  <p className="text-richblack-400">Verified At</p>
                  <p className="mt-1 text-richblack-100">{formatDate(selectedOrder.paidAt)}</p>
                </div>
              )}
              {selectedOrder.failureReason && (
                <div className="col-span-2">
                  <p className="text-richblack-400">Failure / Cancellation Reason</p>
                  <p className="mt-1 text-pink-200">{selectedOrder.failureReason}</p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <p className="mb-3 text-sm font-semibold text-richblack-100">
                Purchased Courses ({selectedOrder.courseSnapshots?.length || 0})
              </p>
              <div className="flex flex-col gap-3">
                {(selectedOrder.courseSnapshots || []).map((item, idx) => (
                  <div
                    key={`${item.course}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-richblack-700 bg-richblack-900 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.courseName}
                          className="h-12 w-16 flex-shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-16 flex-shrink-0 rounded bg-richblack-700" />
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/courses/${item.course}`}
                          onClick={() => setSelectedOrder(null)}
                          className="block truncate text-sm font-medium text-richblack-5 hover:text-yellow-50"
                        >
                          {item.courseName}
                        </Link>
                        {item.instructorName && (
                          <p className="truncate text-xs text-richblack-400">
                            {item.instructorName}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold text-yellow-50">
                      {Number(item.priceAtPurchase) === 0 ? "Free" : `₹${item.priceAtPurchase}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg bg-richblack-700 px-4 py-2 text-sm font-medium text-richblack-100 hover:bg-richblack-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
