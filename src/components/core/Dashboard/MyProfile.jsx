import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiEditBoxLine } from "react-icons/ri";
import { useSelector } from 'react-redux';
import {
   ACCOUNT_TYPE,
   APPROVAL_STATUS,
   getInstructorApprovalStatus,
} from '../../../utils/constants';

const MyProfile = () => {

   const { user } = useSelector((state) => state.profile)
   const navigate = useNavigate();
   const instructorApprovalStatus =
      user?.accountType === ACCOUNT_TYPE.INSTRUCTOR
         ? getInstructorApprovalStatus(user)
         : null;

   return (
      <div className="w-full max-w-5xl mx-auto">
         {/* Page Title */}
         <h1 className='mb-8 text-3xl font-semibold tracking-tight text-richblack-5'>
            My Profile
         </h1>

         {/* Instructor Approval Status Banner (when Pending or Rejected) */}
         {instructorApprovalStatus === APPROVAL_STATUS.PENDING && (
            <div
               role="status"
               data-testid="profile-instructor-pending-banner"
               className="mb-8 flex flex-col gap-3 rounded-xl border border-yellow-50/40 bg-yellow-900/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
               <div>
                  <p className="text-sm font-semibold text-yellow-50">
                     Instructor Application Pending Approval
                  </p>
                  <p className="mt-0.5 text-xs text-richblack-200">
                     Your account is awaiting administrator review. Course creation and publishing will unlock once approved.
                  </p>
               </div>
               <Link
                  to="/dashboard/instructor"
                  className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-yellow-50 px-4 py-2 text-xs font-semibold text-richblack-900 hover:bg-yellow-100"
               >
                  View Status
               </Link>
            </div>
         )}

         {instructorApprovalStatus === APPROVAL_STATUS.REJECTED && (
            <div
               role="alert"
               data-testid="profile-instructor-rejected-banner"
               className="mb-8 flex flex-col gap-3 rounded-xl border border-pink-500/40 bg-pink-900/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
               <div>
                  <p className="text-sm font-semibold text-pink-200">
                     Instructor Application Not Approved
                  </p>
                  <p className="mt-0.5 text-xs text-richblack-200">
                     {user?.rejectionReason ||
                        "Your instructor application was not approved. Please contact support for assistance."}
                  </p>
               </div>
               <Link
                  to="/dashboard/instructor"
                  className="inline-flex flex-shrink-0 items-center justify-center rounded-lg border border-pink-400/50 bg-pink-900/40 px-4 py-2 text-xs font-semibold text-pink-100 hover:bg-pink-900/70"
               >
                  View Details
               </Link>
            </div>
         )}

         {/* Section 1 - Profile Picture & Basic Info */}
         <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border border-richblack-700 bg-richblack-800/90 p-5 sm:p-8 px-5 sm:px-12 shadow-[0_0_40px_-15px_rgba(0,0,0,0.6)] gap-5'>
            <div className='flex items-center gap-x-4 sm:gap-x-5'>
               <img 
                  src={user?.image}
                  alt={`profile-${user?.firstName}`}
                  className='aspect-square w-[64px] sm:w-[78px] rounded-full object-cover ring-2 ring-yellow-100/40'
               />
               <div className='space-y-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                     <p className='text-base sm:text-lg font-semibold text-richblack-5'>
                        {user?.firstName + ' ' + user?.lastName}
                     </p>
                     {instructorApprovalStatus && (
                        <span
                           data-testid="profile-approval-badge"
                           className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              instructorApprovalStatus === APPROVAL_STATUS.APPROVED
                                 ? "border border-caribbeangreen-300/40 bg-caribbeangreen-900/40 text-caribbeangreen-200"
                                 : instructorApprovalStatus === APPROVAL_STATUS.REJECTED
                                   ? "border border-pink-400/40 bg-pink-900/40 text-pink-200"
                                   : "border border-yellow-50/40 bg-yellow-900/40 text-yellow-50"
                           }`}
                        >
                           {instructorApprovalStatus === APPROVAL_STATUS.APPROVED
                              ? "Approved Instructor"
                              : instructorApprovalStatus === APPROVAL_STATUS.REJECTED
                                ? "Rejected"
                                : "Pending Approval"}
                        </span>
                     )}
                  </div>
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

                  <div>
                     <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                        Gender
                     </p>
                     <p className='text-sm font-medium text-richblack-5'>
                        {user?.additionalDetails?.gender || (
                           <span className="text-richblack-400 italic">Add Gender</span>
                        )}
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
                        {user?.additionalDetails?.contactNumber || (
                           <span className="text-richblack-400 italic">
                              Add Contact Number
                           </span>
                        )}
                     </p>
                  </div>

                  <div>
                     <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                        Date Of Birth
                     </p>
                     <p className='text-sm font-medium text-richblack-5'>
                        {user?.additionalDetails?.dateOfBirth || (
                           <span className="text-richblack-400 italic">Add Date of Birth</span>
                        )}
                     </p>
                  </div>
               </div>
            </div>

            <div>
               <p className='mb-1 text-xs uppercase tracking-wide text-richblack-500'>
                  About
               </p>
               <p className='text-sm font-medium text-richblack-5'>
                  {user?.additionalDetails?.about || (
                     <span className="text-richblack-400 italic">Write something about yourself</span>
                  )}
               </p>
            </div>
         </div>
      </div>
   )
}

export default MyProfile
