import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { getInstructorData } from '../../../../services/operations/profileAPI';
import { fetchInstructorCourses } from '../../../../services/operations/courseDetailsAPI';
import { isInstructorApproved } from '../../../../utils/constants';
import InstructorChart from './InstructorChart';
import InstructorApprovalNotice from './InstructorApprovalNotice';

const Instructor = () => {

    const { user } = useSelector((state) => state.profile);
    const { token } = useSelector((state) => state.auth);
    const approved = isInstructorApproved(user);
    const [loading, setLoading] = useState(false);
    const [instructorData, setInstructorData] = useState(null);
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        if (!approved || !token) return;
        const getCourseDataWithStats = async () => {
            setLoading(true);
            const instructorApiData = await getInstructorData(token);
            const result = await fetchInstructorCourses(token);

            // ✅ FIX: optional chaining — prevents crash if API returns null/undefined
            if (instructorApiData?.length) {
                setInstructorData(instructorApiData);
            }
            if (result) {
                setCourses(result);
            }
            setLoading(false);
        }
        getCourseDataWithStats();
    }, [token, approved])

    if (!approved) {
        return <InstructorApprovalNotice />;
    }

    const totalAmount = instructorData?.reduce((acc, curr) => acc + curr.totalAmountGenerated, 0) ?? 0;
    // ✅ FIX: was (acc, curr) => curr.totalStudentsEnrolled — missing acc + so only last value returned
    const totalStudents = instructorData?.reduce((acc, curr) => acc + curr.totalStudentsEnrolled, 0) ?? 0;

    if (loading) {
        return (
            <div className='flex justify-center items-center min-h-[400px]'>
                <div className='spinner'></div>
            </div>
        )
    }

    return (
        <div className='text-white px-4 sm:px-6 py-6 max-w-[1200px] mx-auto w-full'>

            {/* Header */}
            <div className='mb-8'>
                <h1 className='text-2xl sm:text-3xl font-bold text-richblack-5'>
                    Hi {user?.firstName} 👋
                </h1>
                <p className='text-richblack-300 mt-1 text-sm sm:text-base'>
                    Let's start something new
                </p>
            </div>

            {courses.length > 0 ? (
                <div className='flex flex-col gap-y-8'>

                    {/* Chart + Statistics — stack on mobile, side by side on desktop */}
                    <div className='flex flex-col lg:flex-row gap-6'>

                        {/* Pie Chart */}
                        <InstructorChart courses={instructorData} />

                        {/* Statistics Card */}
                        <div className='rounded-xl bg-richblack-800 p-6 lg:min-w-[220px]'>
                            <p className='text-lg font-bold text-richblack-5 mb-6'>Statistics</p>
                            <div className='flex flex-col gap-y-6'>
                                <div>
                                    <p className='text-sm text-richblack-400 mb-1'>Total Courses</p>
                                    <p className='text-3xl font-bold text-richblack-5'>{courses.length}</p>
                                </div>
                                <div>
                                    <p className='text-sm text-richblack-400 mb-1'>Total Students</p>
                                    <p className='text-3xl font-bold text-richblack-5'>{totalStudents}</p>
                                </div>
                                <div>
                                    <p className='text-sm text-richblack-400 mb-1'>Total Income</p>
                                    <p className='text-3xl font-bold text-richblack-5'>₹ {totalAmount}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Your Courses Section */}
                    <div className='rounded-xl bg-richblack-800 p-6'>
                        <div className='flex items-center justify-between mb-6'>
                            <p className='text-lg font-bold text-richblack-5'>Your Courses</p>
                            <Link
                                to="/dashboard/my-courses"
                                className='text-yellow-50 text-sm font-medium hover:text-yellow-100 transition-colors'
                            >
                                View all →
                            </Link>
                        </div>

                        {/* Course cards — 1 col on mobile, 3 on desktop */}
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                            {courses.slice(0, 3).map((course) => (
                                <div
                                    key={course._id}
                                    className='rounded-lg overflow-hidden border border-richblack-700 bg-richblack-900 hover:border-richblack-500 transition-all duration-200'
                                >
                                    <img
                                        src={course.thumbnail}
                                        alt={course.courseName}
                                        className='w-full h-[160px] object-cover'
                                    />
                                    <div className='p-4'>
                                        <p className='text-richblack-5 font-semibold text-sm line-clamp-2 mb-2'>
                                            {course.courseName}
                                        </p>
                                        <div className='flex items-center gap-x-2 text-richblack-400 text-xs'>
                                            {/* ✅ FIX: course.length (array length) was wrong — should be studentsEnrolled count */}
                                            <span>{course.studentEnrolled?.length ?? 0} students</span>
                                            <span className='text-richblack-700'>|</span>
                                            <span className='text-yellow-50 font-medium'>₹ {course.price}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            ) : (
                // Empty state
                <div className='flex flex-col items-center justify-center rounded-xl bg-richblack-800 p-12 text-center'>
                    <p className='text-richblack-300 text-base mb-6'>
                        You have not created any courses yet.
                    </p>
                    {/* ✅ FIX: was /dashboard/addCourse — correct path is /dashboard/add-course */}
                    <Link
                        to="/dashboard/add-course"
                        className='bg-yellow-50 text-richblack-900 font-semibold px-6 py-3 rounded-lg hover:bg-yellow-100 transition-all duration-200'
                    >
                        + Create a Course
                    </Link>
                </div>
            )}

        </div>
    )
}

export default Instructor
