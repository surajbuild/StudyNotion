import React, { useEffect, useState } from 'react'

import { FaStar } from 'react-icons/fa'
import { Swiper, SwiperSlide } from "swiper/react"
import "swiper/css"
import "swiper/css/free-mode"
import "swiper/css/pagination"
import { Autoplay, FreeMode, Pagination } from 'swiper/modules'
import ReactStars from "react-rating-stars-component"
import { apiConnector } from '../../services/apiconnector'
import { ratingsEndpoints } from '../../services/apis'

const ReviewSlider = () => {
  const [reviews, setReviews] = useState([])
  const truncateWords = 15

  const truncateText = (text, maxWords) => {
    if (!text) return ""
    const words = text.trim().split(/\s+/)
    if (words.length <= maxWords) return text
    return words.slice(0, maxWords).join(" ") + "..."
  }

  useEffect(() => {
    const fetchAllReviews = async () => {
      try {
        const response = await apiConnector("GET", ratingsEndpoints.REVIEWS_DETAILS_API)
        const { data } = response
        if (data?.success) {
          setReviews(data?.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch reviews", error)
      }
    }
    fetchAllReviews()
  }, [])

  return (
    <div className="flex w-full items-center justify-center bg-richblack-900 py-12">
      {/* Outer Card Container */}
      <div className="w-full max-w-6xl rounded-xl bg-richblack-800 p-6 shadow-2xl">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-richblack-300">
            No learner reviews yet.
          </p>
        ) : (
        <Swiper
          slidesPerView={1}
          spaceBetween={25}
          loop={reviews.length > 3}
          freeMode={true}
          autoplay={{
            delay: 2500,
            disableOnInteraction: false,
          }}
          breakpoints={{
            640: { slidesPerView: 2 },
            768: { slidesPerView: 3 }, // 3 slides on tablets and desktops
          }}
          modules={[FreeMode, Pagination, Autoplay]}
          wrapperClass="review-slider-wrapper" // Custom class for equal height
          className="w-full"
        >
          {reviews.map((review, index) => (
            <SwiperSlide key={index}>
              {/* Inner Card (Slide Content) */}
              <div className="flex h-full w-full flex-col gap-3 rounded-lg bg-richblack-900 p-4 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <img
                    src={
                      review?.user?.image
                        ? review.user.image
                        : `https://api.dicebear.com/9.x/initials/svg?seed=${review?.user?.firstName} ${review?.user?.lastName}`
                    }
                    alt={`${review?.user?.firstName} ${review?.user?.lastName}`}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-richblack-600"
                  />
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-richblack-5">
                      {review?.user?.firstName} {review?.user?.lastName}
                    </p>
                    <p className="text-xs font-medium text-richblack-400">
                      {review?.course?.courseName}
                    </p>
                  </div>
                </div>

                {/* Review Text */}
                <p className="text-sm font-normal leading-relaxed text-richblack-25">
                  {truncateText(review?.review, truncateWords)}
                </p>

                {/* Rating */}
                <div className="mt-auto flex items-center gap-2">
                  <span className="text-base font-bold text-yellow-100">
                    {review?.rating?.toFixed(1)}
                  </span>
                  <ReactStars
                    count={5}
                    value={review.rating}
                    size={18}
                    edit={false}
                    activeColor="#ffd700"
                    emptyIcon={<FaStar className="text-richblack-500" />}
                    fullIcon={<FaStar />}
                  />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        )}
      </div>

      {/* Custom styles to enforce equal height cards */}
      <style>{`
        .review-slider-wrapper {
          align-items: stretch !important;
        }
        .review-slider-wrapper .swiper-slide {
          height: auto !important;
          display: flex !important;
        }
      `}</style>
    </div>
  )
}

export default ReviewSlider