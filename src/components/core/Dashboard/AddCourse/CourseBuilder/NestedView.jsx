import React, { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { RxDropdownMenu } from "react-icons/rx"
import { MdEdit } from "react-icons/md"
import { RiDeleteBin6Line } from "react-icons/ri"
import { BiSolidDownArrow } from "react-icons/bi"
import { AiOutlinePlus } from "react-icons/ai"
import SubSectionModal from "./SubSectionModal"
import ConfirmationModal from "../../../../common/ConfirmationModal"
import { deleteSection, deleteSubSection } from "../../../../../services/operations/courseDetailsAPI"
import { setCourse } from "../../../../../slices/courseSlice"

const NestedView = ({ handelChangeEditSectionName }) => {
    const { course } = useSelector((state) => state.course)
    const { token } = useSelector((state) => state.auth)
    const dispatch = useDispatch()

    const [addSubSection, setAddSubSection] = useState(null)
    const [viewSubSection, setViewSubSection] = useState(null)
    const [editSubSection, setEditSubSection] = useState(null)
    const [confirmationModal, setConfirmationModal] = useState(null)

    const handleDeleteSection = async (sectionId) => {
        const result = await deleteSection({ sectionId, courseId: course._id }, token)
        if (result) dispatch(setCourse(result))
        setConfirmationModal(null)
    }

    const handleDeleteSubSection = async (subSectionId, sectionId) => {
        const result = await deleteSubSection({ subSectionId, sectionId }, token)
        if (result) {
            const updatedCourseContent = course.courseContent.map((section) =>
                section._id === sectionId ? result : section
            )
            dispatch(setCourse({ ...course, courseContent: updatedCourseContent }))
        }
        setConfirmationModal(null)
    }

    return (
        <div>
            <div className="rounded-lg border border-richblack-600 bg-richblack-700 p-6">
                {course?.courseContent?.map((section) => (
                    <details key={section._id} open className="mb-4 last:mb-0">
                        {/* Section header */}
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-x-3 rounded-md bg-richblack-600 px-4 py-3">
                            <div className="flex items-center gap-x-3">
                                <RxDropdownMenu className="text-lg text-richblack-300" />
                                <p className="font-semibold text-richblack-5">{section.sectionName}</p>
                            </div>

                            {/* Section actions — stop propagation so clicks don't toggle <details> */}
                            <div
                                className="flex items-center gap-x-3"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    title="Edit section name"
                                    onClick={() => handelChangeEditSectionName(section._id, section.sectionName)}
                                    className="text-richblack-300 hover:text-yellow-50 transition-colors"
                                >
                                    <MdEdit size={18} />
                                </button>
                                <button
                                    title="Delete section"
                                    onClick={() =>
                                        setConfirmationModal({
                                            text1: "Delete this Section?",
                                            text2: "All lectures in this section will be permanently deleted.",
                                            btn1Text: "Delete",
                                            btn2Text: "Cancel",
                                            btn1Handler: () => handleDeleteSection(section._id),
                                            btn2Handler: () => setConfirmationModal(null),
                                        })
                                    }
                                    className="text-richblack-300 hover:text-pink-300 transition-colors"
                                >
                                    <RiDeleteBin6Line size={18} />
                                </button>
                                <span className="text-richblack-500">|</span>
                                <BiSolidDownArrow className="text-sm text-richblack-400" />
                            </div>
                        </summary>

                        {/* Subsections list */}
                        <div className="mt-2 space-y-1 pl-4">
                            {section.subSection.map((data) => (
                                <div
                                    key={data?._id}
                                    className="flex items-center justify-between rounded-md px-4 py-2 hover:bg-richblack-600 transition-colors"
                                >
                                    {/* Clickable title area → View modal */}
                                    <button
                                        type="button"
                                        onClick={() => setViewSubSection(data)}
                                        className="flex flex-1 items-center gap-x-3 text-left"
                                    >
                                        <RxDropdownMenu className="text-richblack-300" />
                                        <p className="text-sm text-richblack-100">{data.title}</p>
                                    </button>

                                    {/* Edit / Delete buttons — completely separate from the title button */}
                                    <div className="flex items-center gap-x-3">
                                        <button
                                            type="button"
                                            title="Edit lecture"
                                            onClick={() =>
                                                setEditSubSection({ ...data, sectionId: section._id })
                                            }
                                            className="text-richblack-300 hover:text-yellow-50 transition-colors"
                                        >
                                            <MdEdit size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            title="Delete lecture"
                                            onClick={() =>
                                                setConfirmationModal({
                                                    text1: "Delete this Lecture?",
                                                    text2: "This lecture will be permanently removed.",
                                                    btn1Text: "Delete",
                                                    btn2Text: "Cancel",
                                                    btn1Handler: () => handleDeleteSubSection(data._id, section._id),
                                                    btn2Handler: () => setConfirmationModal(null),
                                                })
                                            }
                                            className="text-richblack-300 hover:text-pink-300 transition-colors"
                                        >
                                            <RiDeleteBin6Line size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add lecture button */}
                            <button
                                type="button"
                                onClick={() => setAddSubSection(section._id)}
                                className="mt-2 flex items-center gap-x-2 rounded-md px-4 py-2 text-sm font-medium text-yellow-50 hover:bg-richblack-600 transition-colors"
                            >
                                <AiOutlinePlus />
                                <span>Add Lecture</span>
                            </button>
                        </div>
                    </details>
                ))}
            </div>

            {/* Modals — only one can be open at a time */}
            {addSubSection && (
                <SubSectionModal
                    modalData={addSubSection}
                    setModalData={setAddSubSection}
                    add={true}
                />
            )}
            {viewSubSection && (
                <SubSectionModal
                    modalData={viewSubSection}
                    setModalData={setViewSubSection}
                    view={true}
                />
            )}
            {editSubSection && (
                <SubSectionModal
                    modalData={editSubSection}
                    setModalData={setEditSubSection}
                    edit={true}
                />
            )}
            {confirmationModal && (
                <ConfirmationModal modalData={confirmationModal} />
            )}
        </div>
    )
}

export default NestedView
