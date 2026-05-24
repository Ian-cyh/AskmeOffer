/**
 * Test data utilities for loading demo data into the application.
 * Used by "加载测试数据" buttons across modules.
 */

import { FULL_COURSE_TEST_RECORDS } from "./fullCourseTest";
import { FULL_INTERVIEW_TEST_RECORDS } from "./fullInterviewTest";
import { saveCourseRecord, saveInterviewRecord } from "./store";

export function loadAllTestData(): { courses: number; interviews: number } {
  let courses = 0;
  let interviews = 0;

  for (const r of FULL_COURSE_TEST_RECORDS) {
    saveCourseRecord(r);
    courses++;
  }

  for (const r of FULL_INTERVIEW_TEST_RECORDS) {
    saveInterviewRecord(r);
    interviews++;
  }

  return { courses, interviews };
}
