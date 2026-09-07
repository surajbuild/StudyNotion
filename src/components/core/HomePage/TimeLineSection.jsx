import React from 'react'
import Logo1 from '../../../assets/TimeLineLogo/Logo1.svg'
import Logo2 from '../../../assets/TimeLineLogo/Logo2.svg'
import Logo3 from '../../../assets/TimeLineLogo/Logo3.svg'
import Logo4 from '../../../assets/TimeLineLogo/Logo4.svg'
import timelineImage from '../../../assets/Images/TimelineImage.png'
const TimeLineSection = () => {
    const timeline=[
        {
            Logo:Logo1,
            heading:"Leadership",
            Description: "Fully commited to the success company"
        },
        {
            Logo:Logo2,
            heading:"Responsibility",
            Description: "Students will always be our top priority"
        },
        {
            Logo:Logo3,
            heading:"Flexibility",
            Description: "The ability to switch is an important skills"
        },
        {
            Logo:Logo4,
            heading:"Solve the problem",
            Description: "Code your way to a solution"
        },
        
    ]
  return (
    <div>
        <div className='w-11/12 mx-auto max-w-maxContent flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-7 mt-16 mb-24 lg:mb-32'>
        {/* left part */}
        <div className='w-full lg:w-[45%] flex flex-col gap-8 sm:gap-14 lg:gap-20'>
            {
                timeline.map((element, index) => {
                    return(
                        <div className='flex flex-row gap-6' key={index}>
                            {/* logo box */}
                            <div className='w-[50px] h-[50px] bg-white flex items-center rounded-full justify-center shadow-md flex-shrink-0'>
                                <img src={element.Logo} alt={element.heading} className='w-6 h-6' />
                            </div>
                            
                            {/* logo description */}
                            <div>
                                <h2 className='font-semibold text-lg text-richblack-900'>{element.heading}</h2>
                                <p className='text-sm sm:text-base text-richblack-600'>{element.Description}</p>
                            </div>
                        </div>
                    )
                })
            }
    
        </div>
        {/* right part */}
        <div className='w-full lg:w-[50%] relative shadow-blue-200 mt-6 lg:mt-0'>
            <img 
                src={timelineImage}
                alt='timelineImage'
                className='w-full rounded-md shadow-lg object-cover'
            />
            {/* Green stats box */}
            <div className='absolute bg-caribbeangreen-700 flex flex-col sm:flex-row text-white uppercase rounded-md shadow-xl bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[90%] sm:w-auto p-4 sm:p-6 lg:p-8 gap-3 sm:gap-0'>
                <div className='flex flex-row gap-4 sm:gap-5 items-center sm:border-r border-b sm:border-b-0 border-caribbeangreen-300 pb-3 sm:pb-0 sm:pr-8'>
                    <p className='text-2xl sm:text-3xl font-bold'>10</p>
                    <p className='text-caribbeangreen-300 text-xs sm:text-sm'>YEARS OF <br className="hidden sm:block" />EXPERIENCES</p>
                </div>
                <div className='flex gap-4 sm:gap-5 items-center sm:pl-8 pt-2 sm:pt-0'>
                    <p className='text-2xl sm:text-3xl font-bold'>250</p>
                    <p className='text-caribbeangreen-300 text-xs sm:text-sm'>TYPES OF <br className="hidden sm:block" />COURSES</p>
                </div>
            </div>
        </div>
        </div>
    </div>
  )
}

export default TimeLineSection
