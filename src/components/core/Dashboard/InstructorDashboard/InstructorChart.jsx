import React, { useMemo, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { Pie } from "react-chartjs-2"

Chart.register(...registerables)

const InstructorChart = ({ courses }) => {

    const [currChart, setCurrChart] = useState("students")
    const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses])

    const getRandomColors = (numColors) => {
        const colors = []
        for (let i = 0; i < numColors; i++) {
            const color = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`
            colors.push(color);
        }
        return colors;
    }

    const chartColors = useMemo(() => getRandomColors(safeCourses.length), [safeCourses.length])

    const chartDataForStudents = {
        labels: safeCourses.map((course) => course.courseName),
        datasets: [
            {
                data: safeCourses.map((course) => course.totalStudentsEnrolled),
                backgroundColor: chartColors,
            }
        ]
    }

    const chartDataForIncome = {
        labels: safeCourses.map((course) => course.courseName),
        datasets: [
            {
                data: safeCourses.map((course) => course.totalAmountGenerated),
                backgroundColor: chartColors,
            }
        ]
    }

    const options = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#F1F2FF',
                    font: { size: 12 },
                }
            }
        }
    };

    return (
        <div className='rounded-xl bg-richblack-800 p-6 flex-1'>
            <p className='text-lg font-bold text-richblack-5 mb-4'>Visualise</p>

            {/* Toggle Buttons */}
            <div className='flex gap-x-3 mb-6'>
                <button
                    onClick={() => setCurrChart("students")}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                        ${currChart === "students"
                            ? "bg-yellow-50 text-richblack-900"
                            : "border border-richblack-600 text-richblack-300 hover:border-richblack-400"
                        }`}
                >
                    Students
                </button>
                <button
                    onClick={() => setCurrChart("income")}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                        ${currChart === "income"
                            ? "bg-yellow-50 text-richblack-900"
                            : "border border-richblack-600 text-richblack-300 hover:border-richblack-400"
                        }`}
                >
                    Income
                </button>
            </div>

            {/* Pie Chart */}
            <div className='relative h-[280px]'>
                <Pie
                    data={currChart === "students" ? chartDataForStudents : chartDataForIncome}
                    options={options}
                />
            </div>
        </div>
    )
}

export default InstructorChart
