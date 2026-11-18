import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import { FiArrowLeft, FiUsers, FiBookOpen, FiCheckCircle, FiBarChart2 } from "react-icons/fi";
import { fetchCourseEnrolledStudents } from "../../../../services/operations/courseDetailsAPI";
import { formattedDate } from "../../../../utils/dateFormatter";

const ITEMS_PER_PAGE = 8;

const CourseStudents = () => {
  const { courseId } = useParams();
  const { token } = useSelector((state) => state.auth);

  const [courseInfo, setCourseInfo] = useState(null);
  const [summary, setSummary] = useState({
    totalEnrolled: 0,
    totalLectures: 0,
    averageCompletionPercentage: 0,
    completedStudentsCount: 0,
  });
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: ITEMS_PER_PAGE,
    totalStudents: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadRoster = useCallback(async () => {
    if (!token || !courseId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchCourseEnrolledStudents(
        courseId,
        {
          search: debouncedSearch,
          page,
          limit: ITEMS_PER_PAGE,
        },
        token
      );
      setCourseInfo(data?.course || null);
      if (data?.summary) {
        setSummary(data.summary);
      }
      setStudents(Array.isArray(data?.students) ? data.students : []);
      if (data?.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err?.message || "Failed to load enrolled students.");
    } finally {
      setLoading(false);
    }
  }, [courseId, debouncedSearch, page, token]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  return (
    <div className="flex w-full flex-col gap-6 text-richblack-5">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-richblack-400">
            <Link to="/dashboard/my-courses" className="hover:text-yellow-50">
              My Courses
            </Link>
            <span>/</span>
            <span className="text-richblack-200">Enrolled Students</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-richblack-5 sm:text-3xl">
              {courseInfo?.courseName ? `${courseInfo.courseName} — Students` : "Enrolled Students"}
            </h1>
            {courseInfo?.status && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  courseInfo.status === "Published"
                    ? "border border-caribbeangreen-300/40 bg-caribbeangreen-900/40 text-caribbeangreen-200"
                    : "border border-pink-400/40 bg-pink-900/40 text-pink-200"
                }`}
              >
                {courseInfo.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-richblack-300">
            Monitor enrolled learners and track their course completion progress.
          </p>
        </div>

        <Link
          to="/dashboard/my-courses"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-richblack-600 bg-richblack-800 px-4 py-2 text-sm font-medium text-richblack-100 transition-colors hover:bg-richblack-700"
        >
          <FiArrowLeft />
          <span>Back to My Courses</span>
        </Link>
      </div>

      {/* Course Progress KPI Summary */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        data-testid="roster-summary-grid"
      >
        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-richblack-400">
            <FiUsers className="text-yellow-50" />
            <span>Enrolled Students</span>
          </div>
          <p
            data-testid="roster-total-enrolled"
            className="mt-1.5 text-2xl font-bold text-richblack-5"
          >
            {summary.totalEnrolled}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-richblack-400">
            <FiBookOpen className="text-blue-200" />
            <span>Total Lectures</span>
          </div>
          <p
            data-testid="roster-total-lectures"
            className="mt-1.5 text-2xl font-bold text-richblack-5"
          >
            {summary.totalLectures}
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-richblack-400">
            <FiBarChart2 className="text-caribbeangreen-200" />
            <span>Avg. Completion</span>
          </div>
          <p
            data-testid="roster-avg-completion"
            className="mt-1.5 text-2xl font-bold text-richblack-5"
          >
            {summary.averageCompletionPercentage}%
          </p>
        </div>

        <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-richblack-400">
            <FiCheckCircle className="text-caribbeangreen-200" />
            <span>Completed (100%)</span>
          </div>
          <p
            data-testid="roster-completed-count"
            className="mt-1.5 text-2xl font-bold text-caribbeangreen-200"
          >
            {summary.completedStudentsCount}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-xl border border-richblack-700 bg-richblack-800 p-4">
        <div className="relative flex items-center">
          <AiOutlineSearch className="pointer-events-none absolute left-3 text-lg text-richblack-400" />
          <input
            type="text"
            aria-label="Search enrolled students by name or email"
            placeholder="Search enrolled students by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-richblack-600 bg-richblack-900 py-2 pl-10 pr-10 text-sm text-richblack-5 placeholder-richblack-400 focus:border-yellow-50 focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear student search"
              onClick={() => setSearchInput("")}
              className="absolute right-3 text-richblack-400 hover:text-richblack-100"
            >
              <AiOutlineClose />
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Loading / Error / Empty / Roster */}
      {loading ? (
        <div
          role="status"
          aria-label="Loading enrolled students"
          className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-richblack-700 bg-richblack-800 p-8"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
          <p className="text-sm text-richblack-300">Loading enrolled students...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
        >
          <p className="text-base font-semibold text-pink-200">
            Unable to load enrolled students
          </p>
          <p className="max-w-md text-sm text-richblack-300">{error}</p>
          <button
            type="button"
            onClick={loadRoster}
            className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
          >
            Retry
          </button>
        </div>
      ) : students.length === 0 ? (
        <div
          data-testid="roster-empty-state"
          className="rounded-xl border border-richblack-700 bg-richblack-800 p-10 text-center"
        >
          <p className="text-base font-semibold text-richblack-100">
            {debouncedSearch
              ? "No enrolled students match your search"
              : "No students enrolled yet"}
          </p>
          <p className="mt-1 text-sm text-richblack-400">
            {debouncedSearch
              ? "Try a different student name or email, or clear the search filter."
              : "Students who enroll in this course will appear here along with their progress."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-richblack-700 bg-richblack-800 md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-richblack-700 bg-richblack-900/70 text-xs uppercase tracking-wide text-richblack-400">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Enrolled Date</th>
                  <th className="px-4 py-3">Lectures</th>
                  <th className="px-4 py-3">Completion Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-richblack-700">
                {students.map((student) => {
                  const pct = student.progress?.completionPercentage ?? 0;
                  const completed = student.progress?.completedLectures ?? 0;
                  const total = student.progress?.totalLectures ?? 0;
                  const remaining = student.progress?.remainingLectures ?? 0;

                  return (
                    <tr
                      key={student._id}
                      data-testid={`roster-row-${student.email}`}
                      className="transition-colors hover:bg-richblack-700/30"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.image}
                            alt={`${student.firstName} ${student.lastName}`}
                            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-richblack-5">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="truncate text-xs text-richblack-300">
                              {student.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-richblack-200">
                        {student.enrolledAt ? (
                          formattedDate(student.enrolledAt)
                        ) : (
                          <span className="italic text-richblack-400">Not recorded</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-richblack-200">
                        <p className="font-medium text-richblack-5">
                          {completed} / {total} completed
                        </p>
                        <p className="text-richblack-400">
                          {remaining} {remaining === 1 ? "lecture" : "lectures"} remaining
                        </p>
                      </td>
                      <td className="min-w-[220px] px-4 py-3.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-richblack-5">{pct}%</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              pct === 100 && total > 0
                                ? "bg-caribbeangreen-900/50 text-caribbeangreen-200"
                                : pct > 0
                                  ? "bg-blue-900/50 text-blue-100"
                                  : "bg-richblack-700 text-richblack-300"
                            }`}
                          >
                            {total === 0
                              ? "No lectures"
                              : pct === 100
                                ? "Completed"
                                : pct > 0
                                  ? "In Progress"
                                  : "Not Started"}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${student.firstName} ${student.lastName} progress`}
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-richblack-700"
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct === 100 && total > 0 ? "bg-caribbeangreen-300" : "bg-blue-200"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
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
            {students.map((student) => {
              const pct = student.progress?.completionPercentage ?? 0;
              const completed = student.progress?.completedLectures ?? 0;
              const total = student.progress?.totalLectures ?? 0;
              const remaining = student.progress?.remainingLectures ?? 0;

              return (
                <div
                  key={student._id}
                  className="rounded-xl border border-richblack-700 bg-richblack-800 p-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={student.image}
                      alt={`${student.firstName} ${student.lastName}`}
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-richblack-5">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="truncate text-xs text-richblack-300">{student.email}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-richblack-700 pt-3 text-xs text-richblack-300">
                    <span>
                      Enrolled:{" "}
                      {student.enrolledAt ? (
                        <strong className="text-richblack-100">
                          {formattedDate(student.enrolledAt)}
                        </strong>
                      ) : (
                        <span className="italic text-richblack-400">Not recorded</span>
                      )}
                    </span>
                    <span>
                      {completed}/{total} lectures ({remaining} left)
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-richblack-300">Completion</span>
                      <span className="font-semibold text-richblack-5">{pct}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${student.firstName} ${student.lastName} progress`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-richblack-700"
                    >
                      <div
                        className={`h-full rounded-full ${
                          pct === 100 && total > 0 ? "bg-caribbeangreen-300" : "bg-blue-200"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
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
              {pagination.totalStudents}{" "}
              {pagination.totalStudents === 1 ? "student" : "students"})
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
    </div>
  );
};

export default CourseStudents;
