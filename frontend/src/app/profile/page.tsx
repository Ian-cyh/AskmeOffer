"use client";

import { useState, useEffect, useCallback } from "react";
import { UserProfile, emptyProfile } from "@/types/profile";
import { loadProfile, saveProfile } from "@/lib/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { BasicInfoForm } from "@/components/profile/BasicInfoForm";
import { AcademicForm } from "@/components/profile/AcademicForm";
import { ExperienceForm } from "@/components/profile/ExperienceForm";
import { SchoolsManager } from "@/components/profile/SchoolsManager";
import { ResumeGenerator } from "@/components/profile/ResumeGenerator";
import { Save, RotateCcw, User, GraduationCap, Briefcase, School, FileText } from "lucide-react";

const PROFILE_TABS = [
  { key: "basic", label: "基本信息", icon: <User size={16} /> },
  { key: "academic", label: "成绩与成果", icon: <GraduationCap size={16} /> },
  { key: "experience", label: "经历", icon: <Briefcase size={16} /> },
  { key: "schools", label: "目标院校", icon: <School size={16} /> },
  { key: "generate", label: "材料生成", icon: <FileText size={16} /> },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [activeTab, setActiveTab] = useState("basic");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const handleSave = useCallback(() => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [profile]);

  const handleReset = () => {
    if (confirm("确定要清空所有信息吗？此操作不可撤销。")) {
      setProfile(emptyProfile);
      saveProfile(emptyProfile);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title="个人信息"
        description="完善你的个人信息，用于生成简历、个人陈述和模拟面试"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw size={14} /> 清空
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save size={14} /> {saved ? "已保存" : "保存"}
            </Button>
          </>
        }
      />

      <Tabs tabs={PROFILE_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "basic" && (
        <BasicInfoForm
          data={profile.basic_info}
          onChange={(basic_info) => setProfile({ ...profile, basic_info })}
        />
      )}

      {activeTab === "academic" && (
        <AcademicForm
          courses={profile.course_scores}
          achievements={profile.achievements}
          onCoursesChange={(course_scores) => setProfile({ ...profile, course_scores })}
          onAchievementsChange={(achievements) => setProfile({ ...profile, achievements })}
        />
      )}

      {activeTab === "experience" && (
        <ExperienceForm
          projects={profile.projects}
          studentWork={profile.student_work}
          recommendations={profile.recommendations}
          onProjectsChange={(projects) => setProfile({ ...profile, projects })}
          onStudentWorkChange={(student_work) => setProfile({ ...profile, student_work })}
          onRecommendationsChange={(recommendations) => setProfile({ ...profile, recommendations })}
        />
      )}

      {activeTab === "schools" && (
        <SchoolsManager
          schools={profile.target_schools}
          onChange={(target_schools) => setProfile({ ...profile, target_schools })}
        />
      )}

      {activeTab === "generate" && (
        <ResumeGenerator profile={profile} />
      )}
    </div>
  );
}
