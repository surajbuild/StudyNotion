import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import RenderCartCourses from "./renderCartCourses";
import RenderTotalAmount from "./renderTotalAmount";
import { fetchUserCart } from "../../../../services/operations/cartAPI";

export default function Cart() {
  const dispatch = useDispatch();
  const { totalItems, loading, error } = useSelector((state) => state.cart);
  const { token } = useSelector((state) => state.auth);
  const [removedNotice, setRemovedNotice] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadCart = async () => {
      if (!token) return;
      const data = await fetchUserCart(token, dispatch);
      if (isMounted && data?.removedUnavailableCount > 0) {
        setRemovedNotice(data.removedUnavailableCount);
      }
    };
    loadCart();
    return () => {
      isMounted = false;
    };
  }, [token, dispatch]);

  const handleRetry = () => {
    if (token) {
      fetchUserCart(token, dispatch);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full">
      <div className="mx-auto w-11/12 max-w-[1000px] py-10">
        <h1 className="mb-8 text-3xl font-medium text-richblack-5 lg:mb-14">
          My Wishlist
        </h1>

        <p className="border-b border-b-richblack-400 pb-2 text-sm font-semibold text-richblack-400 lg:text-base">
          {totalItems} {totalItems === 1 ? "Course" : "Courses"} in Wishlist
        </p>

        {removedNotice > 0 && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-yellow-50/30 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-50"
          >
            {removedNotice} unavailable or already-enrolled{" "}
            {removedNotice === 1 ? "course was" : "courses were"} automatically removed
            from your cart.
          </div>
        )}

        {loading && totalItems === 0 ? (
          <div
            role="status"
            aria-label="Loading cart"
            className="mt-14 flex flex-col items-center justify-center gap-3"
          >
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
            <p className="text-sm text-richblack-300">Loading your saved cart...</p>
          </div>
        ) : error && totalItems === 0 ? (
          <div
            role="alert"
            className="mt-8 flex flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
          >
            <p className="text-base font-semibold text-pink-200">
              Could not load your cart
            </p>
            <p className="text-sm text-richblack-300">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
            >
              Retry
            </button>
          </div>
        ) : totalItems > 0 ? (
          <div className="mt-6 flex flex-col items-start gap-6 lg:mt-8 lg:flex-row lg:gap-x-10">
            <RenderCartCourses />
            <RenderTotalAmount />
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-4 text-center lg:mt-14">
            <p className="text-2xl text-richblack-100 lg:text-3xl">
              Your Cart is Empty
            </p>
            <Link
              to="/courses"
              className="rounded-lg bg-yellow-50 px-5 py-2.5 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
            >
              Browse Courses
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
