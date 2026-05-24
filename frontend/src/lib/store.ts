"use client";

import { UserProfile, emptyProfile } from "@/types/profile";
import { demoProfile } from "@/lib/demoData";

const STORAGE_KEY = "askme_offer_profile";
const INTERVIEW_RECORDS_KEY = "askme_offer_interview_records";

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") return emptyProfile;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demoProfile));
      return demoProfile;
    }
    return JSON.parse(raw) as UserProfile;
  } catch {
    return emptyProfile;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

// --- Interview Records ---

export interface InterviewRecord {
  id: string;
  date: string;
  difficulty: string;
  mode: "text" | "voice";
  questionsCount: number;
  messages: { role: "user" | "assistant"; content: string }[];
  feedback: {
    summary: string;
    questions: { question: string; answer: string; evaluation: string }[];
    strengths: string[];
    improvements: string[];
    overallScore: string;
  } | null;
}

export function loadInterviewRecords(): InterviewRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INTERVIEW_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveInterviewRecord(record: InterviewRecord): void {
  if (typeof window === "undefined") return;
  const records = loadInterviewRecords();
  records.unshift(record);
  // Keep last 20 records
  if (records.length > 20) records.length = 20;
  localStorage.setItem(INTERVIEW_RECORDS_KEY, JSON.stringify(records));
}

export function deleteInterviewRecord(id: string): void {
  if (typeof window === "undefined") return;
  const records = loadInterviewRecords().filter((r) => r.id !== id);
  localStorage.setItem(INTERVIEW_RECORDS_KEY, JSON.stringify(records));
}
