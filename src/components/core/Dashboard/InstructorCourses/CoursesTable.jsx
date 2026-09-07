import { useSelector } from "react-redux"
import { Table, Tbody, Td, Th, Thead, Tr } from "react-super-responsive-table"
import "react-super-responsive-table/dist/SuperResponsiveTableStyle.css"
import { useState } from "react"
import { FaCheck } from "react-icons/fa"
import { FiEdit2 } from "react-icons/fi"
import { HiClock } from "react-icons/hi"
import { RiDeleteBin6Line } from "react-icons/ri"
import { useNavigate } from "react-router-dom"
import { formatDate } from "../../../../services/formatDate"
import {
  deleteCourse,
  fetchInstructorCourses,
  editCourseDetails,
} from "../../../../services/operations/courseDetailsAPI"
import { COURSE_STATUS } from "../../../../utils/constants"
import { calculateCourseDuration } from "../../../../utils/courseDuration"
import ConfirmationModal from "../../../common/ConfirmationModal"
import toast from "react-hot-toast"

export default function CoursesTable({ courses, setCourses }) {
  const navigate = useNavigate()
  const { token } = useSelector((state) => state.auth)
  const [loading, setLoading] = useState(false)
  const [confirmationModal, setConfirmationModal] = useState(null)
  const TRUNCATE_LENGTH = 30

  const handleCourseDelete = async (courseId) => {
    setLoading(true)
    try {
      const deleteResult = await deleteCourse({ courseId: courseId }, token)
      if (deleteResult) {
        const result = await fetchInstructorCourses(token)
        if (result) {
          setCourses(result)
        }
      }
    } catch (error) {
      console.error("Error deleting course:", error)
    } finally {
      setConfirmationModal(null)
      setLoading(false)
    }
  }

  // Handle course status toggle (Publish/Unpublish)
  const handleToggleStatus = async (course) => {
    const newStatus = course.status === COURSE_STATUS.PUBLISHED ? COURSE_STATUS.DRAFT : COURSE_STATUS.PUBLISHED
    
    // Validation before publishing
    if (newStatus === COURSE_STATUS.PUBLISHED) {
      const validationErrors = validateCourseForPublishing(course)
      if (validationErrors.length > 0) {
        toast.error(
          <div>
            <p className="font-semibold">Cannot publish course. Please complete:</p>
            <ul className="list-disc ml-4 mt-2 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-xs">{error}</li>
              ))}
            </ul>
          </div>,
          { 
            duration: 6000,
            style: {
              maxWidth: '500px',
            }
          }
        )
        return
      }
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("courseId", course._id)
      formData.append("status", newStatus)

      const result = await editCourseDetails(formData, token)
      
      if (result) {
        // Refresh courses list
        const updatedCourses = await fetchInstructorCourses(token)
        if (updatedCourses) {
          setCourses(updatedCourses)
        }
        toast.success(
          `Course ${newStatus === COURSE_STATUS.PUBLISHED ? "published" : "unpublished"} successfully!`
        )
      }
    } catch (error) {
      console.error("Error updating course status:", error)
      toast.error("Failed to update course status. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Validate course before publishing
  const validateCourseForPublishing = (course) => {
    const errors = []

    if (!course.courseName || course.courseName.trim() === "") {
      errors.push("Course name")
    }

    if (!course.courseDescription || course.courseDescription.trim() === "") {
      errors.push("Course description")
    }

    if (!course.thumbnail) {
      errors.push("Course thumbnail")
    }

    if (!course.price || course.price <= 0) {
      errors.push("Course price")
    }

    if (!course.category) {
      errors.push("Course category")
    }

    if (!course.whatYouWillLearn || course.whatYouWillLearn.trim() === "") {
      errors.push("What you will learn")
    }

    if (!course.instructions || course.instructions.length === 0) {
      errors.push("Course instructions")
    }

    if (!course.courseContent || course.courseContent.length === 0) {
      errors.push("At least one section")
    } else {
      // Check if sections have lectures
      const hasEmptySection = course.courseContent.some(
        section => !section.subSection || section.subSection.length === 0
      )
      if (hasEmptySection) {
        errors.push("All sections must have at least one lecture")
      }
    }

    return errors
  }

  return (
    <>
      <Table className="w-full rounded-xl border border-richblack-700 bg-richblack-800 overflow-hidden">
        <Thead>
          <Tr className="hidden md:flex gap-x-6 lg:gap-x-10 border-b border-richblack-700 px-6 py-3 bg-richblack-800">
            <Th className="flex-1 text-left text-xs font-medium uppercase tracking-wider text-richblack-100">
              Courses
            </Th>
            <Th className="w-28 lg:w-32 text-left text-xs font-medium uppercase tracking-wider text-richblack-100">
              Duration
            </Th>
            <Th className="w-24 lg:w-32 text-left text-xs font-medium uppercase tracking-wider text-richblack-100">
              Price
            </Th>
            <Th className="w-28 lg:w-32 text-left text-xs font-medium uppercase tracking-wider text-richblack-100">
              Status
            </Th>
            <Th className="w-24 text-left text-xs font-medium uppercase tracking-wider text-richblack-100">
              Actions
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {courses?.length === 0 ? (
            <Tr>
              <Td className="py-16 sm:py-20 text-center text-xl font-medium text-richblack-100" colSpan="5">
                <div className="flex flex-col items-center justify-center gap-3">
                  <p className="text-xl sm:text-2xl font-semibold text-richblack-5">No courses found</p>
                  <p className="text-sm text-richblack-300">Create your first course to get started</p>
                </div>
              </Td>
            </Tr>
          ) : (
            courses?.map((course) => (
              <Tr
                key={course._id}
                className="flex flex-col md:flex-row gap-4 md:gap-x-6 lg:gap-x-10 border-b border-richblack-700 p-4 sm:p-6 transition-all hover:bg-richblack-700/30"
              >
                {/* Course Image and Details */}
                <Td className="flex flex-col sm:flex-row flex-1 gap-4">
                  <img
                    src={course?.thumbnail}
                    alt={course?.courseName}
                    className="h-44 sm:h-36 w-full sm:w-56 rounded-lg object-cover"
                  />
                  <div className="flex flex-col justify-between py-1">
                    <div>
                      <p className="text-base sm:text-lg font-semibold text-richblack-5 line-clamp-2 sm:line-clamp-1">
                        {course.courseName}
                      </p>
                      <p className="mt-2 text-xs sm:text-sm text-richblack-300 line-clamp-2">
                        {course.courseDescription.split(" ").length > TRUNCATE_LENGTH
                          ? course.courseDescription
                              .split(" ")
                              .slice(0, TRUNCATE_LENGTH)
                              .join(" ") + "..."
                          : course.courseDescription}
                      </p>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-richblack-400">
                        Created: {formatDate(course.createdAt)}
                      </p>
                    </div>
                  </div>
                </Td>

                {/* Duration */}
                <Td className="flex items-center justify-between md:justify-start md:w-28 lg:w-32 text-sm font-medium text-richblack-100 py-1 border-t border-richblack-700 md:border-t-0 pt-3 md:pt-1">
                  <span className="text-xs uppercase tracking-wider text-richblack-400 font-semibold md:hidden">Duration:</span>
                  <span>{calculateCourseDuration(course)}</span>
                </Td>

                {/* Price */}
                <Td className="flex items-center justify-between md:justify-start md:w-24 lg:w-32 text-sm font-medium text-richblack-100 py-1">
                  <span className="text-xs uppercase tracking-wider text-richblack-400 font-semibold md:hidden">Price:</span>
                  <span className="text-yellow-50 font-semibold md:font-normal">₹{course.price}</span>
                </Td>

                {/* Status - Clickable */}
                <Td className="flex items-center justify-between md:justify-start md:w-28 lg:w-32 py-1">
                  <span className="text-xs uppercase tracking-wider text-richblack-400 font-semibold md:hidden">Status:</span>
                  <button
                    onClick={() => handleToggleStatus(course)}
                    disabled={loading}
                    className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-200 ${
                      course.status === COURSE_STATUS.PUBLISHED
                        ? "bg-richblack-700 hover:bg-richblack-600"
                        : "bg-pink-900 hover:bg-pink-800"
                    } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    title={`Click to ${course.status === COURSE_STATUS.PUBLISHED ? "unpublish" : "publish"}`}
                  >
                    {course.status === COURSE_STATUS.PUBLISHED ? (
                      <>
                        <div className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-50">
                          <FaCheck size={8} className="text-richblack-900" />
                        </div>
                        <p className="text-xs font-medium text-yellow-50">Published</p>
                      </>
                    ) : (
                      <>
                        <HiClock size={14} className="text-pink-200" />
                        <p className="text-xs font-medium text-pink-200">Draft</p>
                      </>
                    )}
                  </button>
                </Td>

                {/* Actions */}
                <Td className="flex items-center justify-between md:justify-start md:w-24 text-sm font-medium text-richblack-100 py-1">
                  <span className="text-xs uppercase tracking-wider text-richblack-400 font-semibold md:hidden">Actions:</span>
                  <div className="flex items-center gap-4">
                    <button
                      disabled={loading}
                      onClick={() => {
                        navigate(`/dashboard/edit-course/${course._id}`)
                      }}
                      title="Edit"
                      className="transition-all duration-200 hover:scale-110 hover:text-caribbeangreen-300 disabled:opacity-50"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => {
                        setConfirmationModal({
                          text1: "Do you want to delete this course?",
                          text2: "All the data related to this course will be deleted",
                          btn1Text: "Delete",
                          btn2Text: "Cancel",
                          btn1Handler: () => handleCourseDelete(course._id),
                          btn2Handler: () => setConfirmationModal(null),
                        })
                      }}
                      title="Delete"
                      className="transition-all duration-200 hover:scale-110 hover:text-pink-300 disabled:opacity-50"
                    >
                      <RiDeleteBin6Line size={18} />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
      {confirmationModal && <ConfirmationModal modalData={confirmationModal} />}
    </>
  )
}
