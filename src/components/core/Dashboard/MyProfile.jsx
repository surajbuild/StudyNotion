import React from 'react'
import { useNavigate } from 'react-router-dom'
import { RiEditBoxLine } from "react-icons/ri";
import { useSelector } from 'react-redux';

const MyProfile = () => {

   const { user } = useSelector((state) => state.profile)
   const navigate = useNavigate();

   return (
      <div className="w-full max-w-5xl mx-auto">
         {/* Page Title */}
         <h1 className='mb-14 text-3xl font-semibold tracking-tight text-richblack-5'>
            My Profile
         </h1>

         {/* Section 1 - Profile Picture & Basic Info */}
         <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border border-richblack-700 bg-richblack-800/90 p-5 sm:p-8 px-5 sm:px-12 shadow-[0_0_40px_-15px_rgba(0,0,0,0.6)] gap-5'>
            <div className='flex items-center gap-x-4 sm:gap-x-5'>
               <img 
                  src={user?.image}
                  alt={`profile-${user?.firstName}`}
                  className='aspect-square w-[64px] sm:w-[78px] rounded-full object-cover ring-2 ring-yellow-100/40'
               />
               <div className='space-y-1'>
                  <p className='text-base sm:text-lg font-semibold text-richblack-5'>
                     {user?.firstName + ' ' + user?.lastName}
                  </p>
                  <p className='text-xs sm:text-sm text-richblack-300 break-all'>
                     {user?.email}
                  </p>
               </div>
            </div>

            <button
               onClick={() => navigate("/dashboard/settings")}
               className='flex items-center gap-x-2 rounded-md bg-yellow-50 py-2 px-5 font-semibold text-richblack-900 
               hover:bg-yellow-100 hover:scale-[1.02] transition-all duration-200 shadow-md'
            >
               <RiEditBoxLine className="text-lg" />
               Edit
            </button>
         </div>

         {/* Section 2 - Personal Details */}
         <div className='my-8 sm:my-10 flex flex-col gap-y-6 sm:gap-y-10 rounded-xl border border-richblack-700 bg-richblack-800/90 p-5 sm:p-8 px-5 sm:px-12 shadow-[0_0_40px_-15px_rgba(0,0,0,0.6)]'>
            
            <div className='flex w-full items-center justify-between'>
               <p className='text-base sm:text-lg font-semibold text-richblack-5'>
                  Personal Details
               </p>

               <button
                  onClick={() => navigate("/dashboard/settings")}
                  className='flex items-center gap-x-2 rounded-md bg-yellow-50 py-2 px-5 font-semibold text-richblack-900 
                  hover:bg-yellow-100 hover:scale-[1.02] transition-all duration-200 shadow-md'
               >
                  <RiEditBoxLine className="text-lg" />
                  Edit
               </button>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 max-w-[520px] gap-6 sm:gap-x-12'>
               {/* Left Column */}
               <div className='flex flex-col gap-y-6'>
                  <div>
                     <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                        First Name
                     </p>
                     <p className='text-sm font-medium text-richblack-5'>
                        {user?.firstName}
                     </p>
                  </div>

                  <div>
                     <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                        Email
                     </p>
                     <p className='text-sm font-medium text-richblack-5 break-all'>
                        {user?.email}
                     </p>
                  </div>
               </div>

               {/* Right Column */}
               <div className='flex flex-col gap-y-6'>
                  <div>
                     <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                        Last Name
                     </p>
                     <p className='text-sm font-medium text-richblack-5'>
                        {user?.lastName}
                     </p>
                  </div>

                  <div>
                     <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                        Phone Number
                     </p>
                     <p className='text-sm font-medium text-richblack-5'>
                        {user?.additionalDetails?.contactNumber ?? (
                           <span className="text-richblack-400 italic">
                              Add Contact Number
                           </span>
                        )}
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   )
}

export default MyProfile
