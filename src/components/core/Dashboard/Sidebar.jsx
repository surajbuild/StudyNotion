import React, { useState } from 'react'
import { sidebarLinks } from '../../../data/dashboard-links'
import { logout } from '../../../services/operations/authAPI'
import { useDispatch, useSelector } from 'react-redux'
import SidebarLink from './SidebarLink'
import { useNavigate } from 'react-router-dom'
import { VscSignOut } from 'react-icons/vsc'
import { HiMenu, HiX } from 'react-icons/hi'
import ConfirmationModal from '../../common/ConfirmationModal'
import { ACCOUNT_TYPE, isInstructorApproved } from '../../../utils/constants'

const Sidebar = () => {
    const { user, loading: profileLoading } = useSelector((state) => state.profile);
    const { loading: authLoading } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [confirmationModal, setConfirmationModal] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    if (profileLoading || authLoading) {
        return (
            <div className='grid h-[calc(100vh-3.5rem)] min-w-[240px] place-items-center border-r border-richblack-700 bg-richblack-800'>
                <div className='spinner'></div>
            </div>
        )
    }

    const SidebarContent = () => (
        <div className='flex h-full flex-col py-10'>
            {/* Top Links */}
            <div className='flex flex-col gap-y-1'>
                {sidebarLinks.map((link) => {
                    if (link.type && user?.accountType !== link.type) return null;
                    if (
                        link.requiresApproval &&
                        user?.accountType === ACCOUNT_TYPE.INSTRUCTOR &&
                        !isInstructorApproved(user)
                    ) {
                        return null;
                    }
                    return (
                        <div key={link.id} onClick={() => setMobileOpen(false)}>
                            <SidebarLink link={link} iconName={link.icon} />
                        </div>
                    )
                })}
            </div>

            {/* Divider */}
            <div className='mx-auto my-8 h-[1px] w-10/12 bg-richblack-700'></div>

            {/* Bottom Actions */}
            <div className='flex flex-col gap-y-1'>
                <div onClick={() => setMobileOpen(false)}>
                    <SidebarLink
                        link={{ name: "Settings", path: "/dashboard/settings" }}
                        iconName="VscSettingsGear"
                    />
                </div>

                <button
                    onClick={() => {
                        setMobileOpen(false);
                        setConfirmationModal({
                            text1: 'Are you sure?',
                            text2: "You will be logged out of your account.",
                            btn1Text: "Logout",
                            btn2Text: "Cancel",
                            btn1Handler: () => dispatch(logout(navigate)),
                            btn2Handler: () => setConfirmationModal(null),
                        });
                    }}
                    className='group flex items-center gap-x-2 px-8 py-2 text-sm font-medium
                    text-richblack-300 hover:bg-richblack-700 hover:text-pink-200
                    transition-all duration-200'
                >
                    <VscSignOut className='text-lg group-hover:text-pink-300' />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    )

    return (
        <>
            {/* ── Mobile toggle button (shown only on small screens) ── */}
            <button
                className='fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center
                rounded-full bg-yellow-50 text-richblack-900 shadow-lg md:hidden'
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label="Toggle sidebar"
            >
                {mobileOpen ? <HiX className='text-xl' /> : <HiMenu className='text-xl' />}
            </button>

            {/* ── Mobile overlay backdrop ── */}
            {mobileOpen && (
                <div
                    className='fixed inset-0 z-30 bg-black/50 md:hidden'
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Mobile slide-in drawer ── */}
            <div className={`fixed top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-[240px]
                border-r border-richblack-700 bg-richblack-800 shadow-xl
                transition-transform duration-300 ease-in-out md:hidden
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <SidebarContent />
            </div>

            {/* ── Desktop static sidebar ── */}
            <div className='hidden md:flex h-[calc(100vh-3.5rem)] min-w-[240px] flex-col
                border-r border-richblack-700 bg-richblack-800
                shadow-[4px_0_25px_-15px_rgba(0,0,0,0.6)]'
            >
                <SidebarContent />
            </div>

            {confirmationModal && (
                <ConfirmationModal modalData={confirmationModal} />
            )}
        </>
    )
}

export default Sidebar
