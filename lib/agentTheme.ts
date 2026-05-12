export type AgentId = "andrey" | "milena" | "alexander" | "alina" | "mikhail" | "nikolay" | "viktor" | "arkadiy";

export interface AgentTheme {
  bg: string; // linear-gradient
  ringFrom: string;
  ringTo: string;
  text: string;
  shadow: string;
}

export const AGENT_THEME: Record<AgentId, AgentTheme> = {
  andrey:    { bg: "linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)", ringFrom: "#0EA5E9", ringTo: "#6366F1", text: "#0EA5E9", shadow: "0 8px 24px rgba(14,165,233,0.18)" },
  milena:    { bg: "linear-gradient(135deg, #FFFFFF 0%, #FDF4FF 100%)", ringFrom: "#EC4899", ringTo: "#8B5CF6", text: "#DB2777", shadow: "0 8px 24px rgba(236,72,153,0.18)" },
  alexander: { bg: "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)", ringFrom: "#8B5CF6", ringTo: "#6366F1", text: "#7C3AED", shadow: "0 8px 24px rgba(139,92,246,0.18)" },
  alina:     { bg: "linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%)", ringFrom: "#F59E0B", ringTo: "#EF4444", text: "#D97706", shadow: "0 8px 24px rgba(245,158,11,0.18)" },
  mikhail:   { bg: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)", ringFrom: "#10B981", ringTo: "#0EA5E9", text: "#059669", shadow: "0 8px 24px rgba(16,185,129,0.18)" },
  nikolay:   { bg: "linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)", ringFrom: "#6366F1", ringTo: "#8B5CF6", text: "#4F46E5", shadow: "0 8px 24px rgba(99,102,241,0.18)" },
  viktor:    { bg: "linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 100%)", ringFrom: "#F97316", ringTo: "#EF4444", text: "#EA580C", shadow: "0 8px 24px rgba(249,115,22,0.18)" },
  arkadiy:   { bg: "linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)", ringFrom: "#9CA3AF", ringTo: "#6B7280", text: "#6B7280", shadow: "0 8px 24px rgba(107,114,128,0.18)" },
};
