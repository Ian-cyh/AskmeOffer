export interface BasicInfo {
  name: string;
  university: string;
  major: string;
  rank: string;
  gpa: string;
  avg_score: string;
  phone: string;
  email: string;
  self_intro: string;
}

export interface CourseScore {
  name: string;
  score: string;
}

export interface Achievement {
  type: "competition" | "paper" | "honor" | "";
  title: string;
  level: string;
  date: string;
  description: string;
}

export interface ProjectExperience {
  title: string;
  role: string;
  duration: string;
  description: string;
  tech_stack: string;
  contribution: string;
}

export interface StudentWork {
  title: string;
  organization: string;
  duration: string;
  description: string;
}

export interface Recommendation {
  recommender_name: string;
  recommender_title: string;
  recommender_institution: string;
  relationship: string;
  content_summary: string;
}

export interface TargetSchool {
  id: string;
  school_name: string;
  department: string;
  program: string;
  advisor_name: string;
  advisor_direction: string;
  advisor_papers: string;
  contact_status: string;
  notes: string;
}

export interface UserProfile {
  basic_info: BasicInfo;
  course_scores: CourseScore[];
  achievements: Achievement[];
  projects: ProjectExperience[];
  student_work: StudentWork[];
  recommendations: Recommendation[];
  target_schools: TargetSchool[];
}

export const emptyBasicInfo: BasicInfo = {
  name: "",
  university: "",
  major: "",
  rank: "",
  gpa: "",
  avg_score: "",
  phone: "",
  email: "",
  self_intro: "",
};

export const emptyProfile: UserProfile = {
  basic_info: { ...emptyBasicInfo },
  course_scores: [],
  achievements: [],
  projects: [],
  student_work: [],
  recommendations: [],
  target_schools: [],
};
