import React, { useState } from 'react'
import { HomePageExplore } from '../../../data/homepage-explore';
import HighlightText from './HighlightText';
import CourseCard from './CourseCard';
const tabsName = [
    "Free",
    "New to coding",
    "Most popular",
    "Skill paths",
    "Career paths"
];
const ExploreMore = () => {
    const [currentTab, setCurrentTab] = useState(tabsName[0]);
    const [courses, setCourses] = useState(HomePageExplore[0].courses);
    const [currentCard, setCurrentCard] = useState(HomePageExplore[0].courses[0].heading);

    const setMyCard = (value) => {
        setCurrentTab(value);
        const result = HomePageExplore.filter((course) => course.tag === value);
        setCourses(result[0].courses);
        setCurrentCard(result[0].courses[0].heading);
    }
    return (
        <div>
            <div className='text-4xl font-semibold text-center'>
                Unlock the 
                <HighlightText text={" power of code"}/>
            </div>

            <p className='text-center text-richblue-300 text-md mt-3'>
                Learn to build anything you can imagine
            </p>

            <div className='flex flex-wrap rounded-full bg-richblack-800 mt-5 p-1.5 border border-richblack-700 w-fit max-w-full items-center mx-auto justify-center gap-1 sm:gap-0'>
                {
                    tabsName.map((element, index) => {
                        return(
                            <div 
                                key={index}
                                onClick={() => setMyCard(element)}
                                className={`text-xs sm:text-sm md:text-[16px] flex flex-row items-center gap-2 
                                ${currentTab === element 
                                ? "bg-richblack-900 text-richblack-5 font-medium shadow-sm" 
                                : "text-richblack-200"} rounded-full transition-all duration-200 cursor-pointer
                                hover:bg-richblack-900 hover:text-richblack-5 px-3.5 sm:px-6 py-1.5 sm:py-2`}>
                                    {element}
                            </div>
                        )
                    })
                }
            </div>

            {/* Course card group */}
            <div className='flex flex-row justify-center gap-6 sm:gap-10 flex-wrap py-10 lg:py-16 px-2 sm:px-4 -mb-16 md:-mb-36'>
                {
                    courses.map((element, index) => {
                        return(
                            <CourseCard
                                key = {index}
                                cardData = {element}
                                currentCard = {currentCard}
                                setCurrentCard = {setCurrentCard}
                            />
                        )
                    })
                }
            </div>
        </div>
    )
}

export default ExploreMore
