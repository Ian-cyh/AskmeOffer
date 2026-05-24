"use client";

import { TargetSchool } from "@/types/profile";
import { Card } from "@/components/ui/Card";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, School } from "lucide-react";

interface Props {
  schools: TargetSchool[];
  onChange: (data: TargetSchool[]) => void;
}

const CONTACT_STATUSES = ["未联系", "已邮件", "已回复", "已面试", "已录取", "已放弃"];

export function SchoolsManager({ schools, onChange }: Props) {
  const addSchool = () =>
    onChange([
      ...schools,
      {
        id: Date.now().toString(),
        school_name: "",
        department: "",
        program: "",
        advisor_name: "",
        advisor_direction: "",
        advisor_papers: "",
        contact_status: "未联系",
        notes: "",
      },
    ]);

  const removeSchool = (i: number) => onChange(schools.filter((_, idx) => idx !== i));

  const updateSchool = (i: number, field: keyof TargetSchool, val: string) => {
    const next = [...schools];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">目标院校管理</h3>
          <p className="text-sm text-muted mt-0.5">管理你的目标院校、导师信息和联系进度</p>
        </div>
        <Button variant="primary" size="sm" onClick={addSchool}>
          <Plus size={14} /> 添加院校
        </Button>
      </div>

      {schools.length === 0 && (
        <Card className="text-center py-12">
          <School size={48} className="mx-auto text-muted mb-4" />
          <p className="text-muted">还没有添加目标院校</p>
          <p className="text-sm text-muted mt-1">点击上方「添加院校」开始</p>
        </Card>
      )}

      {schools.map((s, i) => (
        <Card key={s.id}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <School size={16} className="text-primary" />
              <span className="font-medium">{s.school_name || `院校 #${i + 1}`}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                s.contact_status === "已录取" ? "bg-green-100 text-green-700" :
                s.contact_status === "已放弃" ? "bg-gray-100 text-gray-500" :
                s.contact_status === "已面试" ? "bg-blue-100 text-blue-700" :
                s.contact_status === "已回复" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {s.contact_status}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeSchool(i)}>
              <Trash2 size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="院校名称">
              <Input value={s.school_name} onChange={(e) => updateSchool(i, "school_name", e.target.value)} placeholder="北京大学" />
            </FormField>
            <FormField label="院系">
              <Input value={s.department} onChange={(e) => updateSchool(i, "department", e.target.value)} placeholder="信息科学技术学院" />
            </FormField>
            <FormField label="专业/方向">
              <Input value={s.program} onChange={(e) => updateSchool(i, "program", e.target.value)} placeholder="计算机科学与技术" />
            </FormField>
            <FormField label="联系状态">
              <Select value={s.contact_status} onChange={(e) => updateSchool(i, "contact_status", e.target.value)}>
                {CONTACT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-accent/50 space-y-3">
            <p className="text-sm font-medium text-foreground">导师信息</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="导师姓名">
                <Input value={s.advisor_name} onChange={(e) => updateSchool(i, "advisor_name", e.target.value)} placeholder="王教授" />
              </FormField>
              <FormField label="研究方向">
                <Input value={s.advisor_direction} onChange={(e) => updateSchool(i, "advisor_direction", e.target.value)} placeholder="自然语言处理、大语言模型" />
              </FormField>
            </div>
            <FormField label="代表论文">
              <Textarea rows={2} value={s.advisor_papers} onChange={(e) => updateSchool(i, "advisor_papers", e.target.value)} placeholder="列出导师的代表性论文，便于面试准备..." />
            </FormField>
          </div>

          <div className="mt-3">
            <FormField label="备注">
              <Textarea rows={2} value={s.notes} onChange={(e) => updateSchool(i, "notes", e.target.value)} placeholder="夏令营时间、申请要求、其他备注..." />
            </FormField>
          </div>
        </Card>
      ))}
    </div>
  );
}
