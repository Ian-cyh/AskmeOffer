"use client";

import { CourseScore, Achievement } from "@/types/profile";
import { Card } from "@/components/ui/Card";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  courses: CourseScore[];
  achievements: Achievement[];
  onCoursesChange: (data: CourseScore[]) => void;
  onAchievementsChange: (data: Achievement[]) => void;
}

export function AcademicForm({ courses, achievements, onCoursesChange, onAchievementsChange }: Props) {
  const addCourse = () => onCoursesChange([...courses, { name: "", score: "" }]);
  const removeCourse = (i: number) => onCoursesChange(courses.filter((_, idx) => idx !== i));
  const updateCourse = (i: number, field: keyof CourseScore, val: string) => {
    const next = [...courses];
    next[i] = { ...next[i], [field]: val };
    onCoursesChange(next);
  };

  const addAchievement = () =>
    onAchievementsChange([...achievements, { type: "", title: "", level: "", date: "", description: "" }]);
  const removeAchievement = (i: number) => onAchievementsChange(achievements.filter((_, idx) => idx !== i));
  const updateAchievement = (i: number, field: keyof Achievement, val: string) => {
    const next = [...achievements];
    next[i] = { ...next[i], [field]: val };
    onAchievementsChange(next);
  };

  return (
    <div className="space-y-6">
      <Card
        title="核心课程成绩"
        description="填写与目标方向相关的核心课程及分数"
      >
        <div className="space-y-3">
          {courses.map((c, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1">
                <Input value={c.name} onChange={(e) => updateCourse(i, "name", e.target.value)} placeholder="数据结构与算法" />
              </div>
              <div className="w-28">
                <Input value={c.score} onChange={(e) => updateCourse(i, "score", e.target.value)} placeholder="95" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeCourse(i)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addCourse}>
            <Plus size={14} /> 添加课程
          </Button>
        </div>
      </Card>

      <Card
        title="个人成果"
        description="竞赛获奖、论文发表、个人荣誉等"
      >
        <div className="space-y-4">
          {achievements.map((a, i) => (
            <div key={i} className="p-4 rounded-lg border border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted">成果 #{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeAchievement(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="类型">
                  <Select value={a.type} onChange={(e) => updateAchievement(i, "type", e.target.value)}>
                    <option value="">选择类型</option>
                    <option value="competition">竞赛获奖</option>
                    <option value="paper">论文发表</option>
                    <option value="honor">个人荣誉</option>
                  </Select>
                </FormField>
                <FormField label="名称">
                  <Input value={a.title} onChange={(e) => updateAchievement(i, "title", e.target.value)} placeholder="全国数学建模竞赛" />
                </FormField>
                <FormField label="等级/级别">
                  <Input value={a.level} onChange={(e) => updateAchievement(i, "level", e.target.value)} placeholder="国家一等奖" />
                </FormField>
                <FormField label="时间">
                  <Input value={a.date} onChange={(e) => updateAchievement(i, "date", e.target.value)} placeholder="2025-10" />
                </FormField>
              </div>
              <FormField label="描述">
                <Textarea
                  rows={2}
                  value={a.description}
                  onChange={(e) => updateAchievement(i, "description", e.target.value)}
                  placeholder="简要描述成果内容和个人贡献..."
                />
              </FormField>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addAchievement}>
            <Plus size={14} /> 添加成果
          </Button>
        </div>
      </Card>
    </div>
  );
}
