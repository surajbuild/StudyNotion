import React from "react";
import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import HighlightText from "../components/core/HomePage/HighlightText";
import CTAButton from "../components/core/HomePage/Button";
import Banner from "../assets/Images/newBanner.mp4";
import CodeBlocks from "../components/core/HomePage/CodeBlocks";
import TimeLineSection from "../components/core/HomePage/TimeLineSection"
import LearningLanguageSection from "../components/core/HomePage/LearningLanguageSection"
import InstructionSection from "../components/core/HomePage/InstructionSection";
import Footer from "../components/common/Footer";
import ExploreMore from "../components/core/HomePage/ExploreMore";
import ReviewSlider from "../components/common/ReviewSlider";



const Home = () => {
    return (
        <div>
            {/* Section 1 */}
            <div
                className="relative mx-auto flex flex-col w-11/12 items-center
                      text-white justify-between max-w-maxContent"
            >
                <Link to={"/signup"}>
                    <div className="group mt-16 mx-auto w-fit rounded-full bg-richblack-800 font-semibol text-richblack-200 p-1 transition-all duration-200 hover:scale-95">
                        <div className="flex flex-row items-center gap-2 px-10 py-2 rounded-full shadow-md transition-all duration-200 group-hover:bg-richblack-900">
                            <p className="tracking-wide">Become an Instructor</p>
                            <FaArrowRight className="text-yellow-400 group-hover:translate-x-1 transition-transform duration-200" />
                        </div>
                    </div>
                </Link>

                <div className="text-center mt-7 text-3xl md:text-5xl font-bold leading-snug tracking-tight text-richblack-5">
                    Empower Your Future with
                    <HighlightText text={"Coding Skills"} />
                </div>

                <div className="w-[85%] md:w-[70%] mx-auto mt-4 text-center text-base md:text-lg font-medium leading-relaxed text-richblack-200">
                    With our online coding courses, you can learn at your own pace, from
                    anywhere in the world, and get access to a wealth of resources,
                    including hands-on projects, quizzes, and personalized feedback from
                    instructors.
                </div>

                <div className="flex flex-row gap-7 mt-8">
                    <CTAButton active={true} linkto={"/signup"}>
                        Learn More
                    </CTAButton>
                    <CTAButton active={false} linkto={"/login"}>
                        Book a Demo
                    </CTAButton>
                </div>

                <div className="relative w-full mt-12 mb-16 flex justify-center px-4">
                    <div className="w-full max-w-6xl">
                        <video
                            muted
                            autoPlay
                            loop
                            playsInline
                            className="w-full rounded-xl shadow-2xl object-cover transition-all duration-300 hover:shadow-3xl"
                        >
                            <source src={Banner} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>

                {/* Code section 1 */}
                <div className="w-full transform-none transition-none">
                    <CodeBlocks
                        position={"lg:flex-row"}
                        heading={
                            <div className="text-4xl font-semibold">
                                Unlock your
                                <HighlightText text={"coding potential "} />
                                with our online courses.
                            </div>
                        }
                        subheading={
                            "Our courses are designed and taught by industry experts who have years of experience in coding and are passionate about sharing their knowledge with you."
                        }
                        ctabtn1={
                            {
                                btnText: "Try it Yourself",
                                linkto: "/signup",
                                active: true,
                            }
                        }
                        ctabtn2={
                            {
                                btnText: "Learn More",
                                linkto: "/login",
                                active: false,
                            }
                        }
                        codeblock={`<!DOCTYPE>\n<html>\n<head><title>Example</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1><a href="/">Header</a></h1>\n        <a href="one/">One</a>   \n        <a href="three/">Three</a>  \n</body>\n</html>`}
                        codeColor={"text-yellow-500"}
                    />
                </div>

                {/* Code section 2 */}
                <div className="w-full transform-none transition-none">
                    <CodeBlocks
                        position={"lg:flex-row-reverse"}
                        heading={
                            <div className="text-4xl font-semibold">
                                Start
                                <HighlightText text={"Coding in seconds "} />
                            </div>
                        }
                        subheading={
                            "Go ahead, give it a try. Our hands-on learning environment means you'll be writing real code from your very first lesson."
                        }
                        ctabtn1={
                            {
                                btnText: "Continue Lesson",
                                linkto: "/login",
                                active: true,
                            }
                        }
                        ctabtn2={
                            {
                                btnText: "Learn More",
                                linkto: "/login",
                                active: false,
                            }
                        }
                        codeblock={`<!DOCTYPE>\n<html>\n<head><title>Example</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <h1><a href="/">Header</a></h1>\n        <a href="one/">One</a>   \n        <a href="three/">Three</a>  \n</body>\n</html>`}
                        codeColor={"text-pink-500"}
                    />
                </div>

                {/* Explore more */}
                <ExploreMore />
            </div>

            {/* Section 2 */}
            <div className="bg-pure-greys-5 text-richblack-700">
                <div className="homepage_bg h-[310px]">
                    <div className="w-11/12 max-w-maxContent flex items-center 
                                    flex-col gap-5 mx-auto justify-between">
                        <div className="h-[150px]"></div>
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-7 text-white items-center">
                            <CTAButton active={true} linkto={'/signup'}>
                                <div className="flex items-center gap-3">
                                    Explore Full Catalog
                                    <FaArrowRight />
                                </div>
                            </CTAButton>

                            <CTAButton active={false} linkto={'/signup'}>
                                <div>
                                    Learn More
                                </div>
                            </CTAButton>
                        </div>
                    </div>
                </div>

                <div className="w-11/12 mx-auto max-w-maxContent flex flex-col md:flex-row items-center 
                                justify-between gap-7 mt-16">
                    {/* left section */}
                    <div className="w-full md:w-[50%] flex flex-col items-start font-inter font-semibold text-2xl mb-6 md:mb-12">
                        <div className="font-inter not-italic text-3xl md:text-4xl leading-tight text-richblack-900">
                            Get the skills you need for a{" "}
                            <HighlightText text={"job that is in demand"} />
                        </div>
                    </div>
                    {/* right section */}
                    <div className="w-full md:w-[50%] flex flex-col items-start text-start gap-6 mb-8 md:mb-14 md:mt-10">
                        <div className="text-richblack-600 text-base md:text-lg leading-relaxed">
                            The modern StudyNotion is the dictates its own terms. Today, to be a competitive specialist requires more than professional skills.
                        </div>
                        <div>
                            <CTAButton active={true} linkto={'/signup'}>
                                <div>
                                    Learn More
                                </div>
                            </CTAButton>
                        </div>
                    </div>
                </div>
                <TimeLineSection />
                <LearningLanguageSection />
            </div>


            {/* Section 3 */}
            <div className="w-11/12 mx-auto max-w-maxContent flex 
                            flex-col items-center justify-between 
                            gap-8 bg-richblack-900 text-white">

                <InstructionSection />

                {/* Reviews from other learners */}
                <h2 className="text-center font-semibold text-4xl mt-10">
                   Reviews from other learners  
                </h2>
                {/* Review slider here */}
                <ReviewSlider />
            </div>
            {/* Footer */}
            <Footer/>
        </div>
    );
};

export default Home;
