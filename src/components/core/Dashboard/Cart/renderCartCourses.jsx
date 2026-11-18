import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { FaStar } from "react-icons/fa"
import { RiDeleteBin6Line } from "react-icons/ri"
import { removeFromCart } from '../../../../slices/cartSlice'
import ReactStars from "react-rating-stars-component"

const RenderCartCourses = () => {
    const dispatch = useDispatch()
    const { cart } = useSelector((state) => state.cart)

    return (
        <div className="flex flex-1 flex-col">
            {cart.map((course, indx) => (
                <div
                    key={course._id}
                    className={`flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6 ${
                        indx !== cart.length - 1 && "border-b border-b-richblack-400 pb-6"
                    } ${indx !== 0 && "mt-6"} `}
                >
                    {/* Course Image and Details */}
                    <div className="flex w-full flex-1 flex-col gap-4 sm:flex-row sm:gap-4 lg:gap-6">
                        <img
                            src={course?.thumbnail}
                            alt={course?.courseName}
                            className="h-[148px] w-full rounded-lg object-cover sm:h-[120px] sm:w-[180px] lg:h-[148px] lg:w-[220px]"
                        />
                        <div className="flex flex-col space-y-1">
                            <p className="text-lg font-medium text-richblack-5">
                                {course?.courseName}
                            </p>
                            <p className="text-sm text-richblack-300">
                                {course?.category?.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-yellow-5">4.5</span>
                                <ReactStars
                                    count={5}
                                    value={4.5}
                                    size={20}
                                    edit={false}
                                    activeColor="#ffd700"
                                    emptyIcon={<FaStar />}
                                    fullIcon={<FaStar />}
                                />
                                <span className="text-sm text-richblack-400">
                                    {course?.ratingAndReviews?.length} Ratings
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Remove Button and Price */}
                    <div className="flex w-full flex-row items-center justify-between sm:w-auto sm:flex-col sm:items-end sm:space-y-2">
                        <button
                            onClick={() => dispatch(removeFromCart(course._id))}
                            className="flex items-center gap-x-1 rounded-md border border-richblack-600 bg-richblack-700 px-3 py-2 text-pink-200 transition-all duration-200 hover:scale-95 sm:px-[12px] sm:py-3"
                        >
                            <RiDeleteBin6Line />
                            <span className="text-sm">Remove</span>
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
            ))}
        </div>
    )
}

export default RenderCartCourses
