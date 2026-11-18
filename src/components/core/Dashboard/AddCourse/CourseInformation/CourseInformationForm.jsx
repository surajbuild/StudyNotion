import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useDispatch, useSelector } from "react-redux"
import {
    addCourseDetails,
    editCourseDetails,
    fetchCourseCategories,
} from "../../../../../services/operations/courseDetailsAPI"
import { HiOutlineCurrencyRupee } from "react-icons/hi"
import RequirementField from "./RequirementField"
import ChipInput from "./ChipInput"
import Upload from "../Upload"
import { setStep, setCourse, setEditCourse } from "../../../../../slices/courseSlice"
import IconBtn from "../../../../common/IconBtn"
import { COURSE_STATUS } from "../../../../../utils/constants"
import { toast } from "react-hot-toast"

const CourseInformationForm = () => {
    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        formState: { errors },
    } = useForm()

    const dispatch = useDispatch()
    const { token } = useSelector((state) => state.auth)
    const { course, editCourse } = useSelector((state) => state.course)

    const [loading, setLoading] = useState(false)
    const [courseCategories, setCourseCategories] = useState([])

    useEffect(() => {
        const getCategories = async () => {
            setLoading(true)
            const categories = await fetchCourseCategories()
            if (categories?.length > 0) {
                setCourseCategories(categories)
            }
            setLoading(false)
            if (editCourse && course) {
                const catId = course.category?._id || course.category || ""
                if (catId) setValue("courseCategory", catId)
            }
        }

        // Pre-fill form fields when editing an existing course
        if (editCourse && course) {
            setValue("courseTitle", course.courseName)
            setValue("courseShortDesc", course.courseDescription)
            setValue("coursePrice", course.price)
            setValue("courseTags", course.tag)
            setValue("courseBenefits", course.whatYouWillLearn)
            setValue("courseCategory", course.category?._id || course.category || "")
            setValue("courseRequirements", course.instructions)
        }

        getCategories()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Returns true if any form field differs from the saved course data
    const isFormUpdated = () => {
        const currentValues = getValues()
        if (currentValues.courseImage) return true
        return (
            currentValues.courseTitle !== course.courseName ||
            currentValues.courseShortDesc !== course.courseDescription ||
            currentValues.coursePrice !== course.price ||
            currentValues.courseBenefits !== course.whatYouWillLearn ||
            currentValues.courseCategory !== course.category?._id ||
            currentValues.courseTags?.toString() !== course.tag?.toString() ||
            currentValues.courseRequirements?.toString() !== course.instructions?.toString()
        )
    }

    const onSubmit = async (data) => {
        // ✅ REMOVED: All console.log debug statements that printed form data,
        // edit mode state, FormData entries, and API results.
        // These exposed course details and user data in the console.

        if (editCourse) {
            if (!isFormUpdated()) {
                toast.error("No changes made to the form")
                return
            }

            const formData = new FormData()
            formData.append("courseId", course._id)

            // Only append fields that actually changed to keep the payload minimal
            if (data.courseTitle !== course.courseName)
                formData.append("courseName", data.courseTitle)
            if (data.courseShortDesc !== course.courseDescription)
                formData.append("courseDescription", data.courseShortDesc)
            if (data.coursePrice !== course.price)
                formData.append("price", data.coursePrice)
            if (data.courseBenefits !== course.whatYouWillLearn)
                formData.append("whatYouWillLearn", data.courseBenefits)
            if (data.courseCategory && data.courseCategory !== (course.category?._id || course.category))
                formData.append("category", data.courseCategory)
            if (data.courseRequirements?.toString() !== course.instructions?.toString())
                formData.append("instructions", JSON.stringify(data.courseRequirements))
            if (data.courseTags?.toString() !== course.tag?.toString())
                formData.append("tag", JSON.stringify(data.courseTags))
            if (data.courseImage)
                formData.append("thumbnailImage", data.courseImage)

            setLoading(true)
            try {
                const result = await editCourseDetails(formData, token)
                if (result) {
                    dispatch(setCourse(result))
                    dispatch(setEditCourse(false))
                    dispatch(setStep(2))
                }
            } catch (error) {
                // Error toast is already shown by editCourseDetails
                console.error("editCourseDetails error:", error)
            } finally {
                setLoading(false)
            }
            return
        }

        // ─── CREATE new course ───────────────────────────────────────────────
        const formData = new FormData()
        formData.append("courseName", data.courseTitle)
        formData.append("courseDescription", data.courseShortDesc)
        formData.append("price", data.coursePrice)
        formData.append("whatYouWillLearn", data.courseBenefits)
        formData.append("category", data.courseCategory)
        formData.append("instructions", JSON.stringify(data.courseRequirements))
        formData.append("status", COURSE_STATUS.DRAFT)
        formData.append("tag", JSON.stringify(data.courseTags))
        formData.append("thumbnailImage", data.courseImage)

        setLoading(true)
        const result = await addCourseDetails(formData, token)
        setLoading(false)

        if (result) {
            dispatch(setCourse(result))
            dispatch(setStep(2))
        }
    }

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-8 rounded-md border border-richblack-700 bg-richblack-800 p-6"
        >
            {/* ── Course Title ─────────────────────────────────────────────── */}
            <div className="flex flex-col space-y-2">
                <label className="text-sm text-richblack-5">
                    Course Title <sup className="text-pink-200">*</sup>
                </label>
                <input
                    placeholder="Enter Course Title"
                    {...register("courseTitle", { required: true })}
                    className="form-style w-full rounded-lg border border-richblack-600 bg-richblack-700 px-4 py-3 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none transition-all"
                />
                {errors.courseTitle && (
                    <span className="text-xs text-pink-200">Course title is required</span>
                )}
            </div>

            {/* ── Short Description ─────────────────────────────────────────── */}
            <div className="flex flex-col space-y-2">
                <label className="text-sm text-richblack-5">
                    Course Short Description <sup className="text-pink-200">*</sup>
                </label>
                <textarea
                    {...register("courseShortDesc", { required: true })}
                    placeholder="Enter a short description"
                    className="form-style min-h-[130px] w-full rounded-lg border border-richblack-600 bg-richblack-700 px-4 py-3 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none transition-all resize-none"
                />
                {errors.courseShortDesc && (
                    <span className="text-xs text-pink-200">Course description is required</span>
                )}
            </div>

            {/* ── Price ────────────────────────────────────────────────────── */}
            <div className="relative flex flex-col space-y-2">
                <label className="text-sm text-richblack-5">
                    Course Price <sup className="text-pink-200">*</sup>
                </label>
                <div className="relative">
                    <HiOutlineCurrencyRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-richblack-400" />
                    <input
                        type="number"
                        min="0"
                        placeholder="0"
                        {...register("coursePrice", {
                            required: true,
                            valueAsNumber: true,
                            min: { value: 0, message: "Price cannot be negative" },
                        })}
                        className="form-style w-full rounded-lg border border-richblack-600 bg-richblack-700 py-3 pl-10 pr-4 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none transition-all"
                    />
                </div>
                {errors.coursePrice && (
                    <span className="text-xs text-pink-200">
                        {errors.coursePrice.message || "Course price is required"}
                    </span>
                )}
            </div>

            {/* ── Category ─────────────────────────────────────────────────── */}
            <div className="flex flex-col space-y-2">
                <label className="text-sm text-richblack-5">
                    Course Category <sup className="text-pink-200">*</sup>
                </label>
                {/* ✅ Enhancement: Category is disabled during edit because changing category
                    requires updating the Category document's courses array, which is not
                    handled by the current editCourse flow. Disabling prevents silent data
                    mismatch between the Course and Category collections. */}
                <select
                    disabled={editCourse || loading}
                    {...register("courseCategory", { required: !editCourse })}
                    className="form-style w-full rounded-lg border border-richblack-600 bg-richblack-700 px-4 py-3 text-sm text-richblack-5 focus:border-yellow-50 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <option value="">Select Category</option>
                    {!loading &&
                        courseCategories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                                {cat.name}
                            </option>
                        ))}
                </select>
                {errors.courseCategory && (
                    <span className="text-xs text-pink-200">Course category is required</span>
                )}
            </div>

            {/* ── Tags (ChipInput) ──────────────────────────────────────────── */}
            <ChipInput
                label="Tags"
                name="courseTags"
                register={register}
                errors={errors}
                setValue={setValue}
                getValues={getValues}
            />

            {/* ── Thumbnail ────────────────────────────────────────────────── */}
            <Upload
                name="courseImage"
                label="Course Thumbnail"
                register={register}
                setValue={setValue}
                errors={errors}
                editData={editCourse ? course.thumbnail : null}
            />

            {/* ── Benefits / What You Will Learn ────────────────────────────── */}
            <div className="flex flex-col space-y-2">
                <label className="text-sm text-richblack-5">
                    Course Benefits <sup className="text-pink-200">*</sup>
                </label>
                <textarea
                    {...register("courseBenefits", { required: true })}
                    placeholder="What will students learn from this course?"
                    className="form-style min-h-[130px] w-full rounded-lg border border-richblack-600 bg-richblack-700 px-4 py-3 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none transition-all resize-none"
                />
                {errors.courseBenefits && (
                    <span className="text-xs text-pink-200">Course benefits are required</span>
                )}
            </div>

            {/* ── Requirements / Instructions ───────────────────────────────── */}
            <RequirementField
                name="courseRequirements"
                label="Requirements / Instructions"
                register={register}
                errors={errors}
                setValue={setValue}
                getValues={getValues}
            />

            {/* ── Actions ──────────────────────────────────────────────────── */}
            <div className="flex justify-end gap-x-2">
                {editCourse && (
                    <button
                        type="button"
                        onClick={() => dispatch(setStep(2))}
                        className="rounded-md bg-richblack-600 px-4 py-2 text-sm font-medium text-richblack-5 hover:bg-richblack-500 transition-all"
                    >
                        Continue Without Saving
                    </button>
                )}
                <IconBtn
                    type="submit"
                    disabled={loading}
                    text={loading ? "Saving..." : editCourse ? "Save Changes" : "Next"}
                />
            </div>
        </form>
    )
}

export default CourseInformationForm
