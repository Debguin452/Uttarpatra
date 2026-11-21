import { EXAM_PROFILES, type ExamProfileKey } from "@coaching-app/shared/examProfiles";
import { locale } from "@coaching-app/shared/i18n";
import { api } from "./api";
import type { AdminTestQuestion } from "./adminTypes";

export type ChatMessage = { id: number; role: "user" | "assistant"; content: string; created_at: number };
export type AiStatus = { enabled: boolean; limit: number; remaining: number };

export const aiStatus = () => api<AiStatus>("/api/ai/status");
export const loadChat = () => api<{ messages: ChatMessage[] }>("/api/ai/chat");
export const clearChat = () => api<{ ok: true }>("/api/ai/chat", { method: "DELETE" });
export const sendChat = (message: string, profile?: ExamProfileKey) =>
  api<{ reply: string; style: ExamProfileKey; remaining: number }>("/api/ai/chat", { body: { message, ...(profile ? { profile } : {}) } });

export const askDoubtAi = (doubtId: string) =>
  api<{ answer: string; cached: boolean; remaining: number }>(`/api/ai/doubts/${encodeURIComponent(doubtId)}`, { method: "POST" });

export const explainQuestion = (testId: string, questionId: string) =>
  api<{ explanation: string; cached: boolean; remaining: number }>("/api/ai/explain", {
    body: { testId, questionId, lang: locale.value === "bn" ? "bn" : "en" },
  });

export type GeneratorInput = {
  profile: ExamProfileKey;
  subject: string;
  topic: string;
  count: number;
  difficulty: "easy" | "medium" | "hard";
};
export const generateQuestions = (input: GeneratorInput) =>
  api<{ questions: AdminTestQuestion[]; dropped: number; remaining: number }>("/api/ai/questions", {
    body: { ...input, lang: locale.value === "bn" ? "bn" : "en" },
  });

export const profileLabel = (key: ExamProfileKey) => (locale.value === "bn" ? EXAM_PROFILES[key].label_bn : EXAM_PROFILES[key].label_en);
