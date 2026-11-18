/**
 * Flatten all playable lectures across course sections, skipping empty sections.
 * @param {Array} courseSectionData
 * @returns {Array<{ sectionId: string, subSectionId: string, subSection: Object }>}
 */
export const flattenCourseLectures = (courseSectionData) => {
  if (!Array.isArray(courseSectionData)) return [];

  const lectures = [];
  for (const section of courseSectionData) {
    if (!section?._id || !Array.isArray(section.subSection)) continue;
    for (const sub of section.subSection) {
      if (!sub?._id) continue;
      lectures.push({
        sectionId: section._id,
        subSectionId: sub._id,
        subSection: sub,
      });
    }
  }
  return lectures;
};

/**
 * Compute navigation state (isFirst, isLast, prev, next) for the current lecture,
 * safely skipping empty sections and invalid indices.
 */
export const getLectureNavigation = (courseSectionData, sectionId, subSectionId) => {
  const lectures = flattenCourseLectures(courseSectionData);
  const currentIndex = lectures.findIndex(
    (item) => item.sectionId === sectionId && item.subSectionId === subSectionId
  );

  if (currentIndex === -1) {
    return {
      currentIndex: -1,
      isFirst: true,
      isLast: true,
      prev: null,
      next: null,
    };
  }

  return {
    currentIndex,
    isFirst: currentIndex === 0,
    isLast: currentIndex === lectures.length - 1,
    prev: currentIndex > 0 ? lectures[currentIndex - 1] : null,
    next: currentIndex < lectures.length - 1 ? lectures[currentIndex + 1] : null,
  };
};
