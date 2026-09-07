import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { BsChevronDown, BsChevronUp } from 'react-icons/bs'
import { IoArrowBack } from 'react-icons/io5'
import { MdPlayCircleOutline } from 'react-icons/md'
import { RiMenuFoldLine, RiMenuUnfoldLine } from 'react-icons/ri'
import IconBtn from '../../common/IconBtn'

const VideoDetailsSidebar = ({ setReviewModal }) => {
  const [activeStatus, setActiveStatus]   = useState('')
  const [videoBarActive, setVideoBarActive] = useState('')
  const [sidebarOpen, setSidebarOpen]     = useState(window.innerWidth >= 1024)

  const navigate = useNavigate()
  const { sectionId, subSectionId } = useParams()
  const location = useLocation()

  const {
    courseSectionData,
    courseEntireData,
    totalNoOfLectures,
    completedLectures,
  } = useSelector((state) => state.viewCourse)

  useEffect(() => {
    const setActiveFlags = () => {
      if (!courseSectionData.length) return

      const currentSectionIndex = courseSectionData.findIndex(
        (data) => data._id === sectionId
      )
      const currentSubsectionIndex =
        courseSectionData?.[currentSectionIndex]?.subSection.findIndex(
          (data) => data._id === subSectionId
        )
      const activeSubSectionId =
        courseSectionData[currentSectionIndex]?.subSection?.[currentSubsectionIndex]?._id

      setActiveStatus(courseSectionData?.[currentSectionIndex]?._id)
      setVideoBarActive(activeSubSectionId)
    }
    setActiveFlags()
  }, [courseSectionData, courseEntireData, location.pathname])

  const allComplete =
    completedLectures?.length === totalNoOfLectures && totalNoOfLectures > 0

  return (
    <>
      {/* ── Mobile / tablet toggle button ──────────────────────────────── */}
      <button
        onClick={() => setSidebarOpen((p) => !p)}
        className="fixed left-3 top-20 z-[60] flex items-center justify-center rounded-full bg-richblack-700 p-1.5 text-richblack-100 shadow-lg transition-all hover:bg-richblack-600 lg:hidden"
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <RiMenuFoldLine size={20} /> : <RiMenuUnfoldLine size={20} />}
      </button>

      {/* ── Mobile backdrop ────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <div
        className={`
          fixed left-0 top-0 z-50 flex h-screen flex-col
          border-r border-richblack-700 bg-richblack-800
          transition-transform duration-300
          w-[280px] lg:w-[320px]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* ── Top controls ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 border-b border-richblack-700 px-5 py-4">

          {/* Back + collapse row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard/enrolled-courses')}
              className="flex items-center gap-1.5 text-sm text-richblack-100 transition-all hover:text-richblack-5"
            >
              <IoArrowBack size={16} />
              <span>Back</span>
            </button>

            {/* Collapse sidebar (desktop only) */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="hidden text-richblack-400 transition-all hover:text-richblack-100 lg:block"
              title="Collapse sidebar"
            >
              <RiMenuFoldLine size={18} />
            </button>
          </div>

          {/* Course name + progress */}
          <div>
            <p className="text-sm font-semibold leading-snug text-richblack-5">
              {courseEntireData?.courseName}
            </p>
            <p className="mt-1 text-xs">
              <span
                className={
                  allComplete ? 'text-caribbeangreen-100' : 'text-yellow-50'
                }
              >
                {completedLectures?.length}
              </span>
              <span className="text-richblack-100">
                &nbsp;/&nbsp;{totalNoOfLectures}
              </span>
            </p>
          </div>

          {/* Add Review button */}
          <IconBtn
            text="Add Review"
            onClick={() => setReviewModal(true)}
            customClasses="w-full justify-center py-2 text-xs"
          />
        </div>

        {/* ── Sections list ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {courseSectionData.map((course, index) => (
            <div key={index}>

              {/* Section header */}
              <button
                onClick={() =>
                  setActiveStatus(
                    activeStatus === course?._id ? '' : course?._id
                  )
                }
                className="flex w-full items-center justify-between bg-richblack-700 px-5 py-3 text-left"
              >
                <span className="line-clamp-2 flex-1 pr-2 text-xs font-semibold uppercase tracking-wide text-richblack-5">
                  {course?.sectionName}
                </span>
                <div className="flex flex-shrink-0 items-center gap-2 text-richblack-200">
                  {course?.timeDuration && (
                    <span className="text-[10px]">{course.timeDuration}</span>
                  )}
                  {activeStatus === course?._id ? (
                    <BsChevronUp size={11} />
                  ) : (
                    <BsChevronDown size={11} />
                  )}
                </div>
              </button>

              {/* SubSection list */}
              {activeStatus === course?._id && (
                <div className="flex flex-col bg-richblack-800">
                  {course.subSection.map((topic, idx) => {
                    const isActive = videoBarActive === topic._id
                    const isDone   = completedLectures.includes(topic?._id)
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          navigate(
                            `/view-course/${courseEntireData?._id}/section/${course?._id}/sub-section/${topic?._id}`
                          )
                          setVideoBarActive(topic?._id)
                          // close sidebar on mobile after navigation
                          if (window.innerWidth < 1024) setSidebarOpen(false)
                        }}
                        className={`flex w-full items-center gap-2.5 border-l-[3px] px-5 py-3 text-left transition-all
                          ${
                            isActive
                              ? 'border-yellow-50 bg-richblack-900/60'
                              : 'border-transparent hover:bg-richblack-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => {}}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 cursor-default accent-yellow-50"
                        />

                        {isActive && (
                          <MdPlayCircleOutline
                            size={14}
                            className="flex-shrink-0 text-yellow-50"
                          />
                        )}

                        <span
                          className={`line-clamp-2 text-xs leading-snug
                            ${
                              isActive
                                ? 'font-medium text-yellow-50'
                                : isDone
                                ? 'text-caribbeangreen-100'
                                : 'text-richblack-100'
                            }`}
                        >
                          {topic.title}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Collapsed desktop toggle ───────────────────────────────────── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-20 z-50 hidden items-center justify-center rounded-full bg-richblack-700 p-1.5 text-richblack-100 shadow-lg transition-all hover:bg-richblack-600 lg:flex"
          title="Open sidebar"
        >
          <RiMenuUnfoldLine size={20} />
        </button>
      )}
    </>
  )
}

export default VideoDetailsSidebar
