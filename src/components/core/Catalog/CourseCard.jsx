import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RatingStars from "../../common/RatingStars";
import GetAvgRating from "../../../utils/avgRating";

const CourseCard = ({ course, Height }) => {
  const [avgReviewCount, setAvgReviewCount] = useState(0);

  useEffect(() => {
    // Recalculate the average rating whenever the course object changes
    const count = GetAvgRating(course.ratingAndReviews);
    setAvgReviewCount(count);
  }, [course]);

  return (
    <Link to={`/courses/${course._id}`}>
      <div className="hover:scale-[1.02] transition-transform duration-200">
        {/* Thumbnail */}
        <div className="rounded-lg overflow-hidden">
          <img
            src={course?.thumbnail}
            alt={course?.courseName}
            className={`${Height} w-full rounded-xl object-cover`}
          />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2 px-1 py-3">
          <p className="text-xl text-richblack-5">{course?.courseName}</p>
          <p className="text-sm text-richblack-50">
            {course?.instructor?.firstName} {course?.instructor?.lastName}
          </p>

          {/* Rating row */}
          <div className="flex items-center gap-2">
            <span className="text-yellow-5">{avgReviewCount || 0}</span>
            <RatingStars Review_Count={avgReviewCount} />
            <span className="text-richblack-400">
              {course?.ratingAndReviews?.length} Ratings
            </span>
          </div>

          <p className="text-xl text-richblack-5">
            {Number(course?.price) === 0 ? (
              <span className="font-semibold text-caribbeangreen-100">Free</span>
            ) : (
              <>₹ {course?.price}</>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
