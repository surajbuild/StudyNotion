import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { FaStar } from "react-icons/fa";
import { RiDeleteBin6Line } from "react-icons/ri";
import ReactStars from "react-rating-stars-component";
import GetAvgRating from "../../../../utils/avgRating";
import { removeCourseFromCart } from "../../../../services/operations/cartAPI";

const RenderCartCourses = () => {
  const dispatch = useDispatch();
  const { cart } = useSelector((state) => state.cart);
  const { token } = useSelector((state) => state.auth);
  const [removingId, setRemovingId] = useState(null);

  const handleRemove = async (courseId) => {
    if (removingId) return;
    setRemovingId(courseId);
    await removeCourseFromCart(courseId, token, dispatch);
    setRemovingId(null);
  };

  return (
    <div className="flex flex-1 flex-col">
      {cart.map((course, indx) => {
        const avgRating = GetAvgRating(course?.ratingAndReviews);
        return (
          <div
            key={course._id}
            className={`flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6 ${
              indx !== cart.length - 1 && "border-b border-b-richblack-400 pb-6"
            } ${indx !== 0 && "mt-6"} `}
          >
            {/* Course Image and Details */}
            <div className="flex w-full flex-1 flex-col gap-4 sm:flex-row sm:gap-4 lg:gap-6">
              <Link to={`/courses/${course._id}`} className="flex-shrink-0">
                <img
                  src={course?.thumbnail}
                  alt={course?.courseName}
                  className="h-[148px] w-full rounded-lg object-cover sm:h-[120px] sm:w-[180px] lg:h-[148px] lg:w-[220px]"
                />
              </Link>
              <div className="flex flex-col space-y-1">
                <Link
                  to={`/courses/${course._id}`}
                  className="text-lg font-medium text-richblack-5 hover:text-yellow-50"
                >
                  {course?.courseName}
                </Link>
                <p className="text-sm text-richblack-300">
                  {course?.category?.name}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-yellow-5">{avgRating || 0}</span>
                  <ReactStars
                    count={5}
                    value={avgRating}
                    size={20}
                    edit={false}
                    activeColor="#ffd700"
                    emptyIcon={<FaStar />}
                    fullIcon={<FaStar />}
                  />
                  <span className="text-sm text-richblack-400">
                    {course?.ratingAndReviews?.length || 0} Ratings
                  </span>
                </div>
              </div>
            </div>

            {/* Remove Button and Price */}
            <div className="flex w-full flex-row items-center justify-between sm:w-auto sm:flex-col sm:items-end sm:space-y-2">
              <button
                type="button"
                disabled={removingId === course._id}
                onClick={() => handleRemove(course._id)}
                className="flex items-center gap-x-1 rounded-md border border-richblack-600 bg-richblack-700 px-3 py-2 text-pink-200 transition-all duration-200 hover:scale-95 disabled:opacity-50 sm:px-[12px] sm:py-3"
              >
                <RiDeleteBin6Line />
                <span className="text-sm">
                  {removingId === course._id ? "Removing..." : "Remove"}
                </span>
              </button>
              <p className="text-2xl font-medium text-yellow-100 sm:mb-6 sm:text-3xl">
                {Number(course?.price) === 0 ? (
                  <span className="text-caribbeangreen-100">Free</span>
                ) : (
                  <>₹ {course?.price}</>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RenderCartCourses;
