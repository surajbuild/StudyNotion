import React from 'react'
import { FaCheck } from 'react-icons/fa';
import { useSelector } from 'react-redux'
import CourseBuilderForm from './CourseBuilder/CourseBuilderForm';
import CourseInformationForm from './CourseInformation/CourseInformationForm';
import PublishCourse from './PublishCourse';

const RenderSteps = () => {
    const { step } = useSelector((state) => state.course);

    const steps = [
        {
            id: 1,
            title: "Course Information",
        },
        {
            id: 2,
            title: "Course Builder",
        },
        {
            id: 3,
            title: "Publish",
        },
    ]

    return (
        <div>
            {/* Progress Indicator */}
            <div className='relative mb-3 flex w-full justify-center items-center'>
                {steps.map((item, index) => (
                    <React.Fragment key={item.id}>
                        {/* Step Circle and Label */}
                        <div className='flex flex-col items-center relative z-10 max-w-[85px] sm:max-w-none'>
                            <div
                                className={`grid aspect-square w-9 sm:w-10 h-9 sm:h-10 place-items-center rounded-full border-2 font-semibold text-xs sm:text-sm transition-all ${
                                    step === item.id
                                        ? "border-yellow-50 bg-yellow-50 text-richblack-900"
                                        : step > item.id
                                        ? "border-yellow-50 bg-yellow-50 text-richblack-900"
                                        : "border-richblack-700 bg-richblack-800 text-richblack-300"
                                }`}
                            >
                                {step > item.id ? (
                                    <FaCheck className="font-bold text-xs sm:text-sm" />
                                ) : (
                                    item.id
                                )}
                            </div>
                            <p
                                className={`mt-2 text-center text-xs sm:text-sm leading-tight ${
                                    step >= item.id ? "text-richblack-5" : "text-richblack-500"
                                }`}
                            >
                                {item.title}
                            </p>
                        </div>
                        
                        {/* Dashed Line */}
                        {item.id !== steps.length && (
                            <div
                                className={`h-[1px] w-[15%] sm:w-[25%] md:w-[33%] border-dashed border-b-2 mb-8 mx-1 sm:mx-2 ${
                                    step > item.id ? "border-yellow-50" : "border-richblack-500"
                                }`}
                            ></div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Render specific component based on current step */}
            <div className='mt-12'>
                {step === 1 && <CourseInformationForm />}
                {step === 2 && <CourseBuilderForm />}
                {step === 3 && <PublishCourse />}
            </div>
        </div>
    )
}

export default RenderSteps
