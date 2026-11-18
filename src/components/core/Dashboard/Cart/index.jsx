import { useSelector } from "react-redux"
import RenderCartCourses from "./renderCartCourses"
import RenderTotalAmount from "./renderTotalAmount"

export default function Cart() {
    const { totalItems } = useSelector((state) => state.cart)

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] w-full">
            <div className="mx-auto w-11/12 max-w-[1000px] py-10">
                <h1 className="mb-8 text-3xl font-medium text-richblack-5 lg:mb-14">
                    My Wishlist
                </h1>
                
                <p className="border-b border-b-richblack-400 pb-2 text-sm font-semibold text-richblack-400 lg:text-base">
                    {totalItems} Courses in Wishlist
                </p>

                {/* ✅ FIX: was `total > 0` — fails for free courses (price=0) and
                    any localStorage mismatch. Must check item count, not price total. */}
                {totalItems > 0 ? (
                    <div className="mt-6 flex flex-col items-start gap-6 lg:mt-8 lg:flex-row lg:gap-x-10">
                        {/* Cart Courses */}
                        <RenderCartCourses />
                        
                        {/* Total Amount */}
                        <RenderTotalAmount />
                    </div>
                ) : (
                    <p className="mt-10 text-center text-2xl text-richblack-100 lg:mt-14 lg:text-3xl">
                        Your Cart is Empty
                    </p>
                )}
            </div>
        </div>
    )
}
