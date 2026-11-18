import React from 'react'
import * as Icons from 'react-icons/vsc'
import { matchPath, NavLink, useLocation } from 'react-router-dom';

const SidebarLink = ({ link, iconName }) => {

    const Icon = Icons[iconName];
    const location = useLocation();

    const matchRoute = (route) => {
        return matchPath({ path: route }, location.pathname);
    }

    const isActive = matchRoute(link.path);

    return (
        <NavLink
            to={link.path}
            className={`group relative flex items-center gap-x-3 px-8 py-2.5 text-sm font-medium 
            transition-all duration-200
            ${
                isActive
                    ? 'bg-yellow-800/80 text-yellow-50'
                    : 'text-richblack-300 hover:bg-richblack-700 hover:text-richblack-50'
            }`}
        >
            {/* Active Indicator */}
            <span
                className={`absolute left-0 top-0 h-full w-[0.18rem] rounded-r-md bg-yellow-50
                transition-all duration-300
                ${
                    isActive
                        ? 'opacity-100 shadow-[0_0_12px_rgba(255,214,0,0.6)]'
                        : 'opacity-0'
                }`}
            ></span>

            {/* Icon */}
            <Icon
                className={`text-lg transition-colors duration-200
                ${
                    isActive
                        ? 'text-yellow-50'
                        : 'text-richblack-400 group-hover:text-richblack-50'
                }`}
            />

            {/* Text */}
            <span>{link.name}</span>
        </NavLink>
    )
}

export default SidebarLink
