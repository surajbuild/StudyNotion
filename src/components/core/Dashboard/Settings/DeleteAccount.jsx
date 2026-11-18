import React, { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { deleteProfile } from "../../../../services/operations/SettingsAPI"
import { FiTrash2 } from "react-icons/fi"
import ConfirmationModal from "../../../common/ConfirmationModal"

const DeleteAccount = () => {
  const { token } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [confirmationModal, setConfirmationModal] = useState(null)

  const handleDeleteAccount = () => {
    setConfirmationModal({
      text1: "Delete Account Permanently?",
      text2: "This action cannot be undone. All your courses, progress, and profile data will be removed.",
      btn1Text: "Delete",
      btn2Text: "Cancel",
      btn1Handler: () => {
        setConfirmationModal(null)
        dispatch(deleteProfile(token, navigate))
      },
      btn2Handler: () => setConfirmationModal(null),
    })
  }

  return (
    <div className="my-12 rounded-xl border border-pink-700 bg-pink-900/80 p-8 shadow-sm">
      <div className="flex gap-6">
        
        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-700/80">
          <FiTrash2 className="text-2xl text-pink-200" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-richblack-5">
            Delete Account
          </h2>

          <div className="max-w-[520px] text-sm text-pink-100/90 space-y-1">
            <p>Are you sure you want to delete your account?</p>
            <p>
              This account may contain paid courses. Deleting your account is
              permanent and will remove all content associated with it.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDeleteAccount}
            className="mt-2 w-fit text-sm italic text-pink-300 
                       hover:text-pink-200 transition underline-offset-4 hover:underline"
          >
            I want to permanently delete my account
          </button>
        </div>
      </div>
      {confirmationModal && <ConfirmationModal modalData={confirmationModal} />}
    </div>
  )
}

export default DeleteAccount
