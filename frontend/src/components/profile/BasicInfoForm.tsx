"use client";

import { BasicInfo } from "@/types/profile";
import { Card } from "@/components/ui/Card";
import { FormField, Input, Textarea } from "@/components/ui/FormField";

interface Props {
  data: BasicInfo;
  onChange: (data: BasicInfo) => void;
}

export function BasicInfoForm({ data, onChange }: Props) {
  const update = (field: keyof BasicInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <Card title="基本信息" description="填写你的个人基本信息">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="姓名">
            <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="张三" />
          </FormField>
          <FormField label="本科院校">
            <Input value={data.university} onChange={(e) => update("university", e.target.value)} placeholder="XX大学" />
          </FormField>
          <FormField label="专业">
            <Input value={data.major} onChange={(e) => update("major", e.target.value)} placeholder="计算机科学与技术" />
          </FormField>
          <FormField label="年级排名">
            <Input value={data.rank} onChange={(e) => update("rank", e.target.value)} placeholder="3/120 (前2.5%)" />
          </FormField>
          <FormField label="GPA">
            <Input value={data.gpa} onChange={(e) => update("gpa", e.target.value)} placeholder="3.85/4.0" />
          </FormField>
          <FormField label="加权均分">
            <Input value={data.avg_score} onChange={(e) => update("avg_score", e.target.value)} placeholder="91.5" />
          </FormField>
          <FormField label="手机号">
            <Input value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="138xxxx0000" />
          </FormField>
          <FormField label="邮箱">
            <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="example@mail.com" />
          </FormField>
        </div>
      </Card>

      <Card title="个人简介" description="简要介绍你自己，100-200字">
        <FormField label="自我介绍">
          <Textarea
            rows={4}
            value={data.self_intro}
            onChange={(e) => update("self_intro", e.target.value)}
            placeholder="简要介绍你的学术背景、研究兴趣和未来规划..."
          />
        </FormField>
      </Card>
    </div>
  );
}
