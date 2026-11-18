import React from "react";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { AiOutlinePlusCircle } from "react-icons/ai";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import {
  setCourse,
  setEditCourse,
  setStep,
} from "../../../../../slices/courseSlice";
import NestedView from "./NestedView";
import toast from "react-hot-toast";
import {
  createSection,
  updateSection,
} from "../../../../../services/operations/courseDetailsAPI";
import { MdNavigateNext } from "react-icons/md";

const CourseBuilderForm = () => {
  const { token } = useSelector((state) => state.auth);
  const [editSectionName, setEditSectionName] = React.useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const { course } = useSelector((state) => state.course);

  const gonext = () => {
    if (course?.courseContent?.length > 0) {
      if (
        course.courseContent.some((section) => section.subSection.length > 0)
      ) {
        dispatch(setStep(3));
      } else {
        toast.error("Please add atleast one lesson to each section");
      }
    } else {
      toast.error("Please add atleast one section to continue");
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    let result = null;
    setLoading(true);
    if (editSectionName) {
      result = await updateSection(
        {
          sectionName: data.sectionName,
          courseId: course._id,
          sectionId: editSectionName,
        },
        token
      );
    } else {
      result = await createSection(
        {
          sectionName: data.sectionName,
          sectionId: editSectionName,
          courseId: course._id,
        },
        token
      );
    }
    if (result) {
      dispatch(setCourse(result));
      setValue("sectionName", "");
      setEditSectionName(false);
    }
    setLoading(false);
  };

  const handelChangeEditSectionName = (sectionId, sectionName) => {
    if (editSectionName === sectionId) {
      setEditSectionName(false);
      setValue("sectionName", "");
      return;
    }
    setEditSectionName(sectionId);
    setValue("sectionName", sectionName);
  };

  return (
    <div className="space-y-8 rounded-md border border-richblack-700 bg-richblack-800 p-6">
      <h2 className="text-2xl font-medium text-richblack-5">Course Builder</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm text-richblack-5" htmlFor="sectionName">
            Section Name<sup className="text-pink-200">*</sup>
          </label>
          <input
            id="sectionName"
            disabled={loading}
            placeholder="Add a section to build your course"
            {...register("sectionName", { required: true })}
            className="w-full rounded-lg bg-richblack-700 px-4 py-3 text-sm text-richblack-5 placeholder-richblack-400 border border-richblack-600 focus:border-yellow-50 focus:outline-none transition-all"
          />
          {errors.sectionName && (
            <span className="ml-2 text-xs tracking-wide text-pink-200">
              Section name is required
            </span>
          )}
        </div>

        <div className="flex items-end gap-x-4">
          <button
            type="submit"
            disabled={loading}
            className="flex cursor-pointer items-center gap-x-2 rounded-lg border-2 border-yellow-50 bg-transparent py-2 px-5 font-semibold text-yellow-50 hover:bg-yellow-50 hover:text-richblack-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editSectionName ? (
              <>
                <span>Edit Section Name</span>
              </>
            ) : (
              <>
                <AiOutlinePlusCircle size={20} />
                <span>Create Section</span>
              </>
            )}
          </button>
          {editSectionName && (
            <button
              type="button"
              onClick={() => {
                setEditSectionName(false);
                setValue("sectionName", "");
              }}
              className="text-sm text-richblack-300 underline"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Show sections if they exist */}
      {course?.courseContent?.length > 0 ? (
        <NestedView handelChangeEditSectionName={handelChangeEditSectionName} />
      ) : (
        <div className="rounded-md border border-richblack-600 bg-richblack-700 p-6 text-center">
          <p className="text-richblack-300">
            No sections created yet. Create a section above to start building your course.
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-end gap-x-3">
        <button
          onClick={() => {
            dispatch(setEditCourse(true));
            dispatch(setStep(1));
          }}
          disabled={loading}
          className="flex cursor-pointer items-center gap-x-2 rounded-lg bg-richblack-600 py-2 px-5 font-semibold text-richblack-5 hover:bg-richblack-700 transition-all disabled:opacity-50"
        >
          <span>Back</span>
        </button>
        <button
          onClick={gonext}
          disabled={loading}
          className="flex items-center bg-yellow-50 cursor-pointer gap-x-2 rounded-lg py-2 px-5 font-semibold text-richblack-900 hover:bg-yellow-100 transition-all disabled:opacity-50"
        >
          <span>Next</span>
          <MdNavigateNext size={20} />
        </button>
      </div>
    </div>
  );
};

export default CourseBuilderForm;
