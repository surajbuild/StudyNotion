import { ACCOUNT_TYPE } from "../utils/constants";

export const sidebarLinks = [
  {
    id: 1,
    name: "My Profile",
    path: "/dashboard/my-profile",
    icon: "VscAccount",
  },
  {
    id: 2,
    name: "Dashboard",
    path: "/dashboard/instructor",
    type: ACCOUNT_TYPE.INSTRUCTOR,
    icon: "VscDashboard",
  },
  {
    id: 3,
    name: "My Courses",
    path: "/dashboard/my-courses",
    type: ACCOUNT_TYPE.INSTRUCTOR,
    icon: "VscVm",
  },
  {
    id: 4,
    name: "Add Course",
    path: "/dashboard/add-course",
    type: ACCOUNT_TYPE.INSTRUCTOR,
    icon: "VscAdd",
  },
  {
    id: 5,
    name: "Enrolled Courses",
    path: "/dashboard/enrolled-courses",
    type: ACCOUNT_TYPE.STUDENT,
    icon: "VscMortarBoard",
  },
  {
    id: 6,
    name: "Your Cart",
    path: "/dashboard/cart",
    type: ACCOUNT_TYPE.STUDENT,
    // ✅ FIX: Was "VscHistory" (a clock/history icon — completely wrong).
    // The react-icons/vsc set doesn't include a shopping-cart icon, but
    // "VscArchive" looks like a box/container which is the closest available.
    // If you want an exact cart icon, switch SidebarLink.jsx to use
    // react-icons/hi2 (HiShoppingCart) or react-icons/bi (BiCart) instead.
    icon: "VscArchive",
  },
  {
    id: 9,
    name: "Order History",
    path: "/dashboard/order-history",
    type: ACCOUNT_TYPE.STUDENT,
    icon: "VscHistory",
  },
  {
    id: 7,
    name: "Admin Dashboard",
    path: "/dashboard/admin",
    type: ACCOUNT_TYPE.ADMIN,
    icon: "VscDashboard",
  },
  {
    id: 8,
    name: "Manage Categories",
    path: "/dashboard/admin/categories",
    type: ACCOUNT_TYPE.ADMIN,
    icon: "VscFolderLibrary",
  },
];
