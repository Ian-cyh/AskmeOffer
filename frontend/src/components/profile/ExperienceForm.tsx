"use client";

import { ProjectExperience, StudentWork, Recommendation } from "@/types/profile";
import { Card } from "@/components/ui/Card";
import { FormField, Input, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  projects: ProjectExperience[];
  studentWork: StudentWork[];
  recommendations: Recommendation[];
  onProjectsChange: (data: ProjectExperience[]) => void;
  onStudentWorkChange: (data: StudentWork[]) => void;
  onRecommendationsChange: (data: Recommendation[]) => void;
}

export function ExperienceForm({
  projects, studentWork, recommendations,
  onProjectsChange, onStudentWorkChange, onRecommendationsChange,
}: Props) {
  const addProject = () =>
    onProjectsChange([...projects, { title: "", role: "", duration: "", description: "", tech_stack: "", contribution: "" }]);
  const removeProject = (i: number) => onProjectsChange(projects.filter((_, idx) => idx !== i));
  const updateProject = (i: number, field: keyof ProjectExperience, val: string) => {
    const next = [...projects];
    next[i] = { ...next[i], [field]: val };
    onProjectsChange(next);
  };

  const addWork = () =>
    onStudentWorkChange([...studentWork, { title: "", organization: "", duration: "", description: "" }]);
  const removeWork = (i: number) => onStudentWorkChange(studentWork.filter((_, idx) => idx !== i));
  const updateWork = (i: number, field: keyof StudentWork, val: string) => {
    const next = [...studentWork];
    next[i] = { ...next[i], [field]: val };
    onStudentWorkChange(next);
  };

  const addRec = () =>
    onRecommendationsChange([
      ...recommendations,
      { recommender_name: "", recommender_title: "", recommender_institution: "", relationship: "", content_summary: "" },
    ]);
  const removeRec = (i: number) => onRecommendationsChange(recommendations.filter((_, idx) => idx !== i));
  const updateRec = (i: number, field: keyof Recommendation, val: string) => {
    const next = [...recommendations];
    next[i] = { ...next[i], [field]: val };
    onRecommendationsChange(next);
  };

  return (
    <div className="space-y-6">
      {/* 项目经历 */}
      <Card title="项目经历" description="科研项目、课程项目、开源贡献等">
        <div className="space-y-4">
          {projects.map((p, i) => (
            <div key={i} className="p-4 rounded-lg border border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted">项目 #{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeProject(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="项目名称">
                  <Input value={p.title} onChange={(e) => updateProject(i, "title", e.target.value)} placeholder="基于深度学习的图像分割系统" />
                </FormField>
                <FormField label="角色">
                  <Input value={p.role} onChange={(e) => updateProject(i, "role", e.target.value)} placeholder="核心开发者" />
                </FormField>
                <FormField label="时间段">
                  <Input value={p.duration} onChange={(e) => updateProject(i, "duration", e.target.value)} placeholder="2025.03 - 2025.08" />
                </FormField>
                <FormField label="技术栈">
                  <Input value={p.tech_stack} onChange={(e) => updateProject(i, "tech_stack", e.target.value)} placeholder="Python, PyTorch, OpenCV" />
                </FormField>
              </div>
              <FormField label="项目描述">
                <Textarea rows={2} value={p.description} onChange={(e) => updateProject(i, "description", e.target.value)} placeholder="项目背景、目标、方法..." />
              </FormField>
              <FormField label="个人贡献">
                <Textarea rows={2} value={p.contribution} onChange={(e) => updateProject(i, "contribution", e.target.value)} placeholder="你在项目中具体做了什么，取得了什么结果..." />
              </FormField>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addProject}>
            <Plus size={14} /> 添加项目
          </Button>
        </div>
      </Card>

      {/* 学生工作 */}
      <Card title="学生工作" description="社团、学生会、志愿者等经历">
        <div className="space-y-4">
          {studentWork.map((w, i) => (
            <div key={i} className="p-4 rounded-lg border border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted">工作 #{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeWork(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="职务">
                  <Input value={w.title} onChange={(e) => updateWork(i, "title", e.target.value)} placeholder="学生会副主席" />
                </FormField>
                <FormField label="组织">
                  <Input value={w.organization} onChange={(e) => updateWork(i, "organization", e.target.value)} placeholder="校学生会" />
                </FormField>
                <FormField label="时间段">
                  <Input value={w.duration} onChange={(e) => updateWork(i, "duration", e.target.value)} placeholder="2024.09 - 2025.06" />
                </FormField>
              </div>
              <FormField label="工作描述">
                <Textarea rows={2} value={w.description} onChange={(e) => updateWork(i, "description", e.target.value)} placeholder="主要职责和成就..." />
              </FormField>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addWork}>
            <Plus size={14} /> 添加学生工作
          </Button>
        </div>
      </Card>

      {/* 推荐信 */}
      <Card title="推荐信信息" description="记录推荐人信息，方便管理">
        <div className="space-y-4">
          {recommendations.map((r, i) => (
            <div key={i} className="p-4 rounded-lg border border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted">推荐人 #{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeRec(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="推荐人姓名">
                  <Input value={r.recommender_name} onChange={(e) => updateRec(i, "recommender_name", e.target.value)} placeholder="李教授" />
                </FormField>
                <FormField label="职称">
                  <Input value={r.recommender_title} onChange={(e) => updateRec(i, "recommender_title", e.target.value)} placeholder="副教授/教授" />
                </FormField>
                <FormField label="所在单位">
                  <Input value={r.recommender_institution} onChange={(e) => updateRec(i, "recommender_institution", e.target.value)} placeholder="XX大学计算机学院" />
                </FormField>
                <FormField label="与你的关系">
                  <Input value={r.relationship} onChange={(e) => updateRec(i, "relationship", e.target.value)} placeholder="本科毕设导师" />
                </FormField>
              </div>
              <FormField label="推荐信要点">
                <Textarea rows={2} value={r.content_summary} onChange={(e) => updateRec(i, "content_summary", e.target.value)} placeholder="推荐信主要会涉及哪些方面..." />
              </FormField>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addRec}>
            <Plus size={14} /> 添加推荐人
          </Button>
        </div>
      </Card>
    </div>
  );
}
