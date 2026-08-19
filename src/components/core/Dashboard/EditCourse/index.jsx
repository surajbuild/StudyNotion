import React, { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useParams, useNavigate } from "react-router-dom"
import RenderSteps from "../AddCourse/RenderSteps"
import { getFullDetailsOfCourse } from "../../../../services/operations/courseDetailsAPI"
import { setCourse, setEditCourse } from "../../../../slices/courseSlice"
import { IoMdArrowBack } from "react-icons/io"
import toast from "react-hot-toast"


export default function EditCourse() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { courseId } = useParams()
    const { course } = useSelector((state) => state.course)
    const { token } = useSelector((state) => state.auth)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        const populateCourseDetails = async () => {
            setLoading(true)
            setError(null)

            // Guard: ensure we have a valid-looking courseId before hitting the API
            if (!courseId || courseId === "undefined" || courseId === "null") {
                setError("Invalid course ID")
                toast.error("Invalid course ID")
                setLoading(false)
                return
            }

            const result = await getFullDetailsOfCourse(courseId, token)

            if (result?.courseDetails) {
                dispatch(setEditCourse(true))
                dispatch(setCourse(result.courseDetails))
            } else {
                setError("Course not found or you don't have permission to edit it.")
                toast.error("Course not found")
            }

            setLoading(false)
        }

        populateCourseDetails()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId])

    const handleBack = () => {
        // Clean up Redux state so the next course loaded starts fresh
        dispatch(setEditCourse(false))
        dispatch(setCourse(null))
        navigate("/dashboard/my-courses")
    }

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-3.5rem)] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="spinner" />
                    <p className="text-richblack-200">Loading course details...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-6">
                <div className="max-w-md rounded-lg border-2 border-pink-700 bg-pink-900/20 p-8 text-center">
                    <div className="mb-4 text-5xl">⚠️</div>
                    <h2 className="mb-3 text-2xl font-semibold text-richblack-5">Unable to Load Course</h2>
                    <p className="mb-6 text-richblack-200">{error}</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full rounded-md bg-yellow-50 px-6 py-3 font-semibold text-richblack-900 hover:bg-yellow-100 transition-all"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate("/dashboard/my-courses")}
                            className="w-full rounded-md border border-richblack-700 bg-richblack-800 px-6 py-3 font-semibold text-richblack-5 hover:bg-richblack-700 transition-all"
                        >
                            Back to My Courses
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!course) {
        return (
            <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-richblack-700 bg-richblack-800 p-12">
                <p className="text-lg text-richblack-5">Course not found</p>
                <button
                    onClick={() => navigate("/dashboard/my-courses")}
                    className="mt-4 rounded-md bg-yellow-50 px-6 py-3 font-semibold text-richblack-900 hover:bg-yellow-100 transition-all"
                >
                    Go to My Courses
                </button>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Back navigation */}
            <button
                onClick={handleBack}
                className="mb-6 flex items-center gap-2 text-sm text-richblack-300 hover:text-richblack-5 transition-colors"
            >
                <IoMdArrowBack size={16} />
                <span>Back to My Courses</span>
            </button>

            <div className="flex w-full items-start gap-x-6">
                {/* Multi-step form */}
                <div className="flex flex-1 flex-col">
                    <h1 className="mb-8 text-3xl font-medium text-richblack-5">Edit Course</h1>
                    <RenderSteps />
                </div>

                {/* Course Upload Tips panel — visible only on xl screens */}
                <div className="sticky top-10 hidden max-w-[400px] flex-1 rounded-md border border-richblack-700 bg-richblack-800 p-6 xl:block">
                    <p className="mb-6 flex items-center gap-2 text-base font-semibold text-richblack-5">
                        <span className="text-yellow-50">⚡</span> Course Upload Tips
                    </p>
                    <ul className="ml-5 list-disc space-y-3 text-xs text-richblack-5 marker:text-richblack-300">
                        <li>Set the Course Price option or make it free.</li>
                        <li>Standard size for the course thumbnail is 1024×576.</li>
                        <li>Video section controls the course overview video.</li>
                        <li>Course Builder is where you create & organize a course.</li>
                        <li>Add Topics in the Course Builder section to create lessons, quizzes, and assignments.</li>
                        <li>Information from the Additional Data section shows up on the course single page.</li>
                        <li>Make Announcements to notify any important notes to all enrolled students at once.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
