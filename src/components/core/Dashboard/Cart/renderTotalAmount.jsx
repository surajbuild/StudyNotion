import React from "react";
import { useSelector, useDispatch } from "react-redux";
import IconBtn from "../../../common/IconBtn";
import { useNavigate } from "react-router-dom";
import { buyCourse, enrollFreeCourse } from "../../../../services/operations/studentFeatureAPI";

const RenderTotalAmount = () => {
  const { total, cart } = useSelector((state) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);
  const { paymentLoading } = useSelector((state) => state.course);

  const freeCount = cart.filter((c) => Number(c?.price) === 0).length;
  const paidCount = cart.filter((c) => Number(c?.price) > 0).length;
  const isFreeCart = cart.length > 0 && Number(total) === 0;
  const isMixedCart = freeCount > 0 && paidCount > 0;

  const handleBuyCourse = () => {
    if (paymentLoading) return;
    const courses = cart.map((course) => course._id);
    if (isFreeCart) {
      enrollFreeCourse(token, courses, user, navigate, dispatch);
      return;
    }
    buyCourse(token, courses, user, navigate, dispatch);
  };

  return (
    <div className="w-full min-w-full rounded-md border-[1px] border-richblack-700 bg-richblack-800 p-6 sm:min-w-[280px] sm:max-w-[400px] lg:sticky lg:top-10 lg:max-w-[300px]">
      <p className="mb-1 text-sm font-medium text-richblack-300">Total:</p>
      <p className="mb-3 text-3xl font-medium text-yellow-100">
        {isFreeCart ? (
          <span className="text-caribbeangreen-100">Free</span>
        ) : (
          <>₹ {total}</>
        )}
      </p>

      {isMixedCart && (
        <p className="mb-4 text-xs text-richblack-300">
          Includes {freeCount} free {freeCount === 1 ? "course" : "courses"} (₹0) +{" "}
          {paidCount} paid {paidCount === 1 ? "course" : "courses"}. You are only charged
          for paid courses.
        </p>
      )}

      <IconBtn
        text={
          isFreeCart
            ? paymentLoading
              ? "Enrolling..."
              : "Enroll Now"
            : paymentLoading
            ? "Processing..."
            : "Buy Now"
        }
        disabled={paymentLoading}
        onClick={handleBuyCourse}
        customClasses="w-full justify-center mt-2"
      />
    </div>
  );
};

export default RenderTotalAmount;
