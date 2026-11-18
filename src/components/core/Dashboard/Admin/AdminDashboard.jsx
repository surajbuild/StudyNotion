import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { VscFolderLibrary, VscAccount, VscSettingsGear, VscOrganization } from "react-icons/vsc";
import {
  fetchAdminDashboard,
  fetchAdminUserStats,
} from "../../../../services/operations/adminAPI";

const AdminDashboard = () => {
  const { user } = useSelector((state) => state.profile);
  const { token } = useSelector((state) => state.auth);

  const [dashboardData, setDashboardData] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, uStats] = await Promise.all([
        fetchAdminDashboard(token),
        fetchAdminUserStats(token).catch(() => null),
      ]);
      setDashboardData(data);
      setUserStats(uStats);
    } catch (err) {
      setError(err?.message || "Failed to load admin overview.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token, loadDashboard]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading admin dashboard"
        className="flex min-h-[360px] flex-col items-center justify-center gap-3"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
        <p className="text-sm text-richblack-300">Loading admin dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
      >
        <p className="text-lg font-semibold text-pink-200">Unable to load Admin Dashboard</p>
        <p className="max-w-md text-sm text-richblack-300">{error}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    totalCategories: 0,
    emptyCategories: 0,
    totalCourses: 0,
    publishedCourses: 0,
    draftCourses: 0,
    totalUsers: 0,
    totalStudents: 0,
    totalInstructors: 0,
    totalAdmins: 0,
  };
  const categories = Array.isArray(dashboardData?.categories)
    ? dashboardData.categories
    : [];

  return (
    <div className="flex flex-col gap-8 text-richblack-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-richblack-5 sm:text-3xl">
              Admin Dashboard
            </h1>
            <span className="rounded-full border border-yellow-50/40 bg-yellow-900/40 px-2.5 py-0.5 text-xs font-semibold text-yellow-50">
              Admin
            </span>
          </div>
          <p className="mt-1 text-sm text-richblack-300">
            Welcome back, {user?.firstName} {user?.lastName}. Manage StudyNotion categories and
            monitor catalog health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/admin/users"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-yellow-50/40 bg-richblack-800 px-4 py-2.5 text-sm font-semibold text-yellow-50 transition-colors hover:bg-richblack-700"
          >
            <VscOrganization className="text-lg" />
            <span>Manage Users</span>
            {userStats?.pendingInstructors > 0 && (
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-bold text-richblack-900">
                {userStats.pendingInstructors}
              </span>
            )}
          </Link>
          <Link
            to="/dashboard/admin/categories"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-50 px-5 py-2.5 text-sm font-semibold text-richblack-900 transition-colors hover:bg-yellow-100"
          >
            <VscFolderLibrary className="text-lg" />
            <span>Manage Categories</span>
          </Link>
        </div>
      </div>

      {/* Pending Instructor Approval Callout */}
      {userStats && userStats.pendingInstructors > 0 && (
        <div
          role="status"
          data-testid="admin-pending-instructors-banner"
          className="flex flex-col gap-3 rounded-xl border border-yellow-50/40 bg-yellow-900/20 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-yellow-50">
              {userStats.pendingInstructors} Pending Instructor{" "}
              {userStats.pendingInstructors === 1 ? "Application" : "Applications"}
            </p>
            <p className="mt-0.5 text-xs text-richblack-200">
              Review pending instructor applications to grant or deny course creation access.
            </p>
          </div>
          <Link
            to="/dashboard/admin/users?tab=PENDING"
            className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-yellow-50 px-4 py-2 text-xs font-semibold text-richblack-900 hover:bg-yellow-100"
          >
            Review Pending Applications →
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-richblack-400">
            Total Categories
          </p>
          <p className="mt-2 text-3xl font-bold text-richblack-5">{stats.totalCategories}</p>
          <p className="mt-1 text-xs text-richblack-300">
            {stats.emptyCategories} without courses
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-richblack-400">
            Total Courses
          </p>
          <p className="mt-2 text-3xl font-bold text-richblack-5">{stats.totalCourses}</p>
          <p className="mt-1 text-xs text-richblack-300">
            {stats.publishedCourses} published • {stats.draftCourses} draft
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-richblack-400">
            Total Users
          </p>
          <p className="mt-2 text-3xl font-bold text-richblack-5">{stats.totalUsers}</p>
          <p className="mt-1 text-xs text-richblack-300">
            {stats.totalStudents} students • {stats.totalInstructors} instructors
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-richblack-400">
            Administrators
          </p>
          <p className="mt-2 text-3xl font-bold text-yellow-50">{stats.totalAdmins}</p>
          <p className="mt-1 text-xs text-richblack-300">Authorized platform admins</p>
        </div>
      </div>

      {/* Category Summary + Admin Account Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Categories */}
        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-richblack-5">Catalog Categories</h2>
            <Link
              to="/dashboard/admin/categories"
              className="text-sm font-medium text-yellow-50 hover:underline"
            >
              Manage all →
            </Link>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-lg border border-richblack-700 bg-richblack-900 p-6 text-center">
              <p className="text-sm text-richblack-300">No categories have been created yet.</p>
              <Link
                to="/dashboard/admin/categories"
                className="mt-3 inline-block rounded-lg bg-yellow-50 px-4 py-2 text-xs font-semibold text-richblack-900 hover:bg-yellow-100"
              >
                Create First Category
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-richblack-700">
              {categories.slice(0, 6).map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-richblack-5">
                      {cat.name}
                    </p>
                    <p className="truncate text-xs text-richblack-300">
                      {cat.description || "No description"}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="rounded-full bg-richblack-700 px-2.5 py-1 text-xs font-medium text-richblack-100">
                      {cat.totalCourseCount}{" "}
                      {cat.totalCourseCount === 1 ? "course" : "courses"}
                    </span>
                    <Link
                      to={`/catalog/${cat.slug}`}
                      className="text-xs font-medium text-yellow-50 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Account Summary */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-richblack-700 bg-richblack-800 p-6">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-richblack-5">Admin Account</h2>
            <div className="flex items-center gap-3">
              <img
                src={user?.image}
                alt={`profile-${user?.firstName}`}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-yellow-50/40"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-richblack-5">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs text-richblack-300">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-richblack-700 pt-4">
            <Link
              to="/dashboard/my-profile"
              className="flex items-center gap-2 rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-2 text-sm text-richblack-100 hover:bg-richblack-700"
            >
              <VscAccount />
              <span>View Profile</span>
            </Link>
            <Link
              to="/dashboard/settings"
              className="flex items-center gap-2 rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-2 text-sm text-richblack-100 hover:bg-richblack-700"
            >
              <VscSettingsGear />
              <span>Account Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
