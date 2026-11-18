import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import { searchCourses } from "../../services/operations/courseDetailsAPI";

const DEBOUNCE_MS = 300;
const PREVIEW_LIMIT = 5;

const NavbarSearch = ({
  inputId = "navbar-course-search",
  className = "",
  autoFocus = false,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [totalCourses, setTotalCourses] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const runPreviewSearch = useCallback(async (searchText) => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setResults([]);
      setTotalCourses(0);
      setError("");
      setLoading(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const data = await searchCourses({ q: trimmed, limit: PREVIEW_LIMIT, page: 1 });
      if (currentRequestId !== requestIdRef.current) return;
      setResults(Array.isArray(data?.courses) ? data.courses : []);
      setTotalCourses(data?.pagination?.totalCourses ?? 0);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      setResults([]);
      setTotalCourses(0);
      setError(err?.message || "Unable to search courses right now.");
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced live search while typing
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      requestIdRef.current += 1;
      setResults([]);
      setTotalCourses(0);
      setError("");
      setLoading(false);
      return undefined;
    }

    if (!isOpen) return undefined;

    const timer = setTimeout(() => {
      runPreviewSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, isOpen, runPreviewSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (e.nativeEvent?.isComposing) return;
    const trimmed = query.trim();
    setIsOpen(false);
    const target = trimmed ? `/courses?q=${encodeURIComponent(trimmed)}` : "/courses";
    navigate(target);
    if (typeof onNavigate === "function") onNavigate();
  };

  const handleClear = () => {
    requestIdRef.current += 1;
    setQuery("");
    setResults([]);
    setTotalCourses(0);
    setError("");
    setLoading(false);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSelectCourse = (courseId) => {
    setIsOpen(false);
    navigate(`/courses/${courseId}`);
    if (typeof onNavigate === "function") onNavigate();
  };

  const handleBrowseAll = () => {
    const trimmed = query.trim();
    setIsOpen(false);
    navigate(trimmed ? `/courses?q=${encodeURIComponent(trimmed)}` : "/courses");
    if (typeof onNavigate === "function") onNavigate();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const trimmedQuery = query.trim();
  const showDropdown = isOpen && trimmedQuery.length > 0;

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Global course search"
        className="relative flex items-center"
      >
          <label htmlFor={inputId} className="sr-only">
            Search courses
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="search"
            value={query}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search courses..."
            onFocus={() => {
              if (query.trim().length > 0) setIsOpen(true);
            }}
            onChange={(e) => {
              const nextVal = e.target.value;
              setQuery(nextVal);
              setIsOpen(nextVal.trim().length > 0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-richblack-600 bg-richblack-700 py-1.5 pl-3 pr-16 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-yellow-50"
          />

          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-8 flex h-7 w-7 items-center justify-center rounded text-richblack-300 hover:text-richblack-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-50"
            >
              <AiOutlineClose className="text-sm" />
            </button>
          )}

          <button
            type="submit"
            aria-label="Submit course search"
            className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded text-richblack-200 hover:text-yellow-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-50"
          >
            <AiOutlineSearch className="text-lg" />
          </button>
      </form>

      {showDropdown && (
        <div
          role="region"
          aria-label="Search suggestions"
          aria-live="polite"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[1100] max-h-[420px] overflow-y-auto rounded-lg border border-richblack-600 bg-richblack-800 shadow-xl"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-richblack-200">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-richblack-400 border-t-yellow-50" />
              <span>Searching courses...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 px-4 py-4 text-center text-sm">
              <p className="text-pink-200">{error}</p>
              <button
                type="button"
                onClick={() => runPreviewSearch(trimmedQuery)}
                className="rounded-md bg-richblack-700 px-3 py-1 text-xs font-medium text-yellow-50 hover:bg-richblack-600"
              >
                Retry
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-5 text-center text-sm text-richblack-300">
              <p>No courses found for &quot;{trimmedQuery}&quot;.</p>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/courses");
                  if (typeof onNavigate === "function") onNavigate();
                }}
                className="text-xs font-medium text-yellow-50 hover:underline"
              >
                Browse all courses
              </button>
            </div>
          ) : (
            <div>
              <ul className="divide-y divide-richblack-700">
                {results.map((course) => (
                  <li key={course._id}>
                    <button
                      type="button"
                      onClick={() => handleSelectCourse(course._id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-richblack-700"
                    >
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt={course.courseName}
                          className="h-10 w-14 flex-shrink-0 rounded object-cover bg-richblack-900"
                        />
                      ) : (
                        <div className="h-10 w-14 flex-shrink-0 rounded bg-richblack-700" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-richblack-5">
                          {course.courseName}
                        </p>
                        <p className="truncate text-xs text-richblack-300">
                          {course.instructor
                            ? `${course.instructor.firstName || ""} ${course.instructor.lastName || ""}`.trim()
                            : "StudyNotion Instructor"}
                          {course.averageRating > 0 ? ` • ★ ${course.averageRating}` : ""}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-xs font-semibold ${
                          Number(course.price) === 0
                            ? "text-caribbeangreen-100"
                            : "text-yellow-50"
                        }`}
                      >
                        {Number(course.price) === 0 ? "Free" : `₹${course.price}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="border-t border-richblack-700 bg-richblack-900/60 px-3 py-2 text-center">
                <button
                  type="button"
                  onClick={handleBrowseAll}
                  className="text-xs font-semibold text-yellow-50 hover:underline"
                >
                  View all {totalCourses} {totalCourses === 1 ? "result" : "results"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NavbarSearch;
