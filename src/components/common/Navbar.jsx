import React, { useEffect, useState, useCallback } from "react";
import { Link, matchPath, useLocation, useNavigate } from "react-router-dom";
import Logo from "../../assets/Logo/Logo-Full-Light.png";
import { NavbarLinks } from "../../data/navbar-links";
import { useSelector, useDispatch } from "react-redux";
import { AiOutlineShoppingCart } from "react-icons/ai";
import { HiMenu, HiX } from "react-icons/hi";
import { VscDashboard, VscSignOut, VscSettingsGear } from "react-icons/vsc";
import ProfileDropdown from "../core/Auth/ProfileDropdown";
import { apiConnector } from "../../services/apiconnector";
import { categories } from "../../services/apis";
import { FaArrowDown } from "react-icons/fa";
import { logout } from "../../services/operations/authAPI";
import { ACCOUNT_TYPE } from "../../utils/constants";

const Navbar = () => {
  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);
  const { totalItems } = useSelector((state) => state.cart);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [subLinks, setSubLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchSubLinks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiConnector("GET", categories.CATEGORIES_API);
      setSubLinks(result.data.data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setSubLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubLinks();
  }, [fetchSubLinks]);

  const matchRoute = (route) => matchPath({ path: route }, location.pathname);

  return (
    <div
      className={`relative z-50 flex h-14 items-center justify-center border-b border-richblack-700 ${
        location.pathname !== "/" ? "bg-richblack-800" : ""
      } transition-all duration-200`}
    >
      <div className="flex w-11/12 max-w-maxContent items-center justify-between">

        {/* Logo */}
        <Link to="/">
          <img src={Logo} alt="StudyNotion Logo" width={160} height={42} loading="lazy" />
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:block">
          <ul className="flex items-center gap-x-6 text-richblack-25">
            {NavbarLinks.map((link, index) => (
              <li key={index} className="relative">
                {link.title === "Catalog" ? (
                  <div className="group relative flex cursor-pointer items-center gap-2">
                    <p>{link.title}</p>
                    <FaArrowDown className="text-sm transition-all duration-200 group-hover:rotate-180" />

                    {/* Catalog dropdown */}
                    <div className="invisible absolute left-[50%] top-[50%] z-[1000] flex w-[200px] translate-x-[-50%] translate-y-[3em] flex-col rounded-lg bg-richblack-5 p-4 text-richblack-900 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-[1.65em] group-hover:opacity-100 lg:w-[300px]">
                      <div className="absolute left-[50%] top-0 -z-10 h-6 w-6 translate-x-[80%] translate-y-[-40%] rotate-45 select-none rounded bg-richblack-5"></div>
                      {loading ? (
                        <p className="text-center text-sm text-richblack-400">Loading...</p>
                      ) : subLinks?.filter((s) => s?.name?.trim()).length > 0 ? (
                        subLinks
                          .filter((s) => s?.name?.trim())
                          .map((subLink, i) => (
                            <Link
                              key={i}
                              to={`/catalog/${subLink.name.split(" ").join("-").toLowerCase()}`}
                              className="rounded-lg py-4 pl-4 hover:bg-richblack-50"
                            >
                              {subLink.name}
                            </Link>
                          ))
                      ) : (
                        <p className="text-center text-sm text-richblack-400">No Categories Found</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Link to={link?.path}>
                    <p className={`transition-colors duration-200 ${
                      matchRoute(link?.path) ? "text-yellow-25" : "text-richblack-25 hover:text-yellow-25"
                    }`}>
                      {link.title}
                    </p>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Right side — cart, login/signup, profile */}
        <div className="flex items-center gap-x-3">
          {user && user?.accountType !== "Instructor" && (
            <Link to="/dashboard/cart" className="relative">
              <AiOutlineShoppingCart className="text-2xl text-richblack-100" />
              {totalItems > 0 && (
                <span className="absolute -bottom-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-richblack-600 text-xs font-bold text-yellow-100">
                  {totalItems}
                </span>
              )}
            </Link>
          )}

          {/* Desktop login/signup */}
          {token === null && (
            <div className="hidden md:flex gap-x-3">
              <Link to="/login">
                <button className="rounded-lg border border-richblack-700 bg-richblack-800 px-3 py-2 text-sm text-richblack-100 hover:bg-richblack-700 transition-all duration-200">
                  Log in
                </button>
              </Link>
              <Link to="/signup">
                <button className="rounded-lg border border-richblack-700 bg-richblack-800 px-3 py-2 text-sm text-richblack-100 hover:bg-richblack-700 transition-all duration-200">
                  Sign up
                </button>
              </Link>
            </div>
          )}

          {token !== null && <ProfileDropdown />}

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden ml-1 text-richblack-100 text-2xl"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <HiX /> : <HiMenu />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="absolute top-14 left-0 right-0 z-40 flex flex-col gap-y-1 bg-richblack-800 border-b border-richblack-700 px-5 py-4 shadow-lg md:hidden">

          {/* Nav links */}
          {NavbarLinks.map((link, index) => (
            <div key={index}>
              {link.title === "Catalog" ? (
                <div className="flex flex-col">
                  <p className="py-2 text-richblack-100 font-medium">Catalog</p>
                  <div className="ml-4 flex flex-col gap-y-1">
                    {loading ? (
                      <p className="text-sm text-richblack-400">Loading...</p>
                    ) : subLinks?.filter((s) => s?.name?.trim()).length > 0 ? (
                      subLinks.filter((s) => s?.name?.trim()).map((subLink, i) => (
                        <Link
                          key={i}
                          to={`/catalog/${subLink.name.split(" ").join("-").toLowerCase()}`}
                          className="py-1.5 text-sm text-richblack-300 hover:text-yellow-50 transition-colors"
                        >
                          {subLink.name}
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-richblack-400">No Categories</p>
                    )}
                  </div>
                </div>
              ) : (
                <Link
                  to={link.path}
                  className={`block py-2 text-sm font-medium transition-colors duration-200 ${
                    matchRoute(link.path) ? "text-yellow-25" : "text-richblack-200 hover:text-yellow-25"
                  }`}
                >
                  {link.title}
                </Link>
              )}
            </div>
          ))}

          {/* Login / Signup for mobile (only when logged out) */}
          {token === null && (
            <div className="mt-3 flex flex-col gap-y-2 border-t border-richblack-700 pt-3">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full rounded-lg border border-richblack-700 bg-richblack-900 py-2 text-sm text-richblack-100 hover:bg-richblack-700 transition-all">
                  Log in
                </button>
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full rounded-lg bg-yellow-50 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100 transition-all">
                  Sign up
                </button>
              </Link>
            </div>
          )}

          {/* Authenticated user menu in mobile drawer */}
          {token !== null && (
            <div className="mt-3 flex flex-col gap-y-2 border-t border-richblack-700 pt-3">
              <div className="flex items-center gap-x-3 px-1 py-2">
                <img
                  src={user?.image}
                  alt={`profile-${user?.firstName}`}
                  className="aspect-square w-[34px] rounded-full object-cover ring-1 ring-yellow-50"
                />
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-richblack-5">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-richblack-400 capitalize">
                    {user?.accountType}
                  </p>
                </div>
              </div>

              <Link
                to="/dashboard/my-profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
              >
                <VscDashboard className="text-lg" />
                <span>Dashboard</span>
              </Link>

              {user?.accountType === ACCOUNT_TYPE.STUDENT && (
                <>
                  <Link
                    to="/dashboard/enrolled-courses"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
                  >
                    <span>Enrolled Courses</span>
                  </Link>
                  <Link
                    to="/dashboard/cart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
                  >
                    <span>Wishlist ({totalItems})</span>
                  </Link>
                </>
              )}

              {user?.accountType === ACCOUNT_TYPE.INSTRUCTOR && (
                <>
                  <Link
                    to="/dashboard/instructor"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
                  >
                    <span>Instructor Dashboard</span>
                  </Link>
                  <Link
                    to="/dashboard/my-courses"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
                  >
                    <span>My Courses</span>
                  </Link>
                  <Link
                    to="/dashboard/add-course"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
                  >
                    <span>Add Course</span>
                  </Link>
                </>
              )}

              <Link
                to="/dashboard/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-x-2 py-2 text-sm text-richblack-200 hover:text-yellow-25"
              >
                <VscSettingsGear className="text-lg" />
                <span>Settings</span>
              </Link>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  dispatch(logout(navigate));
                }}
                className="flex items-center gap-x-2 py-2 text-sm text-pink-200 hover:text-pink-100 transition-colors"
              >
                <VscSignOut className="text-lg" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Navbar;
