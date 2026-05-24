"use client";

import { UserProfile, emptyProfile } from "@/types/profile";

const STORAGE_KEY = "askme_offer_profile";

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") return emptyProfile;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return emptyProfile;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
