import React from 'react'
import Instructor from '../../../assets/Images/Instructor.png'
import CTAButton from './Button'
import HighlightText from './HighlightText'
import { FaArrowRight } from 'react-icons/fa6'
const InstructionSection = () => {
  return (
    <div className='my-10 lg:my-16'>        
        <div className='flex flex-col-reverse lg:flex-row gap-10 items-center'>
            {/* Left Image */}
            <div className='w-full lg:w-[50%]'>
                <img 
                    src={Instructor} 
                    alt="InstructorImage" 
                    className='shadow-white rounded-lg object-cover mx-auto max-w-full'
                />
            </div>

            {/* Right Content */}
            <div className='w-full lg:w-[50%] flex flex-col lg:pr-10 lg:ml-12 gap-6 lg:gap-10'>
                <div className='text-3xl sm:text-4xl font-semibold'>
                    Become an <br className="hidden sm:block" />
                    <HighlightText text="instructor"/>
                </div>
                <div className='font-medium text-sm sm:text-base w-full lg:w-[85%] text-richblack-300'>
                    Instructors from around the world teach millions of students on StudyNotion. We provide the tools and skills to teach what you love.
                </div>
                <div className='w-fit'>
                    <CTAButton active={true} linkto={"/signup"}>
                        <div className='flex flex-row gap-2 text-sm items-center'>
                            Start Teaching Today
                            <FaArrowRight />
                        </div>
                    </CTAButton>
                </div>
            </div>
        </div>
    </div>
  )
}

export default InstructionSection
