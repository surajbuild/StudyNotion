import React from "react"
import copy from "copy-to-clipboard"
import { toast } from "react-hot-toast"
import { BsFillCaretRightFill } from "react-icons/bs"
import { FaShareSquare } from "react-icons/fa"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"

import { addCourseToCart } from "../../../services/operations/cartAPI"
import { ACCOUNT_TYPE } from "../../../utils/constants"



function CourseDetailsCard({
  course,
  setConfirmationModal,
  handleBuyCourse,
  handleFreeEnroll,
  isEnrolling = false,
}) {
  const { user } = useSelector((state) => state.profile)
  const { token } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const {
    thumbnail: ThumbnailImage,
    price: CurrentPrice,
  } = course

  const isFreeCourse = Number(CurrentPrice) === 0
  const isAlreadyEnrolled = Boolean(
    user &&
      (course?.studentEnrolled?.some((id) => String(id) === String(user._id)) ||
        user?.courses?.some((id) => String(id?._id || id) === String(course?._id)))
  )

  const handleShare = () => {
    copy(window.location.href)
    toast.success("Link copied to clipboard")
  }

  const handleAddToCart = () => {
    if (user && user?.accountType !== ACCOUNT_TYPE.STUDENT) {
      toast.error("Only students can add courses to the cart.")
      return
    }
    if (token) {
      addCourseToCart(course, token, dispatch)
      return
    }
    setConfirmationModal({
      text1: "You are not logged in!",
      text2: "Please login to add To Cart",
      btn1Text: "Login",
      btn2Text: "Cancel",
      btn1Handler: () => navigate("/login"),
      btn2Handler: () => setConfirmationModal(null),
    })
  }

  // console.log("Student already enrolled ", course?.studentsEnroled, user?._id)

  return (
    <>
      <div
        className={`flex flex-col gap-4 rounded-md bg-richblack-700 p-4 text-richblack-5`}
      >
        {/* Course Image */}
        <img
          src={ThumbnailImage}
          alt={course?.courseName}
          className="max-h-[300px] min-h-[180px] w-[400px] overflow-hidden rounded-2xl object-cover md:max-w-full"
        />

        <div className="px-4">
          <div className="space-x-3 pb-4 text-3xl font-semibold">
            {isFreeCourse ? (
              <span className="text-caribbeangreen-100">Free</span>
            ) : (
              <>Rs. {CurrentPrice}</>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <button
              disabled={isEnrolling}
              className="yellowButton disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={
                isAlreadyEnrolled
                  ? () => navigate("/dashboard/enrolled-courses")
                  : isFreeCourse && handleFreeEnroll
                  ? handleFreeEnroll
                  : handleBuyCourse
              }
            >
              {isAlreadyEnrolled
                ? "Go To Course"
                : isFreeCourse
                ? isEnrolling
                  ? "Enrolling..."
                  : "Enroll Now"
                : "Buy Now"}
            </button>
            {!isAlreadyEnrolled && !isFreeCourse && (
              <button onClick={handleAddToCart} className="blackButton">
                Add to Cart
              </button>
            )}
          </div>
          <div>
            <p className="pb-3 pt-6 text-center text-sm text-richblack-25">
              {isFreeCourse ? "Free Lifetime Access" : "30-Day Money-Back Guarantee"}
            </p>
          </div>

          <div className={``}>
            <p className={`my-2 text-xl font-semibold `}>
              This Course Includes :
            </p>
            <div className="flex flex-col gap-3 text-sm text-caribbeangreen-100">
              {(course?.instructions || [])
                .flatMap((item) => {
                  if (typeof item === "string" && item.trim().startsWith("[")) {
                    try {
                      const parsed = JSON.parse(item)
                      return Array.isArray(parsed) ? parsed : [item]
                    } catch {
                      return [item]
                    }
                  }
                  return [item]
                })
                .filter(Boolean)
                .map((item, i) => {
                  return (
                    <p className={`flex gap-2`} key={i}>
                      <BsFillCaretRightFill />
                      <span>{item}</span>
                    </p>
                  )
                })}
            </div>
          </div>
          <div className="text-center">
            <button
              className="mx-auto flex items-center gap-2 py-6 text-yellow-100 "
              onClick={handleShare}
            >
              <FaShareSquare size={15} /> Share
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default CourseDetailsCard