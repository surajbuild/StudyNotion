import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useParams } from 'react-router-dom'
import {
  getFullDetailsOfCourse,
} from '../services/operations/courseDetailsAPI'
import {
  setCompletedLectures,
  setCourseSectionData,
  setEntireCourseData,
  setTotalNoOfLectures,
} from '../slices/viewCourseSlice'
import VideoDetailsSidebar from '../components/core/ViewCourse/VideoDetailsSidebar'
import CourseReviewModal   from '../components/core/ViewCourse/CourseReviewModal'

const ViewCourse = () => {
  const [reviewModal, setReviewModal] = useState(false)
  const { courseId } = useParams()
  const { token }    = useSelector((state) => state.auth)
  const dispatch     = useDispatch()

  useEffect(() => {
    const setCourseSpecificDetails = async () => {
      const courseData = await getFullDetailsOfCourse(courseId, token)
      if (!courseData) return

      dispatch(setCourseSectionData(courseData.courseDetails.courseContent))
      dispatch(setEntireCourseData(courseData.courseDetails))
      dispatch(setCompletedLectures(courseData.completedVideos))

      let lectures = 0
      courseData?.courseDetails?.courseContent?.forEach((sec) => {
        lectures += sec.subSection.length
      })
      dispatch(setTotalNoOfLectures(lectures))
    }
    setCourseSpecificDetails()
  }, [courseId, token, dispatch])

  return (
    <>
      <div className="flex min-h-screen bg-richblack-900">

        {/* Sidebar — fixed on desktop, slide-over on mobile */}
        <VideoDetailsSidebar setReviewModal={setReviewModal} />

        {/* Main content — offset on large screens where sidebar is always visible */}
        <main className="flex-1 lg:ml-[320px] overflow-x-hidden">
          <Outlet />
        </main>

      </div>

      {/* Review modal portal */}
      {reviewModal && (
        <CourseReviewModal setReviewModal={setReviewModal} />
      )}
    </>
  )
}

export default ViewCourse
