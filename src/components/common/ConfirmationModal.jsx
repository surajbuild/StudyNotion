import React from "react";
import IconBtn from "./IconBtn";

const ConfirmationModal = ({ modalData }) => {
    return (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-richblack-900/40 backdrop-blur-sm">

            {/* Modal card */}
            <div className="w-11/12 max-w-[380px] rounded-xl border border-richblack-600
            bg-richblack-800 p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]">

                {/* Title */}
                <p className="text-2xl font-semibold text-richblack-5">
                    {modalData?.text1}
                </p>

                {/* Description */}
                <p className="mt-3 mb-6 text-sm leading-6 text-richblack-200">
                    {modalData?.text2}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-x-4">
                    {/* Primary action (e.g. "Delete", "Logout") */}
                    <IconBtn
                        onClick={modalData?.btn1Handler}
                        text={modalData?.btn1Text}
                    />

                    {/* Secondary/cancel action */}
                    <button
                        onClick={modalData?.btn2Handler}
                        className="rounded-md bg-richblack-700 px-5 py-2 text-sm font-semibold
                        text-richblack-100 hover:bg-richblack-600 transition-all duration-200"
                    >
                        {modalData?.btn2Text}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
