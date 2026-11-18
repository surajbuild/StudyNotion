import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { updateCompletedLectures } from '../../../slices/viewCourseSlice'
import { markLectureAsComplete } from '../../../services/operations/courseDetailsAPI'
import { getLectureNavigation } from '../../../utils/videoNavigation'
import { BigPlayButton, Player } from 'video-react'
import { AiFillPlayCircle } from 'react-icons/ai'
import { MdOutlineReplay } from 'react-icons/md'
import IconBtn from '../../common/IconBtn'
import 'video-react/dist/video-react.css'

const VideoDetails = () => {
  const { courseId, sectionId, subSectionId } = useParams()
  const navigate  = useNavigate()
  const dispatch  = useDispatch()
  const playerRef = useRef()
  const location  = useLocation()

  const { token } = useSelector((state) => state.auth)
  const { courseSectionData, courseEntireData, completedLectures } =
    useSelector((state) => state.viewCourse)

  const [videoData,     setVideoData]     = useState(null)
  const [videoEnded,    setVideoEnded]    = useState(false)
  const [loading,       setLoading]       = useState(false)
  const previewSource = courseEntireData?.thumbnail || ''

  /* ── Set video data from URL params ──────────────────────────────── */
  useEffect(() => {
    const setVideoSpecificDetails = async () => {
      if (!courseSectionData.length) return
      if (!courseId && !sectionId && !subSectionId) {
        navigate('/dashboard/enrolled-courses')
        return
      }
      const filteredSection = courseSectionData.find((c) => c._id === sectionId)
      const filteredSubSection = filteredSection?.subSection?.find(
        (s) => s._id === subSectionId
      )
      setVideoData(filteredSubSection || null)
      setVideoEnded(false)
    }
    setVideoSpecificDetails()
  }, [courseSectionData, courseEntireData, location.pathname, courseId, sectionId, subSectionId, navigate])

  /* ── Navigation helpers (safely skips empty sections) ────────────── */
  const lectureNav = useMemo(
    () => getLectureNavigation(courseSectionData, sectionId, subSectionId),
    [courseSectionData, sectionId, subSectionId]
  )

  const isFirstVideo = () => lectureNav.isFirst

  const isLastVideo = () => lectureNav.isLast

  const goToNextVideo = () => {
    if (!lectureNav.next) return
    navigate(
      `/view-course/${courseId}/section/${lectureNav.next.sectionId}/sub-section/${lectureNav.next.subSectionId}`
    )
  }

  const goToPrevVideo = () => {
    if (!lectureNav.prev) return
    navigate(
      `/view-course/${courseId}/section/${lectureNav.prev.sectionId}/sub-section/${lectureNav.prev.subSectionId}`
    )
  }

  /* ── Mark as complete ────────────────────────────────────────────── */
  const handleLectureCompletion = async () => {
    setLoading(true)
    const res = await markLectureAsComplete(
      { courseId, subsectionId: subSectionId },
      token
    )
    if (res) dispatch(updateCompletedLectures(subSectionId))
    setLoading(false)
  }

  /* ── UI ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6 text-white pb-10">

      {/* ── Video player ─────────────────────────────────────────────── */}
      <div className="relative w-full bg-black">
        {!videoData?.videoUrl ? (
          /* Preview / placeholder */
          previewSource ? (
            <img
              src={previewSource}
              alt="Preview"
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-richblack-800">
              <AiFillPlayCircle size={64} className="text-richblack-500" />
            </div>
          )
        ) : (
          <Player
            ref={playerRef}
            aspectRatio="16:9"
            playsInline
            onEnded={() => setVideoEnded(true)}
            src={videoData.videoUrl}
          >
            <BigPlayButton position="center" />

            {/* ── Video-ended overlay ──────────────────────────────── */}
            {videoEnded && (
              <div
                className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-3"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), rgba(0,0,0,0.4))',
                }}
              >
                {/* Mark complete */}
                {!completedLectures.includes(subSectionId) && (
                  <IconBtn
                    disabled={loading}
                    onClick={handleLectureCompletion}
                    text={loading ? 'Saving…' : 'Mark As Completed'}
                    customClasses="px-6 py-2.5 text-sm"
                  />
                )}

                {/* Rewatch */}
                <button
                  disabled={loading}
                  onClick={() => {
                    const player = playerRef.current
                    if(!player) return
                    playerRef?.current?.seek(0)
                    player.play()
                    setVideoEnded(false)
                  }}
                  className="flex items-center gap-2 rounded-md border border-richblack-400 px-5 py-2 text-sm text-richblack-100 transition-all hover:border-richblack-100 hover:text-white disabled:opacity-50"
                >
                  <MdOutlineReplay size={18} />
                  Rewatch
                </button>

                {/* Prev / Next */}
                <div className="flex gap-3">
                  {!isFirstVideo() && (
                    <button
                      disabled={loading}
                      onClick={goToPrevVideo}
                      className="rounded-md bg-richblack-700 px-5 py-2 text-sm font-medium text-richblack-5 transition-all hover:bg-richblack-600 disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                  )}
                  {!isLastVideo() && (
                    <button
                      disabled={loading}
                      onClick={goToNextVideo}
                      className="rounded-md bg-richblack-700 px-5 py-2 text-sm font-medium text-richblack-5 transition-all hover:bg-richblack-600 disabled:opacity-50"
                    >
                      Next →
                    </button>
                  )}
                </div>
              </div>
            )}
          </Player>
        )}
      </div>

      {/* ── Video info ───────────────────────────────────────────────── */}
      <div className="px-4 md:px-8">
        <h1 className="text-2xl font-semibold text-richblack-5 md:text-3xl">
          {videoData?.title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-richblack-100 md:text-base">
          {videoData?.description}
        </p>

        {videoData?.createdAt && (
          <p className="mt-4 text-xs text-richblack-300">
            {new Date(videoData.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  )
}

export default VideoDetails
