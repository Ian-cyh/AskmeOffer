from __future__ import annotations

from pydantic import BaseModel


class BasicInfo(BaseModel):
    name: str = ""
    university: str = ""
    major: str = ""
    rank: str = ""
    gpa: str = ""
    avg_score: str = ""
    phone: str = ""
    email: str = ""
    self_intro: str = ""


class CourseScore(BaseModel):
    name: str = ""
    score: str = ""


class Achievement(BaseModel):
    type: str = ""  # competition / paper / honor
    title: str = ""
    level: str = ""
    date: str = ""
    description: str = ""


class ProjectExperience(BaseModel):
    title: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""
    tech_stack: str = ""
    contribution: str = ""


class StudentWork(BaseModel):
    title: str = ""
    organization: str = ""
    duration: str = ""
    description: str = ""


class Recommendation(BaseModel):
    recommender_name: str = ""
    recommender_title: str = ""
    recommender_institution: str = ""
    relationship: str = ""
    content_summary: str = ""


class TargetSchool(BaseModel):
    id: str = ""
    school_name: str = ""
    department: str = ""
    program: str = ""
    advisor_name: str = ""
    advisor_direction: str = ""
    advisor_papers: str = ""
    contact_status: str = ""  # 未联系 / 已邮件 / 已回复 / 已面试
    notes: str = ""


class UserProfile(BaseModel):
    basic_info: BasicInfo = BasicInfo()
    course_scores: list[CourseScore] = []
    achievements: list[Achievement] = []
    projects: list[ProjectExperience] = []
    student_work: list[StudentWork] = []
    recommendations: list[Recommendation] = []
    target_schools: list[TargetSchool] = []
