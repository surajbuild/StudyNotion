/**
 * Shared course progress calculation utilities (F-INS-11).
 *
 * Used by BOTH student-facing `Profile.getEnrolledCourses` and instructor-facing
 * `Course.getCourseEnrolledStudents` so displayed completion percentages always match.
 */

/**
 * Extracts a deduplicated Set of valid SubSection ObjectId strings belonging to a
 * populated Course document, safely ignoring null or deleted section/subsection refs.
 */
const extractCourseLectureIds = (course) => {
    const validIds = new Set();
    if (!course || !Array.isArray(course.courseContent)) {
        return validIds;
    }

    for (const section of course.courseContent) {
        if (!section || !Array.isArray(section.subSection)) continue;
        for (const sub of section.subSection) {
            if (!sub) continue;
            const id = typeof sub === "object" && sub._id ? sub._id.toString() : String(sub);
            if (id) validIds.add(id);
        }
    }

    return validIds;
};

/**
 * Calculates course completion metrics from authoritative course lecture IDs and
 * one or more CourseProgress documents for a single (student, course) pair.
 *
 * Guarantees:
 * - Deduplicates repeated completedVideos entries and multiple CourseProgress records.
 * - Counts only lectures that currently exist in the course (deleted content ignored).
 * - Handles 0-lecture courses safely (0% completion, 0 remaining).
 * - Completion percentage is strictly clamped to [0, 100] and rounded to 2 decimal places.
 */
const calculateCourseProgress = (validLectureIds, progressDocs) => {
    const lectureIdSet =
        validLectureIds instanceof Set
            ? validLectureIds
            : new Set(Array.isArray(validLectureIds) ? validLectureIds.map(String) : []);

    const totalLectures = lectureIdSet.size;
    if (totalLectures === 0) {
        return {
            totalLectures: 0,
            completedLectures: 0,
            remainingLectures: 0,
            completionPercentage: 0,
        };
    }

    const docs = Array.isArray(progressDocs)
        ? progressDocs
        : progressDocs
          ? [progressDocs]
          : [];

    const completedSet = new Set();
    for (const doc of docs) {
        if (!doc || !Array.isArray(doc.completedVideos)) continue;
        for (const vid of doc.completedVideos) {
            if (!vid) continue;
            const idStr = typeof vid === "object" && vid._id ? vid._id.toString() : String(vid);
            if (lectureIdSet.has(idStr)) {
                completedSet.add(idStr);
            }
        }
    }

    const completedLectures = Math.min(totalLectures, completedSet.size);
    const remainingLectures = Math.max(0, totalLectures - completedLectures);
    const completionPercentage = Math.min(
        100,
        Math.round((completedLectures / totalLectures) * 10000) / 100
    );

    return {
        totalLectures,
        completedLectures,
        remainingLectures,
        completionPercentage,
    };
};

module.exports = {
    extractCourseLectureIds,
    calculateCourseProgress,
};
