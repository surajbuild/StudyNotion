import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useSelector } from 'react-redux'
import { toast } from 'react-hot-toast'
import ReactStars from 'react-stars'
import { RxCross2 } from 'react-icons/rx'
import IconBtn from '../../common/IconBtn'
import { createRating } from '../../../services/operations/courseDetailsAPI'

const CourseReviewModal = ({ setReviewModal }) => {
  const { user }            = useSelector((state) => state.profile)
  const { token }           = useSelector((state) => state.auth)
  const { courseEntireData } = useSelector((state) => state.viewCourse)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm()

  useEffect(() => {
    setValue('courseExperience', '')
    setValue('courseRating', 0)
  }, [])

  const ratingChanged = (newRating) => {
    setValue('courseRating', newRating)
  }

  const onSubmit = async (data) => {
    if (!data.courseRating || data.courseRating < 1) {
      toast.error('Please select a star rating between 1 and 5')
      return
    }
    const success = await createRating(
      {
        courseId: courseEntireData._id,
        rating:   data.courseRating,
        review:   data.courseExperience,
      },
      token
    )
    // Only close the modal if the review was actually submitted successfully.
    // If it failed (e.g. already reviewed), keep modal open so user sees the error toast.
    if (success) {
      setReviewModal(false)
    }
  }

  return (
    /* ── Backdrop ────────────────────────────────────────────────────── */
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-richblack-900/80 px-4 backdrop-blur-sm">

      {/* ── Modal card ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-[540px] rounded-2xl border border-richblack-700 bg-richblack-800 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-richblack-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-richblack-5">Add Review</h2>
          <button
            onClick={() => setReviewModal(false)}
            className="rounded-full p-1 text-richblack-400 transition-all hover:bg-richblack-700 hover:text-richblack-5"
          >
            <RxCross2 size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">

          {/* User info */}
          <div className="mb-6 flex items-center gap-3">
            <img
              src={user?.image}
              alt={user?.firstName}
              className="h-12 w-12 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-medium text-richblack-5">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-richblack-300">Posting Publicly</p>
            </div>
          </div>

          {/* Star rating */}
          <div className="mb-6 flex justify-center">
            <ReactStars
              count={5}
              onChange={ratingChanged}
              size={28}
              color2="#FFD60A"
              color1="#2C333F"
              half={false}
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

            {/* Textarea */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="courseExperience"
                className="text-sm font-medium text-richblack-5"
              >
                Add Your Experience
                <span className="ml-1 text-pink-200">*</span>
              </label>
              <textarea
                id="courseExperience"
                placeholder="Share details of your own experience with this course"
                {...register('courseExperience', { required: true })}
                className="
                  min-h-[130px] w-full resize-none rounded-lg
                  border border-richblack-700 bg-richblack-700
                  px-4 py-3 text-sm text-richblack-5 placeholder-richblack-400
                  outline-none transition-all
                  focus:border-yellow-50 focus:ring-1 focus:ring-yellow-50
                "
              />
              {errors.courseExperience && (
                <span className="text-xs text-pink-200">
                  Please add your experience
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewModal(false)}
                className="rounded-lg border border-richblack-600 bg-richblack-700 px-5 py-2.5 text-sm font-medium text-richblack-100 transition-all hover:bg-richblack-600 hover:text-richblack-5"
              >
                Cancel
              </button>
              <IconBtn
                type="submit"
                text="Submit Review"
                customClasses="px-5 py-2.5 text-sm"
              />
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}

export default CourseReviewModal
