/**
 * Whether a course needs Premium. Today every course is free to enroll in: `enroll_in_course` (migration 12) takes no
 * payment and the `courses` table has no price or tier column. When paid courses are added, this is the one place that
 * reads the new column, and every course card and page follows it.
 */
export function courseIsPremium(_course: unknown): boolean {
  void _course;
  return false;
}
