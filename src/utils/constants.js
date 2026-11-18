export const ACCOUNT_TYPE = {
  STUDENT: "Student",
  INSTRUCTOR: "Instructor",
  ADMIN: "Admin",
};

export const COURSE_STATUS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
};

export const APPROVAL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

/**
 * Resolves an instructor's approval status consistently with the backend.
 * Legacy instructor records missing approvalStatus default to APPROVED unless approved === false.
 */
export const getInstructorApprovalStatus = (user) => {
  if (!user || user.accountType !== ACCOUNT_TYPE.INSTRUCTOR) {
    return null;
  }
  if (
    user.approvalStatus === APPROVAL_STATUS.PENDING ||
    user.approvalStatus === APPROVAL_STATUS.APPROVED ||
    user.approvalStatus === APPROVAL_STATUS.REJECTED
  ) {
    return user.approvalStatus;
  }
  if (user.approved === false) {
    return APPROVAL_STATUS.PENDING;
  }
  return APPROVAL_STATUS.APPROVED;
};

export const isInstructorApproved = (user) =>
  getInstructorApprovalStatus(user) === APPROVAL_STATUS.APPROVED;
