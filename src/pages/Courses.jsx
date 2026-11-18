import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import { FiFilter } from "react-icons/fi";
import Footer from "../components/common/Footer";
import CourseCard from "../components/core/Catalog/CourseCard";
import { apiConnector } from "../services/apiconnector";
import { categories as categoryApis } from "../services/apis";
import { searchCourses } from "../services/operations/courseDetailsAPI";

const DEFAULT_LIMIT = 9;
const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
];

const PRICE_TYPE_OPTIONS = [
  { value: "all", label: "All Courses" },
  { value: "free", label: "Free (₹0)" },
  { value: "paid", label: "Paid" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any Rating" },
  { value: "4", label: "4★ & up" },
  { value: "3", label: "3★ & up" },
  { value: "2", label: "2★ & up" },
  { value: "1", label: "1★ & up" },
];

const buildPaginationRange = (currentPage, totalPages) => {
  if (totalPages <= 1) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("ellipsis-start");
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  if (end < totalPages - 1) pages.push("ellipsis-end");
  pages.push(totalPages);
  return pages;
};

const Courses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestIdRef = useRef(0);

  // Extract synchronized URL query parameters
  const qParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("category") || "";
  const priceTypeParam = searchParams.get("priceType") || "all";
  const minPriceParam = searchParams.get("minPrice") || "";
  const maxPriceParam = searchParams.get("maxPrice") || "";
  const minRatingParam = searchParams.get("minRating") || "";
  const sortParam = searchParams.get("sort") || "newest";
  const pageParamRaw = searchParams.get("page") || "1";
  const limitParamRaw = searchParams.get("limit") || "";

  const parsedPage = /^\d+$/.test(pageParamRaw) && Number(pageParamRaw) >= 1 ? Number(pageParamRaw) : 1;
  const parsedLimit =
    /^\d+$/.test(limitParamRaw) && Number(limitParamRaw) >= 1
      ? Math.min(Number(limitParamRaw), 50)
      : DEFAULT_LIMIT;

  // Local controlled input state for debounced search & price inputs
  const [searchInput, setSearchInput] = useState(qParam);
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);
  const [priceRangeError, setPriceRangeError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Categories list for filter dropdown
  const [categoryList, setCategoryList] = useState([]);

  // Results & UI state
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({
    page: parsedPage,
    limit: parsedLimit,
    totalCourses: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  // Keep local text inputs in sync when URL changes externally (e.g., Navbar search / Back button)
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  useEffect(() => {
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
    setPriceRangeError("");
  }, [minPriceParam, maxPriceParam]);

  // Helper to update URL query params cleanly
  const updateQueryParams = useCallback(
    (updates, { resetPage = true } = {}) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, val]) => {
          const strVal = val === undefined || val === null ? "" : String(val).trim();
          if (
            strVal === "" ||
            (key === "priceType" && strVal === "all") ||
            (key === "sort" && strVal === "newest") ||
            (key === "page" && strVal === "1")
          ) {
            next.delete(key);
          } else {
            next.set(key, strVal);
          }
        });
        if (resetPage && !("page" in updates)) {
          next.delete("page");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // Debounce search box input -> URL `q` parameter
  useEffect(() => {
    const trimmedInput = searchInput.trim();
    if (trimmedInput === qParam.trim()) return undefined;

    const timer = setTimeout(() => {
      updateQueryParams({ q: trimmedInput }, { resetPage: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, qParam, updateQueryParams]);

  // Load categories once for the category filter
  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const res = await apiConnector("GET", categoryApis.CATEGORIES_API);
        if (isMounted && Array.isArray(res?.data?.data)) {
          setCategoryList(res.data.data.filter((c) => c?._id && c?.name?.trim()));
        }
      } catch {
        // Non-blocking: search & other filters continue working even if categories fail
      }
    };
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch filtered, sorted, paginated courses from backend whenever URL params change
  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;

    const loadCourses = async () => {
      setLoading(true);
      setError("");

      const apiParams = {
        page: parsedPage,
        limit: parsedLimit,
        sort: sortParam,
      };
      if (qParam.trim()) apiParams.q = qParam.trim();
      if (categoryParam) apiParams.category = categoryParam;
      if (priceTypeParam && priceTypeParam !== "all") apiParams.priceType = priceTypeParam;
      if (minPriceParam !== "") apiParams.minPrice = minPriceParam;
      if (maxPriceParam !== "") apiParams.maxPrice = maxPriceParam;
      if (minRatingParam !== "") apiParams.minRating = minRatingParam;

      try {
        const data = await searchCourses(apiParams);
        if (currentRequestId !== requestIdRef.current) return;
        setCourses(Array.isArray(data?.courses) ? data.courses : []);
        setPagination(
          data?.pagination || {
            page: parsedPage,
            limit: parsedLimit,
            totalCourses: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          }
        );
      } catch (err) {
        if (currentRequestId !== requestIdRef.current) return;
        setCourses([]);
        setError(err?.message || "Failed to load courses. Please try again.");
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    loadCourses();
  }, [
    qParam,
    categoryParam,
    priceTypeParam,
    minPriceParam,
    maxPriceParam,
    minRatingParam,
    sortParam,
    parsedPage,
    parsedLimit,
    retryToken,
  ]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (e.nativeEvent?.isComposing) return;
    updateQueryParams({ q: searchInput.trim() }, { resetPage: true });
  };

  const handleApplyPriceRange = (e) => {
    e.preventDefault();
    const minStr = minPriceInput.trim();
    const maxStr = maxPriceInput.trim();

    let minNum = null;
    let maxNum = null;

    if (minStr !== "") {
      minNum = Number(minStr);
      if (!Number.isFinite(minNum) || minNum < 0) {
        setPriceRangeError("Minimum price must be a non-negative number.");
        return;
      }
    }

    if (maxStr !== "") {
      maxNum = Number(maxStr);
      if (!Number.isFinite(maxNum) || maxNum < 0) {
        setPriceRangeError("Maximum price must be a non-negative number.");
        return;
      }
    }

    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setPriceRangeError("Minimum price cannot be greater than maximum price.");
      return;
    }

    setPriceRangeError("");
    updateQueryParams({ minPrice: minStr, maxPrice: maxStr }, { resetPage: true });
  };

  const handleClearAllFilters = () => {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    setPriceRangeError("");
    setSearchParams({});
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || (pagination.totalPages > 0 && nextPage > pagination.totalPages)) {
      return;
    }
    updateQueryParams({ page: nextPage }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryParam) count += 1;
    if (priceTypeParam && priceTypeParam !== "all") count += 1;
    if (minPriceParam !== "" || maxPriceParam !== "") count += 1;
    if (minRatingParam !== "") count += 1;
    return count;
  }, [categoryParam, priceTypeParam, minPriceParam, maxPriceParam, minRatingParam]);

  const hasAnyActiveFilterOrSearch =
    Boolean(qParam.trim()) || activeFilterCount > 0 || sortParam !== "newest";

  const selectedCategoryName = useMemo(() => {
    if (!categoryParam) return "";
    const match = categoryList.find((c) => c._id === categoryParam);
    return match?.name || "Selected Category";
  }, [categoryList, categoryParam]);

  const pageNumbers = useMemo(
    () => buildPaginationRange(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages]
  );

  const showingFrom =
    pagination.totalCourses > 0 && courses.length > 0
      ? (pagination.page - 1) * pagination.limit + 1
      : 0;
  const showingTo = showingFrom > 0 ? showingFrom + courses.length - 1 : 0;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-richblack-900 text-richblack-5">
      {/* Header / Hero Banner */}
      <div className="border-b border-richblack-700 bg-richblack-800 px-4 py-8">
        <div className="mx-auto flex w-full max-w-maxContent flex-col gap-4">
          <p className="text-sm text-richblack-300">
            <Link to="/" className="hover:text-yellow-50">
              Home
            </Link>{" "}
            / <span className="text-yellow-25">Courses</span>
          </p>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-richblack-5 sm:text-3xl">
                {qParam.trim() ? `Search results for "${qParam.trim()}"` : "Explore Courses"}
              </h1>
              <p className="mt-1 text-sm text-richblack-200">
                Search across published free and paid courses, filter by category, price, and
                rating.
              </p>
            </div>

            {/* Inline Page Search Input */}
            <div className="w-full md:max-w-md">
              <form
                onSubmit={handleSearchSubmit}
                role="search"
                aria-label="Filter courses by keyword"
                className="relative flex items-center"
              >
                <label htmlFor="courses-page-search" className="sr-only">
                  Search courses by title, topic, or tag
                </label>
                <input
                  id="courses-page-search"
                  name="q"
                  type="search"
                  value={searchInput}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="search"
                  placeholder="Search by title, description, or tag..."
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-richblack-600 bg-richblack-900 py-2.5 pl-4 pr-20 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-yellow-50"
                />
                {searchInput.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      updateQueryParams({ q: "" }, { resetPage: true });
                    }}
                    aria-label="Clear search query"
                    className="absolute right-10 flex h-8 w-8 items-center justify-center rounded text-richblack-300 hover:text-richblack-5"
                  >
                    <AiOutlineClose />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-md bg-yellow-50 text-richblack-900 hover:bg-yellow-100"
                >
                  <AiOutlineSearch className="text-lg" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Sidebar Filters + Results Grid */}
      <div className="mx-auto w-full max-w-maxContent px-4 py-8">
        {/* Mobile Filter Toggle */}
        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="course-filters-panel"
            className="flex items-center gap-2 rounded-lg border border-richblack-600 bg-richblack-800 px-4 py-2 text-sm font-medium text-richblack-50 hover:bg-richblack-700"
          >
            <FiFilter />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-bold text-richblack-900">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasAnyActiveFilterOrSearch && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs font-medium text-yellow-50 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Filter Sidebar */}
          <aside
            id="course-filters-panel"
            aria-label="Course filters"
            className={`${
              mobileFiltersOpen ? "block" : "hidden"
            } w-full rounded-xl border border-richblack-700 bg-richblack-800 p-5 lg:block lg:w-[280px] lg:flex-shrink-0`}
          >
            <div className="mb-5 flex items-center justify-between border-b border-richblack-700 pb-3">
              <h2 className="text-base font-semibold text-richblack-5">Filters</h2>
              {hasAnyActiveFilterOrSearch && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-medium text-yellow-50 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {/* Category Filter */}
              <div>
                <label
                  htmlFor="filter-category"
                  className="mb-2 block text-sm font-medium text-richblack-100"
                >
                  Category
                </label>
                <select
                  id="filter-category"
                  name="category"
                  value={categoryParam}
                  onChange={(e) => updateQueryParams({ category: e.target.value })}
                  className="w-full rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-2 text-sm text-richblack-5 focus:border-yellow-50 focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {categoryList.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Type (All / Free / Paid) */}
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-richblack-100">
                  Price Type
                </legend>
                <div className="flex flex-col gap-2">
                  {PRICE_TYPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-richblack-200 hover:text-richblack-5"
                    >
                      <input
                        type="radio"
                        name="priceType"
                        value={opt.value}
                        checked={priceTypeParam === opt.value}
                        onChange={() => updateQueryParams({ priceType: opt.value })}
                        className="h-4 w-4 accent-yellow-50"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Price Range Filter */}
              <form onSubmit={handleApplyPriceRange} noValidate>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-richblack-100">
                    Price Range (₹)
                  </legend>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor="filter-min-price" className="mb-1 block text-xs text-richblack-300">
                        Min (₹)
                      </label>
                      <input
                        id="filter-min-price"
                        name="minPrice"
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={minPriceInput}
                        onChange={(e) => {
                          setMinPriceInput(e.target.value);
                          setPriceRangeError("");
                        }}
                        className="w-full rounded-lg border border-richblack-600 bg-richblack-900 px-2.5 py-1.5 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none"
                      />
                    </div>
                    <span className="mt-5 text-richblack-400">–</span>
                    <div className="min-w-0 flex-1">
                      <label htmlFor="filter-max-price" className="mb-1 block text-xs text-richblack-300">
                        Max (₹)
                      </label>
                      <input
                        id="filter-max-price"
                        name="maxPrice"
                        type="text"
                        inputMode="numeric"
                        placeholder="5000"
                        value={maxPriceInput}
                        onChange={(e) => {
                          setMaxPriceInput(e.target.value);
                          setPriceRangeError("");
                        }}
                        className="w-full rounded-lg border border-richblack-600 bg-richblack-900 px-2.5 py-1.5 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none"
                      />
                    </div>
                  </div>
                  {priceRangeError && (
                    <p role="alert" className="mt-2 text-xs text-pink-200">
                      {priceRangeError}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-richblack-900 hover:bg-yellow-100"
                    >
                      Apply Price
                    </button>
                    {(minPriceParam !== "" || maxPriceParam !== "") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMinPriceInput("");
                          setMaxPriceInput("");
                          setPriceRangeError("");
                          updateQueryParams({ minPrice: "", maxPrice: "" });
                        }}
                        className="rounded-lg border border-richblack-600 px-2.5 py-1.5 text-xs text-richblack-200 hover:bg-richblack-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </fieldset>
              </form>

              {/* Minimum Rating Filter */}
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-richblack-100">
                  Minimum Rating
                </legend>
                <div className="flex flex-col gap-2">
                  {RATING_OPTIONS.map((opt) => (
                    <label
                      key={opt.value || "any"}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-richblack-200 hover:text-richblack-5"
                    >
                      <input
                        type="radio"
                        name="minRating"
                        value={opt.value}
                        checked={minRatingParam === opt.value}
                        onChange={() => updateQueryParams({ minRating: opt.value })}
                        className="h-4 w-4 accent-yellow-50"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </aside>

          {/* Results Column */}
          <main className="min-w-0 flex-1">
            {/* Toolbar: Result count + Sort */}
            <div className="mb-6 flex flex-col gap-3 border-b border-richblack-700 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div aria-live="polite" className="text-sm text-richblack-200">
                {loading ? (
                  <span>Loading courses...</span>
                ) : pagination.totalCourses > 0 && courses.length > 0 ? (
                  <span>
                    Showing{" "}
                    <strong className="text-richblack-5">
                      {showingFrom}–{showingTo}
                    </strong>{" "}
                    of <strong className="text-richblack-5">{pagination.totalCourses}</strong>{" "}
                    {pagination.totalCourses === 1 ? "course" : "courses"}
                  </span>
                ) : (
                  <span>
                    <strong className="text-richblack-5">{pagination.totalCourses}</strong>{" "}
                    {pagination.totalCourses === 1 ? "course" : "courses"} found
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="course-sort-select"
                  className="whitespace-nowrap text-sm text-richblack-300"
                >
                  Sort by:
                </label>
                <select
                  id="course-sort-select"
                  name="sort"
                  value={sortParam}
                  onChange={(e) => updateQueryParams({ sort: e.target.value })}
                  className="rounded-lg border border-richblack-600 bg-richblack-800 px-3 py-1.5 text-sm text-richblack-5 focus:border-yellow-50 focus:outline-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filter Chips */}
            {hasAnyActiveFilterOrSearch && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {qParam.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      updateQueryParams({ q: "" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-richblack-600 bg-richblack-800 px-3 py-1 text-xs text-richblack-100 hover:border-yellow-50"
                  >
                    <span>Query: {qParam.trim()}</span>
                    <AiOutlineClose />
                  </button>
                )}
                {categoryParam && (
                  <button
                    type="button"
                    onClick={() => updateQueryParams({ category: "" })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-richblack-600 bg-richblack-800 px-3 py-1 text-xs text-richblack-100 hover:border-yellow-50"
                  >
                    <span>Category: {selectedCategoryName}</span>
                    <AiOutlineClose />
                  </button>
                )}
                {priceTypeParam !== "all" && (
                  <button
                    type="button"
                    onClick={() => updateQueryParams({ priceType: "all" })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-richblack-600 bg-richblack-800 px-3 py-1 text-xs text-richblack-100 hover:border-yellow-50"
                  >
                    <span>Price: {priceTypeParam === "free" ? "Free" : "Paid"}</span>
                    <AiOutlineClose />
                  </button>
                )}
                {(minPriceParam !== "" || maxPriceParam !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinPriceInput("");
                      setMaxPriceInput("");
                      updateQueryParams({ minPrice: "", maxPrice: "" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-richblack-600 bg-richblack-800 px-3 py-1 text-xs text-richblack-100 hover:border-yellow-50"
                  >
                    <span>
                      Range: {minPriceParam !== "" ? `₹${minPriceParam}` : "₹0"} –{" "}
                      {maxPriceParam !== "" ? `₹${maxPriceParam}` : "Any"}
                    </span>
                    <AiOutlineClose />
                  </button>
                )}
                {minRatingParam !== "" && (
                  <button
                    type="button"
                    onClick={() => updateQueryParams({ minRating: "" })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-richblack-600 bg-richblack-800 px-3 py-1 text-xs text-richblack-100 hover:border-yellow-50"
                  >
                    <span>Rating: {minRatingParam}★ & up</span>
                    <AiOutlineClose />
                  </button>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div
                role="status"
                aria-label="Loading courses"
                className="grid min-h-[320px] place-items-center"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
                  <p className="text-sm text-richblack-300">Fetching matching courses...</p>
                </div>
              </div>
            ) : error ? (
              /* Error State */
              <div
                role="alert"
                className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
              >
                <p className="text-lg font-semibold text-pink-200">
                  Could not load courses
                </p>
                <p className="max-w-md text-sm text-richblack-300">{error}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRetryToken((t) => t + 1)}
                    className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
                  >
                    Retry
                  </button>
                  {hasAnyActiveFilterOrSearch && (
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="rounded-lg border border-richblack-600 px-5 py-2 text-sm text-richblack-100 hover:bg-richblack-700"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            ) : courses.length === 0 ? (
              /* Empty State (or Out-of-Range Page) */
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border border-richblack-700 bg-richblack-800 p-8 text-center">
                {pagination.totalCourses > 0 && pagination.page > pagination.totalPages ? (
                  <>
                    <p className="text-lg font-semibold text-richblack-5">
                      Page {pagination.page} is out of range
                    </p>
                    <p className="text-sm text-richblack-300">
                      There are {pagination.totalPages}{" "}
                      {pagination.totalPages === 1 ? "page" : "pages"} of results available.
                    </p>
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
                    >
                      Go to Page 1
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-richblack-5">
                      No matching courses found
                    </p>
                    <p className="max-w-md text-sm text-richblack-300">
                      Try adjusting your search keywords or clearing some active filters.
                    </p>
                    {hasAnyActiveFilterOrSearch && (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Course Results Grid + Pagination */
              <>
                <div
                  data-testid="search-results-grid"
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {courses.map((course) => (
                    <CourseCard key={course._id} course={course} Height="h-[220px]" />
                  ))}
                </div>

                {/* Pagination Bar */}
                {pagination.totalPages > 1 && (
                  <nav
                    aria-label="Course results pagination"
                    className="mt-10 flex flex-wrap items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      disabled={!pagination.hasPrevPage || loading}
                      onClick={() => handlePageChange(pagination.page - 1)}
                      className="rounded-lg border border-richblack-600 bg-richblack-800 px-3.5 py-2 text-sm text-richblack-100 transition-colors hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {pageNumbers.map((item) =>
                      typeof item === "string" ? (
                        <span key={item} className="px-2 text-richblack-400">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          aria-current={item === pagination.page ? "page" : undefined}
                          onClick={() => handlePageChange(item)}
                          className={`min-w-[38px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            item === pagination.page
                              ? "bg-yellow-50 text-richblack-900 font-semibold"
                              : "border border-richblack-600 bg-richblack-800 text-richblack-100 hover:bg-richblack-700"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={!pagination.hasNextPage || loading}
                      onClick={() => handlePageChange(pagination.page + 1)}
                      className="rounded-lg border border-richblack-600 bg-richblack-800 px-3.5 py-2 text-sm text-richblack-100 transition-colors hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Courses;
