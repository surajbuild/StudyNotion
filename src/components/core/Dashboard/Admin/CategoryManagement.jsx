import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { AiOutlineSearch, AiOutlineClose, AiOutlinePlus } from "react-icons/ai";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import ConfirmationModal from "../../../common/ConfirmationModal";
import { formattedDate } from "../../../../utils/dateFormatter";
import {
  fetchAdminDashboard,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../../../services/operations/adminAPI";

const ITEMS_PER_PAGE = 8;

const slugifyCategory = (name) =>
  name
    ?.toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "") || "";

const CategoryManagement = () => {
  const { token } = useSelector((state) => state.auth);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Create / Edit Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation / Blocked Deletion Modal State
  const [confirmationModal, setConfirmationModal] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminDashboard(token);
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
    } catch (err) {
      setError(err?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadCategories();
    }
  }, [token, loadCategories]);

  // Filter categories by search input
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => {
      const name = (cat.name || "").toLowerCase();
      const desc = (cat.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [categories, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const paginatedCategories = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredCategories.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCategories, safePage]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setNameInput("");
    setDescriptionInput("");
    setFormError("");
    setFormModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setNameInput(category.name || "");
    setDescriptionInput(category.description || "");
    setFormError("");
    setFormModalOpen(true);
  };

  const closeFormModal = () => {
    if (submitting) return;
    setFormModalOpen(false);
    setEditingCategory(null);
    setFormError("");
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    const trimmedDesc = descriptionInput.trim();

    if (!trimmedName) {
      setFormError("Category name is required.");
      return;
    }
    if (trimmedName.length < 2) {
      setFormError("Category name must be at least 2 characters long.");
      return;
    }
    if (trimmedName.length > 100) {
      setFormError("Category name must be 100 characters or fewer.");
      return;
    }
    if (!slugifyCategory(trimmedName)) {
      setFormError("Category name must contain at least one letter or number.");
      return;
    }
    if (trimmedDesc.length > 500) {
      setFormError("Category description must be 500 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const result = editingCategory
      ? await updateCategory(
          {
            categoryId: editingCategory._id,
            name: trimmedName,
            description: trimmedDesc,
          },
          token
        )
      : await createCategory(
          { name: trimmedName, description: trimmedDesc },
          token
        );

    setSubmitting(false);

    if (!result.success) {
      setFormError(result.message || "Operation failed. Please check your input.");
      return;
    }

    setFormModalOpen(false);
    setEditingCategory(null);
    setNameInput("");
    setDescriptionInput("");
    await loadCategories();
  };

  const handleRequestDelete = (category) => {
    const courseCount = category.totalCourseCount || 0;

    // Safe deletion policy: clearly block deleting categories that have associated courses
    if (courseCount > 0) {
      setConfirmationModal({
        text1: "Cannot Delete Category",
        text2: `"${category.name}" currently has ${courseCount} associated ${
          courseCount === 1 ? "course" : "courses"
        }. Remove or reassign those courses before deleting this category so no courses are orphaned.`,
        btn1Text: "Understood",
        btn2Text: "Close",
        btn1Handler: () => setConfirmationModal(null),
        btn2Handler: () => setConfirmationModal(null),
      });
      return;
    }

    setConfirmationModal({
      text1: "Delete Category?",
      text2: `Are you sure you want to permanently delete "${category.name}"? This action cannot be undone.`,
      btn1Text: "Delete",
      btn2Text: "Cancel",
      btn1Handler: async () => {
        setConfirmationModal(null);
        setDeletingId(category._id);
        const res = await deleteCategory(category._id, token);
        setDeletingId(null);
        if (res.success) {
          await loadCategories();
        }
      },
      btn2Handler: () => setConfirmationModal(null),
    });
  };

  return (
    <div className="flex flex-col gap-6 text-richblack-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-richblack-5 sm:text-3xl">
            Category Management
          </h1>
          <p className="mt-1 text-sm text-richblack-300">
            Create, edit, and safely manage course categories across the catalog and search.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-richblack-900 transition-colors hover:bg-yellow-100"
        >
          <AiOutlinePlus className="text-base" />
          <span>Create Category</span>
        </button>
      </div>

      {/* Search & Count Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="admin-category-search" className="sr-only">
            Search categories
          </label>
          <AiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-richblack-400" />
          <input
            id="admin-category-search"
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search categories..."
            className="w-full rounded-lg border border-richblack-600 bg-richblack-800 py-2 pl-9 pr-9 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              aria-label="Clear category search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-richblack-300 hover:text-richblack-5"
            >
              <AiOutlineClose />
            </button>
          )}
        </div>

        <p aria-live="polite" className="text-sm text-richblack-300">
          {loading
            ? "Loading categories..."
            : `Showing ${filteredCategories.length} of ${categories.length} ${
                categories.length === 1 ? "category" : "categories"
              }`}
        </p>
      </div>

      {/* Loading / Error / Empty / Table States */}
      {loading ? (
        <div
          role="status"
          aria-label="Loading categories"
          className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-richblack-700 bg-richblack-800"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-richblack-500 border-t-yellow-50" />
          <p className="text-sm text-richblack-300">Fetching categories...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-pink-700/40 bg-richblack-800 p-8 text-center"
        >
          <p className="text-lg font-semibold text-pink-200">Could not load categories</p>
          <p className="max-w-md text-sm text-richblack-300">{error}</p>
          <button
            type="button"
            onClick={loadCategories}
            className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
          >
            Retry
          </button>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-xl border border-richblack-700 bg-richblack-800 p-8 text-center">
          {searchQuery.trim() ? (
            <>
              <p className="text-base font-semibold text-richblack-5">
                No categories match &quot;{searchQuery.trim()}&quot;
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                className="rounded-lg border border-richblack-600 px-4 py-2 text-sm text-richblack-100 hover:bg-richblack-700"
              >
                Clear Search
              </button>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-richblack-5">
                No categories created yet
              </p>
              <p className="text-sm text-richblack-300">
                Create your first course category so instructors can organize courses.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100"
              >
                Create Category
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-richblack-700 bg-richblack-800 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-richblack-700 bg-richblack-900/60 text-xs uppercase text-richblack-300">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Description</th>
                  <th className="px-5 py-3.5 font-semibold">Courses</th>
                  <th className="px-5 py-3.5 font-semibold">Created</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-richblack-700">
                {paginatedCategories.map((cat) => {
                  const courseCount = cat.totalCourseCount || 0;
                  const slug = cat.slug || slugifyCategory(cat.name);
                  return (
                    <tr key={cat._id} className="hover:bg-richblack-700/30">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-richblack-5">{cat.name}</p>
                        <Link
                          to={`/catalog/${slug}`}
                          className="mt-0.5 inline-block text-xs text-yellow-50 hover:underline"
                        >
                          /catalog/{slug}
                        </Link>
                      </td>
                      <td className="max-w-xs px-5 py-4 align-top text-richblack-200">
                        <p className="line-clamp-2">
                          {cat.description || (
                            <span className="italic text-richblack-400">No description</span>
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            courseCount > 0
                              ? "bg-caribbeangreen-900/60 text-caribbeangreen-100"
                              : "bg-richblack-700 text-richblack-300"
                          }`}
                        >
                          {courseCount} {courseCount === 1 ? "course" : "courses"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-richblack-300">
                        {cat.createdAt ? formattedDate(cat.createdAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right align-top">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            aria-label={`Edit ${cat.name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-richblack-100 hover:border-yellow-50 hover:text-yellow-50"
                          >
                            <FiEdit2 />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === cat._id}
                            onClick={() => handleRequestDelete(cat)}
                            aria-label={`Delete ${cat.name}`}
                            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                              courseCount > 0
                                ? "border-richblack-600 bg-richblack-900 text-richblack-400 hover:border-pink-400/50 hover:text-pink-200"
                                : "border-pink-600/50 bg-pink-900/20 text-pink-200 hover:bg-pink-900/40"
                            } disabled:opacity-50`}
                          >
                            <FiTrash2 />
                            <span>{deletingId === cat._id ? "Deleting..." : "Delete"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {paginatedCategories.map((cat) => {
              const courseCount = cat.totalCourseCount || 0;
              const slug = cat.slug || slugifyCategory(cat.name);
              return (
                <div
                  key={cat._id}
                  className="rounded-xl border border-richblack-700 bg-richblack-800 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-richblack-5">{cat.name}</p>
                      <Link
                        to={`/catalog/${slug}`}
                        className="text-xs text-yellow-50 hover:underline"
                      >
                        /catalog/{slug}
                      </Link>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-richblack-700 px-2.5 py-0.5 text-xs text-richblack-100">
                      {courseCount} {courseCount === 1 ? "course" : "courses"}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-richblack-300">
                    {cat.description || "No description"}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-richblack-700 pt-3">
                    <span className="text-xs text-richblack-400">
                      {cat.createdAt ? formattedDate(cat.createdAt) : "—"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        aria-label={`Edit ${cat.name}`}
                        className="inline-flex items-center gap-1 rounded-md border border-richblack-600 bg-richblack-900 px-3 py-1.5 text-xs font-medium text-richblack-100"
                      >
                        <FiEdit2 />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === cat._id}
                        onClick={() => handleRequestDelete(cat)}
                        aria-label={`Delete ${cat.name}`}
                        className="inline-flex items-center gap-1 rounded-md border border-pink-600/50 bg-pink-900/20 px-3 py-1.5 text-xs font-medium text-pink-200 disabled:opacity-50"
                      >
                        <FiTrash2 />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Category table pagination"
              className="flex items-center justify-center gap-3 pt-2"
            >
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-richblack-600 bg-richblack-800 px-3.5 py-1.5 text-sm text-richblack-100 hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-richblack-300">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-richblack-600 bg-richblack-800 px-3.5 py-1.5 text-sm text-richblack-100 hover:bg-richblack-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {/* Create / Edit Category Modal */}
      {formModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          className="fixed inset-0 z-[1000] grid place-items-center bg-richblack-900/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-richblack-600 bg-richblack-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="category-modal-title"
                className="text-xl font-semibold text-richblack-5"
              >
                {editingCategory ? "Edit Category" : "Create Category"}
              </h2>
              <button
                type="button"
                onClick={closeFormModal}
                aria-label="Close modal"
                className="rounded p-1 text-richblack-300 hover:bg-richblack-700 hover:text-richblack-5"
              >
                <AiOutlineClose className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="category-name"
                  className="mb-1.5 block text-sm font-medium text-richblack-100"
                >
                  Category Name <span className="text-pink-200">*</span>
                </label>
                <input
                  id="category-name"
                  name="name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setFormError("");
                  }}
                  placeholder="e.g. Cloud Computing"
                  maxLength={100}
                  required
                  className="w-full rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-2 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="category-description"
                  className="mb-1.5 block text-sm font-medium text-richblack-100"
                >
                  Description
                </label>
                <textarea
                  id="category-description"
                  name="description"
                  rows={3}
                  value={descriptionInput}
                  onChange={(e) => {
                    setDescriptionInput(e.target.value);
                    setFormError("");
                  }}
                  placeholder="Short description of courses in this category..."
                  maxLength={500}
                  className="w-full rounded-lg border border-richblack-600 bg-richblack-900 px-3 py-2 text-sm text-richblack-5 placeholder:text-richblack-400 focus:border-yellow-50 focus:outline-none"
                />
              </div>

              {formError && (
                <p role="alert" className="rounded-lg bg-pink-900/30 px-3 py-2 text-xs text-pink-200">
                  {formError}
                </p>
              )}

              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={closeFormModal}
                  className="rounded-lg border border-richblack-600 bg-richblack-700 px-4 py-2 text-sm font-medium text-richblack-100 hover:bg-richblack-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-yellow-50 px-5 py-2 text-sm font-semibold text-richblack-900 hover:bg-yellow-100 disabled:opacity-50"
                >
                  {submitting
                    ? editingCategory
                      ? "Saving..."
                      : "Creating..."
                    : editingCategory
                    ? "Save Changes"
                    : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmationModal && <ConfirmationModal modalData={confirmationModal} />}
    </div>
  );
};

export default CategoryManagement;
