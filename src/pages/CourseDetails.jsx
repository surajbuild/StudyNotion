import React, { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-hot-toast"
import { BiInfoCircle } from "react-icons/bi"
import { HiOutlineGlobeAlt } from "react-icons/hi"

import {buyCourse}  from "../services/operations/studentFeatureAPI"
import { fetchCourseDetails } from "../services/operations/courseDetailsAPI"
import GetAvgRating from "../utils/avgRating"
import { formatDate } from "../services/formatDate"
import { ACCOUNT_TYPE } from "../utils/constants"
import { addToCart } from "../slices/cartSlice"

import ConfirmationModal from "../components/common/ConfirmationModal"
import CourseAccordionBar from "../components/core/Course/CourseAccordionBar"
import CourseDetailsCard from "../components/core/Course/CourseDetailsCard"
import RatingStars from "../components/common/RatingStars"
import Footer from "../components/common/Footer"
import Error from "./Error"

const CourseDetails = () => {
  const { user } = useSelector((state) => state.profile)
  const { token } = useSelector((state) => state.auth)
  const { loading } = useSelector((state) => state.profile)
  const { paymentLoading } = useSelector((state) => state.course)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { courseId } = useParams()

  // ─── State ────────────────────────────────────────────────────────────────
  // fetchCourseDetails returns response.data.data which has shape:
  //   { courseDetails: {...}, totalDuration: "Xh Ym" }
  const [courseData, setCourseData] = useState(null)
  const [confirmationModal, setConfirmationModal] = useState(null)
  const [avgReviewCount, setAvgReviewCount] = useState(0)
  const [totalNoOfLectures, setTotalNoOfLectures] = useState(0)
  const [isActive, setIsActive] = useState([])

  // ─── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const getCourseFullDetails = async () => {
      try {
        // fetchCourseDetails already extracts response.data.data
        const result = await fetchCourseDetails(courseId)
        setCourseData(result)
      } catch (error) {
        console.error("Could not fetch course details:", error)
      }
    }
    getCourseFullDetails()
  }, [courseId])

  // ─── Derived state ────────────────────────────────────────────────────────
  useEffect(() => {
    const count = GetAvgRating(courseData?.courseDetails?.ratingAndReviews)
    setAvgReviewCount(count)
  }, [courseData])

  useEffect(() => {
    let lectures = 0
    courseData?.courseDetails?.courseContent?.forEach((sec) => {
      // ✅ FIX: was sec.subSEction (capital E typo) — always returned undefined → crash
      lectures += sec.subSection?.length || 0
    })
    setTotalNoOfLectures(lectures)
  }, [courseData])

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleActive = (id) => {
    setIsActive((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  const handleBuyCourse = () => {
    if (user && user?.accountType === ACCOUNT_TYPE.INSTRUCTOR) {
      toast.error("Instructors cannot purchase courses.")
      return
    }
    if (token) {
      buyCourse(token, [courseId], user, navigate, dispatch)
      return
    }
    setConfirmationModal({
      text1: "You are not logged in",
      text2: "Please login to purchase the course",
      btn1Text: "Login",
      btn2Text: "Cancel",           // ✅ FIX: was "Calcle"
      btn1Handler: () => navigate("/login"),
      btn2Handler: () => setConfirmationModal(null),
    })
  }

  // ─── Loading / error states ───────────────────────────────────────────────
  if (loading || paymentLoading || !courseData) {
    return (
      <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center">
        <div className="spinner" />
      </div>
    )
  }

  // fetchCourseDetails returns null on API failure
  if (!courseData?.courseDetails) {
    return <Error />
  }

  // ─── Destructure ──────────────────────────────────────────────────────────
  // ✅ FIX: courseData is already the inner data object ({ courseDetails, totalDuration })
  //         NOT courseData.data.courseDetails
  const {
    courseName,
    courseDescription,
    thumbnail,
    price,
    whatYouWillLearn,
    courseContent,
    ratingAndReviews,
    instructor,
    studentEnrolled,
    createdAt,
  } = courseData.courseDetails

  const totalDuration = courseData?.totalDuration

  return (
    <>
      {/* ── Hero / Dark banner ──────────────────────────────────────────── */}
      <div className="relative w-full bg-richblack-800">
        <div className="mx-auto box-content px-4 lg:w-[1260px] 2xl:relative">
          <div className="mx-auto grid min-h-[450px] max-w-maxContentTab justify-items-center py-8 lg:mx-0 lg:justify-items-start lg:py-0 xl:max-w-[810px]">

            {/* Mobile thumbnail */}
            <div className="relative block max-h-[30rem] lg:hidden">
              <div className="absolute bottom-0 left-0 h-full w-full shadow-[#161D29_0px_-64px_36px_-28px_inset]" />
              <img src={thumbnail} alt="course thumbnail" className="aspect-auto w-full" />
            </div>

            {/* Course meta */}
            <div className="z-30 my-5 flex flex-col justify-center gap-4 py-5 text-lg text-richblack-5">
              <p className="text-4xl font-bold text-richblack-5 sm:text-[42px]">
                {courseName}
              </p>
              <p className="text-richblack-200">{courseDescription}</p>

              <div className="text-md flex flex-wrap items-center gap-2">
                <span className="text-yellow-25">{avgReviewCount}</span>
                <RatingStars Review_Count={avgReviewCount} Star_Size={24} />
                <span>{`(${ratingAndReviews?.length ?? 0} reviews)`}</span>
                <span>{`${studentEnrolled?.length ?? 0} students enrolled`}</span>
              </div>

              <p>
                Created By{" "}
                <span className="font-semibold">
                  {instructor?.firstName} {instructor?.lastName}
                </span>
              </p>

              <div className="flex flex-wrap gap-5 text-lg">
                <p className="flex items-center gap-2">
                  <BiInfoCircle /> Created at {formatDate(createdAt)}
                </p>
                <p className="flex items-center gap-2">
                  <HiOutlineGlobeAlt /> English
                </p>
              </div>
            </div>

            {/* Mobile buy strip */}
            <div className="flex w-full flex-col gap-4 border-y border-y-richblack-500 py-4 lg:hidden">
              <p className="space-x-3 pb-2 text-3xl font-semibold text-richblack-5">
                Rs. {price}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  className="yellowButton flex-1 text-center justify-center"
                  onClick={
                    user && studentEnrolled?.includes(user?._id)
                      ? () => navigate("/dashboard/enrolled-courses")
                      : handleBuyCourse
                  }
                >
                  {user && studentEnrolled?.includes(user?._id)
                    ? "Go To Course"
                    : "Buy Now"}
                </button>
                {(!user || !studentEnrolled?.includes(user?._id)) && (
                  <button
                    onClick={() => {
                      if (user && user?.accountType === ACCOUNT_TYPE.INSTRUCTOR) {
                        toast.error("You are an Instructor. You can't buy a course.")
                        return
                      }
                      if (token) {
                        dispatch(addToCart(courseData?.courseDetails))
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
                    }}
                    className="blackButton flex-1 text-center justify-center"
                  >
                    Add to Cart
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop CourseDetailsCard (sticky right panel) */}
          <div className="right-[1rem] top-[60px] mx-auto hidden min-h-[600px] w-1/3 max-w-[410px] translate-y-24 md:translate-y-0 lg:absolute lg:block">
            <CourseDetailsCard
              course={courseData?.courseDetails}
              setConfirmationModal={setConfirmationModal}
              handleBuyCourse={handleBuyCourse}
            />
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="mx-auto box-content px-4 text-start text-richblack-5 lg:w-[1260px]">
        <div className="mx-auto max-w-maxContentTab lg:mx-0 xl:max-w-[810px]">

          {/* What You'll Learn */}
          <div className="my-8 border border-richblack-600 p-8">
            <p className="text-3xl font-semibold">What you'll learn</p>
            {/* ✅ FIX: was "What You Woll learn" */}
            <div className="mt-5 whitespace-pre-line text-richblack-200">
              {whatYouWillLearn}
            </div>
          </div>

          {/* Course Content */}
          <div className="max-w-[830px]">
            <div className="flex flex-col gap-3">
              <p className="text-[28px] font-semibold">Course Content</p>
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex gap-2 text-richblack-200">
                  <span>{courseContent?.length} section(s)</span>
                  <span>•</span>
                  <span>{totalNoOfLectures} lecture(s)</span>
                  <span>•</span>
                  <span>{totalDuration} total length</span>
                </div>
                <button
                  className="text-yellow-25"
                  onClick={() =>
                    setIsActive(
                      isActive.length === courseContent?.length
                        ? []
                        : courseContent?.map((sec) => sec._id)
                    )
                  }
                >
                  {isActive.length === courseContent?.length
                    ? "Collapse all sections"
                    : "Expand all sections"}
                </button>
              </div>
            </div>

            {/* ✅ FIX: CourseAccordionBar was never imported or rendered */}
            <div className="py-4">
              {courseContent?.map((section, index) => (
                <CourseAccordionBar
                  course={section}
                  key={index}
                  isActive={isActive}
                  handleActive={handleActive}
                />
              ))}
            </div>

            {/* Author */}
            <div className="mb-12 py-4">
              <p className="text-[28px] font-semibold">Author</p>
              <div className="flex items-center gap-4 py-4">
                <img
                  src={
                    instructor?.image ||
                    `https://api.dicebear.com/5.x/initials/svg?seed=${instructor?.firstName} ${instructor?.lastName}`
                  }
                  alt="Author"
                  className="h-14 w-14 rounded-full object-cover"
                />
                <p className="text-lg font-semibold">
                  {instructor?.firstName} {instructor?.lastName}
                </p>
              </div>
              <p className="text-richblack-50">
                {instructor?.additionalDetails?.about}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {confirmationModal && (
        <ConfirmationModal modalData={confirmationModal} />
      )}
    </>
  )
}

export default CourseDetails
