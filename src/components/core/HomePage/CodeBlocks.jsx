import React from 'react'
import CTAButton from "./Button"
import { FaArrowRight } from "react-icons/fa6";
import { TypeAnimation } from 'react-type-animation';
const CodeBlocks = ({
    position, heading, subheading, ctabtn1, ctabtn2, codeblock, backgroundGradient, codeColor
}) => {
  return (
    <div className={`flex flex-col ${position} gap-8 lg:gap-10 my-10 lg:my-20 justify-between items-center`}>
      {/* Section 1 */}
      <div className='w-full lg:w-[50%] flex flex-col gap-6 lg:gap-8'>
        {heading}
        <div className='text-richblack-300 font-bold text-sm sm:text-base'>
            {subheading}
        </div>
        <div className='flex flex-wrap gap-4 sm:gap-7 mt-4 sm:mt-7'>
            <CTAButton active={ctabtn1.active} linkto={ctabtn1.linkto}>
                <div className='flex gap-2 items-center'>
                    {ctabtn1.btnText}
                    <FaArrowRight/>
                </div>
            </CTAButton>
            <CTAButton active={ctabtn2.active} linkto={ctabtn2.linkto}>
                    {ctabtn2.btnText}
            </CTAButton>
        </div>

      </div>

      {/* Section 2 */}
      {/* Code section 2 */}
        <div className={`relative h-fit flex flex-row text-xs sm:text-sm w-full lg:w-[48%] py-4 rounded-xl shadow-lg border border-richblack-700/60 bg-richblack-800/30 overflow-hidden ${backgroundGradient || ""}`}>
          {/* HW: bg gradient */}
          <div 
            className='absolute inset-0 z-0 pointer-events-none'
            style={
                {
                    background: `linear-gradient(90deg, rgba(138,43,226,0.2), rgba(255,165,0,0.2), rgba(248,248,255,0.2))`,
                    filter: "blur(68px)",
                    opacity: 0.6,
                }
            }
          />
        <div className='flex w-full overflow-x-auto'>
          <div className="text-right flex flex-col w-8 sm:w-10 pr-2 pl-2 text-richblack-400 font-inter font-bold z-10 select-none text-xs sm:text-sm flex-shrink-0">
            <p>1</p>
            <p>2</p>
            <p>3</p>
            <p>4</p>
            <p>5</p>
            <p>6</p>
            <p>7</p>
            <p>8</p>
            <p>9</p>
            <p>10</p>
            <p>11</p>
          </div>
          {/* Code block */}
          <div className={`flex-1 flex flex-col min-h-[220px] sm:min-h-[264px] font-bold font-mono ${codeColor} pr-3 z-10 text-xs sm:text-sm overflow-x-auto`}>
            <TypeAnimation
              sequence={[codeblock, 2000, ""]}
              repeat={Infinity}
              style={
                {
                    whiteSpace:"pre-line",
                    display:"block",
                }
              }
              omitDeletionAnimation={true}
            />
          </div>
        </div>
        </div>
    </div>
  )
}

export default CodeBlocks
