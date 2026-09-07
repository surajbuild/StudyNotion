import React from 'react'
import HighlightText from './HighlightText'
import know_your_progress from '../../../assets/Images/Know_your_progress.png'
import compare_with_others from '../../../assets/Images/Compare_with_others.png'
import plan_your_lesson from '../../../assets/Images/Plan_your_lessons.png'
import CTAButton from './Button'
const LearningLanguageSection = () => {
    return (
        <div className='mt-[70px] lg:mt-[150px] mb-10'>
            <div className='w-11/12 mx-auto max-w-maxContent flex flex-col gap-6 lg:gap-7 justify-between items-center'>
                <div className='text-3xl sm:text-4xl font-semibold text-center'>
                    Your Swiss Knife for
                    <HighlightText text={" learning any language"} />
                </div>
                <div className='text-center text-richblack-600 mx-auto text-sm sm:text-base font-medium w-full md:w-[75%] lg:w-[50%]'>
                    Using spin making learning multiple languages easy. With 20+ languages realistic voice-over, progress tracking, custom schedule and more.
                </div>

                {/* Images Container */}
                <div className='flex flex-col lg:flex-row items-center justify-center mt-4 lg:mt-5'>
                    <img 
                        src={know_your_progress} 
                        alt="KnowYourProgressImage" 
                        className='object-contain lg:-mr-32 z-10 w-[85%] max-w-[340px] lg:max-w-none lg:w-auto' 
                    />
                    <img 
                        src={compare_with_others} 
                        alt="CompareWithOthersImage" 
                        className='object-contain z-20 -mt-12 lg:mt-0 w-[85%] max-w-[340px] lg:max-w-none lg:w-auto' 
                    />
                    <img 
                        src={plan_your_lesson} 
                        alt="PlanYourLessonImage" 
                        className='object-contain lg:-ml-36 z-30 -mt-16 lg:mt-0 w-[85%] max-w-[340px] lg:max-w-none lg:w-auto' 
                    />
                </div>

                {/* Button */}
                <div className='w-fit h-fit mb-12 sm:mb-20'>
                    <CTAButton active={true} linkto={'/signup'}>
                        Learn More
                    </CTAButton>
                </div>

            </div>
        </div>
    )
}

export default LearningLanguageSection
