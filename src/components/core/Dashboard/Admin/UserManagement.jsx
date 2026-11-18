import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import { FiCheckCircle, FiXCircle, FiEye } from "react-icons/fi";
import ConfirmationModal from "../../../common/ConfirmationModal";
import { formattedDate } from "../../../../utils/dateFormatter";
import { ACCOUNT_TYPE, APPROVAL_STATUS } from "../../../../utils/constants";
import {
  fetchAdminUserStats,
  fetchAdminUsers,
  fetchAdminUserDetails,
  approveInstructor,
  rejectInstructor,
} from "../../../../services/operations/adminAPI";

const ITEMS_PER_PAGE = 8;

const FILTER_TABS = [
  { id: "ALL", label: "All Users", accountType: "ALL", approvalStatus: "ALL" },
  {
    id: "PENDING",
    label: "Pending Instructors",
    accountType: ACCOUNT_TYPE.INSTRUCTOR,
    approvalStatus: APPROVAL_STATUS.PENDING,
  },
  {
    id: "APPROVED",
    label: "Approved Instructors",
    accountType: ACCOUNT_TYPE.INSTRUCTOR,
    approvalStatus: APPROVAL_STATUS.APPROVED,
  },
  {
    id: "REJECTED",
    label: "Rejected Instructors",
    accountType: ACCOUNT_TYPE.INSTRUCTOR,
    approvalStatus: APPROVAL_STATUS.REJECTED,
  },
  {
    id: "STUDENTS",
    label: "Students",
    accountType: ACCOUNT_TYPE.STUDENT,
    approvalStatus: "ALL",
  },
  {
    id: "ADMINS",
    label: "Admins",
    accountType: ACCOUNT_TYPE.ADMIN,
    approvalStatus: "ALL",
  },
];

const ApprovalStatusBadge = ({ accountType, approvalStatus }) => {
  if (accountType !== ACCOUNT_TYPE.INSTRUCTOR) {
    return <span className="text-xs text-richblack-400">N/A</span>;
  }

  if (approvalStatus === APPROVAL_STATUS.PENDING) {
    return (
      <span className="inline-flex items-center rounded-full border border-yellow-50/40 bg-yellow-900/40 px-2.5 py-0.5 text-xs font-semibold text-yellow-50">
        Pending
      </span>
    );
  }

  if (approvalStatus === APPROVAL_STATUS.REJECTED) {
    return (
      <span className="inline-flex items-center rounded-full border border-pink-400/40 bg-pink-900/40 px-2.5 py-0.5 text-xs font-semibold text-pink-200">
        Rejected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-caribbeangreen-300/40 bg-caribbeangreen-900/40 px-2.5 py-0.5 text-xs font-semibold text-caribbeangreen-200">
      Approved
    </span>
  );
};

const AccountTypeBadge = ({ accountType }) => {
  if (accountType === ACCOUNT_TYPE.ADMIN) {
    return (
      <span className="inline-flex items-center rounded-full border border-yellow-50/40 bg-yellow-900/40 px-2.5 py-0.5 text-xs font-medium text-yellow-50">
        Admin
      </span>
    );
  }
  if (accountType === ACCOUNT_TYPE.INSTRUCTOR) {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-300/40 bg-blue-900/40 px-2.5 py-0.5 text-xs font-medium text-blue-100">
        Instructor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-richblack-700 px-2.5 py-0.5 text-xs font-medium text-richblack-100">
      Student
    </span>
  );
};

const UserManagement = () => {
  const { token } = useSelector((state) => state.auth);
  const { user: currentUser } = useSelector((state) => state.profile);
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = FILTER_TABS.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "ALL";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalInstructors: 0,
    pendingInstructors: 0,
    approvedInstructors: 0,
    rejectedInstructors: 0,
    totalAdmins: 0,
  });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: ITEMS_PER_PAGE,
    totalUsers: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUserId, setBusyUserId] = useState(null);

  // Approve confirmation modal
  const [confirmationModal, setConfirmationModal] = useState(null);

  // Reject confirmation modal (supports optional reason)
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState("");

  // User details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    const statsData = await fetchAdminUserStats(token);
    if (statsData) {
      setStats(statsData);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const tabConfig = FILTER_TABS.find((t) => t.id === activeTab) || FILTER_TABS[0];
      const [statsRes, usersRes] = await Promise.all([
        fetchAdminUserStats(token),
        fetchAdminUsers(
          {
            search: debouncedSearch,
            accountType: tabConfig.accountType,
            approvalStatus: tabConfig.approvalStatus,
            page,
            limit: ITEMS_PER_PAGE,
          },
          token
        ),
      ]);
      setStats(statsRes);
      setUsers(Array.isArray(usersRes?.users) ? usersRes.users : []);
      if (usersRes?.pagination) {
        setPagination(usersRes.pagination);
      }
    } catch (err) {
      setError(err?.message || "Failed to load user management data.");
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, debouncedSearch, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
    if (tabId === "ALL") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", tabId);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const openDetailsModal = async (userRow) => {
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setDetailsError("");
    setSelectedUserDetails(userRow);
    try {
      const fullDetails = await fetchAdminUserDetails(userRow._id, token);
      setSelectedUserDetails(fullDetails);
    } catch (err) {
      setDetailsError(err?.message || "Failed to load user details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedUserDetails(null);
    setDetailsError("");
  };

  const requestApprove = (targetUser) => {
    setConfirmationModal({
      text1: "Approve Instructor?",
      text2: `Approve ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})? They will immediately gain access to create and publish courses.`,
      btn1Text: "Approve Instructor",
      btn2Text: "Cancel",
      btn1Handler: async () => {
        setConfirmationModal(null);
        setBusyUserId(targetUser._id);
        const res = await approveInstructor(targetUser._id, token);
        setBusyUserId(null);
        if (res.success) {
          if (selectedUserDetails?._id === targetUser._id) {
            setSelectedUserDetails(res.data);
          }
          await loadUsers();
        }
      },
      btn2Handler: () => setConfirmationModal(null),
    });
  };

  const openRejectModal = (targetUser) => {
    setRejectTarget(targetUser);
    setRejectReason("");
    setRejectReasonError("");
  };

  const closeRejectModal = () => {
    if (busyUserId) return;
    setRejectTarget(null);
    setRejectReason("");
    setRejectReasonError("");
  };

  const confirmReject = async (e) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (rejectReason.trim().length > 500) {
      setRejectReasonError("Rejection reason must be 500 characters or fewer.");
      return;
    }

    setBusyUserId(rejectTarget._id);
    const res = await rejectInstructor(rejectTarget._id, rejectReason, token);
    setBusyUserId(null);

    if (res.success) {
      if (selectedUserDetails?._id === rejectTarget._id) {
        setSelectedUserDetails(res.data);
      }
      setRejectTarget(null);
      setRejectReason("");
      setRejectReasonError("");
      await loadUsers();
      await loadStats();
    } else {
      setRejectReasonError(res.message || "Could not reject instructor.");
    }
  };

  const canApproveUser = (u) =>
    u.accountType === ACCOUNT_TYPE.INSTRUCTOR &&
    String(u._id) !== String(currentUser?._id) &&
    (u.approvalStatus === APPROVAL_STATUS.PENDING ||
      u.approvalStatus === APPROVAL_STATUS.REJECTED);

  const canRejectUser = (u) =>
    u.accountType === ACCOUNT_TYPE.INSTRUCTOR &&
    String(u._id) !== String(currentUser?._id) &&
    u.approvalStatus === APPROVAL_STATUS.PENDING;

  return (
    <div className="flex flex-col gap-6 text-richblack-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-richblack-400">
            <Link to="/dashboard/admin" className="hover:text-yellow-50">
              Admin Dashboard
            </Link>
            <span>/</span>
            <span className="text-richblack-200">User Management</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-richblack-5 sm:text-3xl">
            User &amp; Instructor Management
          </h1>
          <p className="mt-1 text-sm text-richblack-300">
            Review instructor onboarding applications and monitor platform accounts.
          </p>
        </div>

        <Link
          to="/dashboard/admin/categories"
          className="inline-flex items-center justify-center rounded-lg border border-richblack-600 bg-richblack-800 px-4 py-2 text-sm font-medium text-richblack-100 transition-colors hover:bg-richblack-700"
        >
          Manage Categories
        </Link>
      </div>

      {/* Overview Statistics */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7"
        data-testid="admin-user-stats-grid"
      >
        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-richblack-400">
            Total Users
          </p>
          <p
            data-testid="stat-total-users"
            className="mt-1 text-2xl font-bold text-richblack-5"
          >
            {stats.totalUsers}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-richblack-400">
            Students
          </p>
          <p
            data-testid="stat-total-students"
            className="mt-1 text-2xl font-bold text-richblack-5"
          >
            {stats.totalStudents}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-richblack-400">
            Instructors
          </p>
          <p
            data-testid="stat-total-instructors"
            className="mt-1 text-2xl font-bold text-blue-100"
          >
            {stats.totalInstructors}
          </p>
        </div>

        <div className="rounded-xl border border-yellow-50/30 bg-richblack-800 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-yellow-200">
            Pending
          </p>
          <p
            data-testid="stat-pending-instructors"
            className="mt-1 text-2xl font-bold text-yellow-50"
          >
            {stats.pendingInstructors}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-richblack-400">
            Approved
          </p>
          <p
            data-testid="stat-approved-instructors"
            className="mt-1 text-2xl font-bold text-caribbeangreen-200"
          >
            {stats.approvedInstructors}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-richblack-400">
            Rejected
          </p>
          <p
            data-testid="stat-rejected-instructors"
            className="mt-1 text-2xl font-bold text-pink-200"
          >
            {stats.rejectedInstructors}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-richblack-400">
            Admins
          </p>
          <p
            data-testid="stat-total-admins"
            className="mt-1 text-2xl font-bold text-richblack-5"
          >
            {stats.totalAdmins}
          </p>
        </div>
      </div>

      {/* Filter Tabs + Search Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-richblack-700 bg-richblack-800 p-4">
        <div
          role="tablist"
          aria-label="Filter users by role or approval status"
          className="flex flex-wrap gap-2"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  isActive
                    ? "bg-yellow-50 text-richblack-900"
                    : "border border-richblack-600 bg-richblack-900 text-richblack-200 hover:bg-richblack-700"
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === "PENDING" && stats.pendingInstructors > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      isActive
                        ? "bg-richblack-900 text-yellow-50"
                        : "bg-yellow-900/60 text-yellow-50"
                    }`}
                  >
                    {stats.pendingInstructors}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center">
          <AiOutlineSearch className="pointer-events-none absolute left-3 text-lg text-richblack-400" />
          <input
            type="text"
            aria-label="Search users by name or email"
            placeholder="Search by first name, last name, or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-richblack-600 bg-richblack-900 py-2 pl-10 pr-10 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchInput("")}
              className="absolute right-3 text-richblack-400 hover:text-richblack-100"
            >
              <AiOutlineClose />
            </button>
          )}
        </div>
      </div>

      {/* Loading / Error / Empty / Table */}
      {loading ? (
        <div
          role="status"
          aria-label="Loading users"
          className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-richblack-700 bg-richblack-800 p-8"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
          <p className="text-sm text-richblack-300">Loading users...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
        >
          <p className="text-base font-semibold text-pink-200">Unable to load users</p>
          <p className="max-w-md text-sm text-richblack-300">{error}</p>
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-10 text-center">
          <p className="text-base font-medium text-richblack-200">
            No matching users found
          </p>
          <p className="mt-1 text-sm text-richblack-400">
            Try switching filter tabs or adjusting your search query.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-richblack-700 bg-richblack-800 md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-richblack-700 bg-richblack-900/70 text-xs uppercase tracking-wide text-richblack-400">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3">Approval Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-richblack-700">
                {users.map((u) => {
                  const isBusy = busyUserId === u._id;
                  return (
                    <tr
                      key={u._id}
                      data-testid={`user-row-${u.email}`}
                      className="transition-colors hover:bg-richblack-700/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.image}
                            alt={`${u.firstName} ${u.lastName}`}
                            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-richblack-5">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="truncate text-xs text-richblack-300">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <AccountTypeBadge accountType={u.accountType} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-richblack-300">
                        {u.createdAt ? formattedDate(u.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ApprovalStatusBadge
                          accountType={u.accountType}
                          approvalStatus={u.approvalStatus}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`View details for ${u.email}`}
                            onClick={() => openDetailsModal(u)}
                            className="inline-flex items-center gap-1 rounded-md border border-richblack-600 bg-richblack-900 px-2.5 py-1.5 text-xs font-medium text-richblack-100 hover:bg-richblack-700"
                          >
                            <FiEye />
                            <span>Details</span>
                          </button>

                          {canApproveUser(u) && (
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Approve ${u.email}`}
                              onClick={() => requestApprove(u)}
                              className="inline-flex items-center gap-1 rounded-md bg-caribbeangreen-300 px-2.5 py-1.5 text-xs font-semibold text-richblack-900 hover:bg-caribbeangreen-200 disabled:opacity-50"
                            >
                              <FiCheckCircle />
                              <span>Approve</span>
                            </button>
                          )}

                          {canRejectUser(u) && (
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Reject ${u.email}`}
                              onClick={() => openRejectModal(u)}
                              className="inline-flex items-center gap-1 rounded-md border border-pink-500/60 bg-pink-900/40 px-2.5 py-1.5 text-xs font-semibold text-pink-100 hover:bg-pink-900/70 disabled:opacity-50"
                            >
                              <FiXCircle />
                              <span>Reject</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (<768px) */}
          <div className="flex flex-col gap-3 md:hidden">
            {users.map((u) => {
              const isBusy = busyUserId === u._id;
              return (
                <div
                  key={u._id}
                  className="rounded-xl border border-richblack-700 bg-richblack-800 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={u.image}
                        alt={`${u.firstName} ${u.lastName}`}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-richblack-5">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="truncate text-xs text-richblack-300">{u.email}</p>
                      </div>
                    </div>
                    <AccountTypeBadge accountType={u.accountType} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-richblack-700 pt-3 text-xs">
                    <span className="text-richblack-400">
                      Joined {u.createdAt ? formattedDate(u.createdAt) : "—"}
                    </span>
                    <ApprovalStatusBadge
                      accountType={u.accountType}
                      approvalStatus={u.approvalStatus}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-label={`View details for ${u.email}`}
                      onClick={() => openDetailsModal(u)}
                      className="inline-flex items-center gap-1 rounded-md border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-richblack-100"
                    >
                      <FiEye />
                      <span>Details</span>
                    </button>

                    {canApproveUser(u) && (
                      <button
                        type="button"
                        disabled={isBusy}
                        aria-label={`Approve ${u.email}`}
                        onClick={() => requestApprove(u)}
                        className="inline-flex items-center gap-1 rounded-md bg-caribbeangreen-300 px-3 py-1.5 text-xs font-semibold text-richblack-900 disabled:opacity-50"
                      >
                        <FiCheckCircle />
                        <span>Approve</span>
                      </button>
                    )}

                    {canRejectUser(u) && (
                      <button
                        type="button"
                        disabled={isBusy}
                        aria-label={`Reject ${u.email}`}
                        onClick={() => openRejectModal(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-pink-500/60 bg-pink-900/40 px-3 py-1.5 text-xs font-semibold text-pink-100 disabled:opacity-50"
                      >
                        <FiXCircle />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-richblack-700 bg-richblack-800 px-4 py-3 text-xs text-richblack-300 sm:flex-row sm:text-sm">
            <p>
              Showing page <span className="font-semibold text-richblack-5">{pagination.page}</span>{" "}
              of <span className="font-semibold text-richblack-5">{pagination.totalPages}</span> (
              {pagination.totalUsers} {pagination.totalUsers === 1 ? "user" : "users"})
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-richblack-100 hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-richblack-100 hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* User / Instructor Details Modal */}
      {detailsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-details-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-richblack-600 bg-richblack-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-richblack-700 pb-3">
              <h2 id="user-details-modal-title" className="text-lg font-bold text-richblack-5">
                User Details
              </h2>
              <button
                type="button"
                aria-label="Close user details"
                onClick={closeDetailsModal}
                className="rounded-md p-1 text-richblack-300 hover:bg-richblack-700 hover:text-richblack-5"
              >
                <AiOutlineClose />
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex min-h-[160px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
              </div>
            ) : detailsError ? (
              <p role="alert" className="py-6 text-sm text-pink-200">
                {detailsError}
              </p>
            ) : selectedUserDetails ? (
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedUserDetails.image}
                    alt={`${selectedUserDetails.firstName} ${selectedUserDetails.lastName}`}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-yellow-50/40"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-richblack-5">
                      {selectedUserDetails.firstName} {selectedUserDetails.lastName}
                    </p>
                    <p className="truncate text-xs text-richblack-300">
                      {selectedUserDetails.email}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <AccountTypeBadge accountType={selectedUserDetails.accountType} />
                      {selectedUserDetails.accountType === ACCOUNT_TYPE.INSTRUCTOR && (
                        <ApprovalStatusBadge
                          accountType={selectedUserDetails.accountType}
                          approvalStatus={selectedUserDetails.approvalStatus}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg border border-richblack-700 bg-richblack-900 p-4 text-xs">
                  <div>
                    <p className="text-richblack-400">Registered</p>
                    <p className="mt-0.5 font-medium text-richblack-100">
                      {selectedUserDetails.createdAt
                        ? formattedDate(selectedUserDetails.createdAt)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-richblack-400">Courses</p>
                    <p className="mt-0.5 font-medium text-richblack-100">
                      {selectedUserDetails.coursesCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-richblack-400">Contact Number</p>
                    <p className="mt-0.5 font-medium text-richblack-100">
                      {selectedUserDetails.contactNumber || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-richblack-400">Gender</p>
                    <p className="mt-0.5 font-medium text-richblack-100">
                      {selectedUserDetails.additionalDetails?.gender || "Not provided"}
                    </p>
                  </div>
                </div>

                {selectedUserDetails.additionalDetails?.about && (
                  <div className="rounded-lg border border-richblack-700 bg-richblack-900 p-3 text-xs">
                    <p className="text-richblack-400">About</p>
                    <p className="mt-1 text-richblack-100">
                      {selectedUserDetails.additionalDetails.about}
                    </p>
                  </div>
                )}

                {selectedUserDetails.approvalReviewedAt && (
                  <p className="text-xs text-richblack-300">
                    Last reviewed on {formattedDate(selectedUserDetails.approvalReviewedAt)}
                    {selectedUserDetails.approvalReviewedBy?.email
                      ? ` by ${selectedUserDetails.approvalReviewedBy.email}`
                      : ""}
                  </p>
                )}

                {selectedUserDetails.rejectionReason && (
                  <div className="rounded-lg border border-pink-700/40 bg-pink-900/20 p-3 text-xs">
                    <p className="font-semibold text-pink-200">Rejection Note</p>
                    <p className="mt-1 text-richblack-100">
                      {selectedUserDetails.rejectionReason}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 border-t border-richblack-700 pt-4">
                  {canApproveUser(selectedUserDetails) && (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailsModal();
                        requestApprove(selectedUserDetails);
                      }}
                      className="rounded-lg bg-caribbeangreen-300 px-4 py-2 text-xs font-semibold text-richblack-900 hover:bg-caribbeangreen-200"
                    >
                      Approve Instructor
                    </button>
                  )}
                  {canRejectUser(selectedUserDetails) && (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailsModal();
                        openRejectModal(selectedUserDetails);
                      }}
                      className="rounded-lg border border-pink-500/60 bg-pink-900/40 px-4 py-2 text-xs font-semibold text-pink-100 hover:bg-pink-900/70"
                    >
                      Reject Application
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    className="rounded-lg border border-richblack-600 bg-richblack-900 px-4 py-2 text-xs font-medium text-richblack-100 hover:bg-richblack-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Reject Instructor Confirmation Dialog */}
      {rejectTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-instructor-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <form
            onSubmit={confirmReject}
            className="w-full max-w-md rounded-xl border border-richblack-600 bg-richblack-800 p-6 shadow-2xl"
          >
            <h2
              id="reject-instructor-modal-title"
              className="text-lg font-bold text-richblack-5"
            >
              Reject Instructor Application?
            </h2>
            <p className="mt-2 text-sm text-richblack-300">
              You are about to reject{" "}
              <span className="font-semibold text-richblack-5">
                {rejectTarget.firstName} {rejectTarget.lastName}
              </span>{" "}
              ({rejectTarget.email}). They will not be able to create or publish courses.
            </p>

            <div className="mt-4">
              <label
                htmlFor="reject-reason-input"
                className="block text-xs font-medium text-richblack-200"
              >
                Optional Note / Reason (shared with applicant)
              </label>
              <textarea
                id="reject-reason-input"
                rows={3}
                maxLength={500}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setRejectReasonError("");
                }}
                placeholder="e.g., Please provide teaching credentials or portfolio details."
                className="mt-1.5 w-full rounded-lg border border-richblack-600 bg-richblack-900 p-2.5 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none"
              />
              {rejectReasonError && (
                <p role="alert" className="mt-1 text-xs text-pink-200">
                  {rejectReasonError}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(busyUserId)}
                onClick={closeRejectModal}
                className="rounded-lg border border-richblack-600 bg-richblack-900 px-4 py-2 text-sm font-medium text-richblack-200 hover:bg-richblack-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(busyUserId)}
                className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-60"
              >
                {busyUserId ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {confirmationModal && <ConfirmationModal modalData={confirmationModal} />}
    </div>
  );
};

export default UserManagement;
