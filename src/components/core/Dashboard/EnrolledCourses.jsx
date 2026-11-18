import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-hot-toast'
import { getUserEnrolledCourses } from '../../../services/operations/profileAPI'
import ProgressBar from '@ramonak/react-progress-bar'
import { useNavigate } from 'react-router-dom'

const EnrolledCourses = () => {
    const { token } = useSelector((state) => state.auth)
    const navigate = useNavigate()

    const [enrolledCourses, setEnrolledCourses] = useState(null)

    useEffect(() => {
        const getEnrolledCourses = async () => {
            try {
                const response = await getUserEnrolledCourses(token)
                setEnrolledCourses(response)
            } catch (error) {
                console.log('Unable to Fetch Enrolled Courses')
            }
        }
        getEnrolledCourses()
    }, [token])

    return (
        <div className="text-richblack-5">
            <div className="mb-14 text-3xl font-medium text-richblack-50">
                Enrolled Courses
            </div>
            {!enrolledCourses ? (
                <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center">
                    <div className="spinner"></div>
                </div>
            ) : !enrolledCourses.length ? (
                <p className="grid h-[10vh] w-full place-content-center text-richblack-5">
                    You have not enrolled in any course yet.
                </p>
            ) : (
                <div className="my-8 text-richblack-5">
                    {/* Headings - Hidden on mobile, shown on tablet+ */}
                    <div className="hidden rounded-t-lg bg-richblack-500 lg:flex">
                        <p className="w-[45%] px-5 py-3 font-medium">Course Name</p>
                        <p className="w-1/4 px-2 py-3 font-medium">Duration</p>
                        <p className="flex-1 px-2 py-3 font-medium">Progress</p>
                    </div>

                    {/* Course Cards/Rows */}
                    <div className="space-y-4 lg:space-y-0">
                        {enrolledCourses.map((course, i, arr) => (
                            <div
                                className={`
                                    flex flex-col gap-4 border border-richblack-700 
                                    bg-richblack-800 p-4
                                    lg:flex-row lg:items-center lg:gap-0 lg:bg-richblack-900 lg:p-0
                                    ${i === 0 ? 'rounded-t-lg' : ''}
                                    ${i === arr.length - 1 ? 'rounded-b-lg' : ''}
                                    lg:rounded-none
                                    ${i === arr.length - 1 ? 'lg:rounded-b-lg' : ''}
                                `}
                                key={i}
                            >
                                {/* Course Info */}
                                <div
                                    className="flex cursor-pointer items-start gap-4 lg:w-[45%] lg:items-center lg:px-5 lg:py-3"
                                    onClick={() => {
                                        const firstSectionId = course.courseContent?.[0]?._id
                                        const firstSubSectionId = course.courseContent?.[0]?.subSection?.[0]?._id
                                        if (!firstSectionId || !firstSubSectionId) {
                                            toast.error('This course does not have any lectures uploaded yet.')
                                            return
                                        }
                                        navigate(
                                            `/view-course/${course?._id}/section/${firstSectionId}/sub-section/${firstSubSectionId}`
                                        )
                                    }}
                                >
                                    <img
                                        src={course.thumbnail}
                                        alt="course_img"
                                        className="h-14 w-14 rounded-lg object-cover lg:h-14 lg:w-14"
                                    />
                                    <div className="flex max-w-xs flex-col gap-2">
                                        <p className="text-lg font-semibold lg:text-base">
                                            {course.courseName}
                                        </p>
                                        <p className="text-xs text-richblack-300">
                                            {(course.courseDescription || '').length > 50
                                                ? `${course.courseDescription.slice(0, 50)}...`
                                                : course.courseDescription || ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Duration - Mobile label shown */}
                                <div className="flex items-center justify-between lg:w-1/4 lg:justify-start lg:px-2 lg:py-3">
                                    <span className="font-medium text-richblack-300 lg:hidden">
                                        Duration:
                                    </span>
                                    <span className="text-richblack-50">
                                        {course?.totalDuration || 'N/A'}
                                    </span>
                                </div>

                                {/* Progress - Mobile label shown */}
                                <div className="flex flex-1 flex-col gap-2 lg:px-2 lg:py-3">
                                    <div className="flex items-center justify-between lg:justify-start">
                                        <span className="font-medium text-richblack-300 lg:hidden">
                                            Progress:
                                        </span>
                                        <p className="text-richblack-50">
                                            {course.progressPercentage || 0}%
                                        </p>
                                    </div>
                                    <ProgressBar
                                        completed={course.progressPercentage || 0}
                                        height="8px"
                                        isLabelVisible={false}
                                        bgColor="#47A5C5"
                                        baseBgColor="#2C333F"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default EnrolledCourses
