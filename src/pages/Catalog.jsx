import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiConnector } from '../services/apiconnector'
import { categories, catalogData } from '../services/apis'
import Footer from '../components/common/Footer'
import CourseCard from '../components/core/Catalog/CourseCard'

const Catalog = () => {
    // ✅ FIX: Changed destructured param from `catalogName` to `categoryName`.
    // The route in App.jsx is defined as `/catalog/:categoryName`.
    // useParams() returns an object whose keys match the param names in the
    // route definition. Using `catalogName` here meant the variable was always
    // undefined, so the category lookup never matched anything and the
    // catalog page could never load data.
    const { categoryName } = useParams()
    const [active, setActive] = useState(1)
    const [catalogPageData, setCatalogPageData] = useState(null)
    const [categoryId, setCategoryId] = useState("")
    const [loading, setLoading] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const [fetchError, setFetchError] = useState(false)

    const slugify = (str) =>
        str
            ?.toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            || ""

    // Fetch all categories and find the one matching the URL param
    useEffect(() => {
        const getCategoryDetails = async () => {
            setLoading(true)
            try {
                const res = await apiConnector("GET", categories.CATEGORIES_API)
                const decodedParam = decodeURIComponent(categoryName || "").toLowerCase()
                const category = res?.data?.data?.find((ct) => slugify(ct?.name) === decodedParam)
                if (!category) {
                    setNotFound(true)
                    setCategoryId("")
                } else {
                    setNotFound(false)
                    setCategoryId(category._id)
                }
            } catch (error) {
                console.error("Could not fetch Categories.", error)
            }
            setLoading(false)
        }
        getCategoryDetails()
    }, [categoryName]) // ✅ Updated dependency to match the corrected variable name

    // Fetch catalog page data once we have a valid categoryId
    useEffect(() => {
        const getCategoryDetails = async () => {
            setLoading(true)
            setFetchError(false)
            try {
                const res = await apiConnector("POST", catalogData.CATALOGPAGEDATA_API, {
                    categoryId: categoryId,
                })
                setCatalogPageData(res?.data)
            } catch (error) {
                console.error(error)
                setFetchError(true)
            }
            setLoading(false)
        }
        if (categoryId) {
            getCategoryDetails()
        }
    }, [categoryId])

    if (loading) {
        return (
            <div className='grid min-h-[calc(100vh-3.5rem)] place-items-center bg-richblack-900'>
                <div className='spinner'></div>
            </div>
        )
    }

    if (notFound) {
        return (
            <div className='min-h-screen bg-richblack-900 flex items-center justify-center'>
                <div className='text-3xl text-richblack-5'>Error 404 - Category Not Found</div>
            </div>
        )
    }

    if (fetchError) {
        return (
            <div className='min-h-screen bg-richblack-900 flex flex-col gap-4 items-center justify-center px-4 text-center'>
                <div className='text-2xl text-richblack-5'>Could not load courses for this category.</div>
                <p className='text-richblack-300'>Please refresh the page or try again later.</p>
            </div>
        )
    }

    if (!catalogPageData) {
        return (
            <div className='grid min-h-[calc(100vh-3.5rem)] place-items-center bg-richblack-900'>
                <div className='spinner'></div>
            </div>
        )
    }

    const sortedCategoryCourses = [
        ...(catalogPageData?.data?.selectedCategory?.courses || []),
    ].sort((a, b) => {
        if (active === 1) {
            return (b?.studentEnrolled?.length || 0) - (a?.studentEnrolled?.length || 0)
        }
        return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    })

    return (
        <div className='bg-richblack-900'>
            {/* Hero Section */}
            <div className='box-content bg-richblack-800 px-4'>
                <div className='mx-auto flex min-h-[260px] max-w-maxContentTab flex-col justify-center gap-4 lg:max-w-maxContent'>
                    <p className='text-sm text-richblack-300'>
                        {`Home / Catalog / `}
                        <span className='text-yellow-25'>
                            {catalogPageData?.data?.selectedCategory?.name}
                        </span>
                    </p>
                    <p className='text-3xl text-richblack-5'>
                        {catalogPageData?.data?.selectedCategory?.name}
                    </p>
                    <p className='max-w-[870px] text-richblack-200'>
                        {catalogPageData?.data?.selectedCategory?.description}
                    </p>
                </div>
            </div>

            {/* Section 1 - Courses in selected category */}
            <div className='mx-auto box-content w-full max-w-maxContentTab px-4 py-12 lg:max-w-maxContent'>
                <div className='text-3xl text-richblack-5 font-bold mb-6'>
                    Courses to get you started
                </div>
                <div className='my-4 flex border-b border-b-richblack-600 text-sm'>
                    <p
                        className={`px-4 py-2 ${
                            active === 1
                                ? "border-b border-b-yellow-25 text-yellow-25"
                                : "text-richblack-50"
                        } cursor-pointer`}
                        onClick={() => setActive(1)}
                    >
                        Most Popular
                    </p>
                    <p
                        className={`px-4 py-2 ${
                            active === 2
                                ? "border-b border-b-yellow-25 text-yellow-25"
                                : "text-richblack-50"
                        } cursor-pointer`}
                        onClick={() => setActive(2)}
                    >
                        New
                    </p>
                </div>
                <div>
                    {sortedCategoryCourses.length > 0 ? (
                        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3'>
                            {sortedCategoryCourses.map((course, i) => (
                                <CourseCard course={course} key={course._id || i} Height={"h-[250px]"} />
                            ))}
                        </div>
                    ) : (
                        <p className='text-xl text-richblack-5'>No courses found</p>
                    )}
                </div>
            </div>

            {/* Section 2 - Top courses in different category */}
            {catalogPageData?.data?.differentCategory?.courses?.length > 0 && (
                <div className='mx-auto box-content w-full max-w-maxContentTab px-4 py-12 lg:max-w-maxContent'>
                    <div className='text-3xl text-richblack-5 font-bold mb-6'>
                        Top courses in {catalogPageData?.data?.differentCategory?.name}
                    </div>
                    <div className='py-8'>
                        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3'>
                            {catalogPageData?.data?.differentCategory?.courses
                                ?.slice(0, 6)
                                .map((course, i) => (
                                    <CourseCard course={course} key={i} Height={"h-[250px]"} />
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Section 3 - Frequently bought/Most selling */}
            {catalogPageData?.data?.mostSellingCourses?.length > 0 && (
                <div className='mx-auto box-content w-full max-w-maxContentTab px-4 py-12 lg:max-w-maxContent'>
                    <div className='text-3xl text-richblack-5 font-bold mb-6'>
                        Frequently Bought
                    </div>
                    <div className='py-8'>
                        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3'>
                            {catalogPageData?.data?.mostSellingCourses
                                ?.slice(0, 6)
                                .map((course, i) => (
                                    <CourseCard course={course} key={i} Height={"h-[250px]"} />
                                ))}
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    )
}

export default Catalog
