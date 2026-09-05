export interface EventCategoryOption {
  id: string;
  label: string;
  icon: string;
}

export const EVENT_CATEGORY_OPTIONS: EventCategoryOption[] = [
  { id: "meeting", label: "Meeting", icon: "🤝" },
  { id: "plenary", label: "Plenary", icon: "🏛️" },
  { id: "congress", label: "Congress / Convention", icon: "📜" },
  { id: "cleanup", label: "Cleanup Drive", icon: "🧹" },
  { id: "sanitation", label: "Environmental Sanitation", icon: "🌿" },
  { id: "workshop", label: "Workshop", icon: "📚" },
  { id: "training", label: "Training & Skills", icon: "🎓" },
  { id: "celebration", label: "Celebration & Gala", icon: "🎉" },
  { id: "reunion", label: "Reunion & Homecoming", icon: "🥂" },
  { id: "sports", label: "Sports & Fitness", icon: "⚽" },
  { id: "social", label: "Social Gathering / Hangout", icon: "☕" },
  { id: "outreach", label: "Community Outreach", icon: "❤️" },
  { id: "fundraiser", label: "Fundraiser & Welfare", icon: "💰" },
  { id: "health", label: "Health & Medical Outreach", icon: "🩺" },
  { id: "mentorship", label: "Youth Mentorship", icon: "🌱" },
  { id: "announcement", label: "General Announcement", icon: "📢" },
];

/**
 * Parses any category string (e.g. "Meeting, Plenary" or "meeting") into an array of matched labels.
 */
export function parseEventCategories(categoryStr?: string | null): string[] {
  if (!categoryStr || typeof categoryStr !== "string") return ["General Announcement"];
  const rawParts = categoryStr
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (rawParts.length === 0) return ["General Announcement"];

  const matchedLabels: string[] = [];
  for (const part of rawParts) {
    const lower = part.toLowerCase();
    const found = EVENT_CATEGORY_OPTIONS.find(
      (opt) => opt.id === lower || opt.label.toLowerCase() === lower || opt.label.toLowerCase().includes(lower)
    );
    if (found) {
      if (!matchedLabels.includes(found.label)) matchedLabels.push(found.label);
    } else {
      if (!matchedLabels.includes(part)) matchedLabels.push(part);
    }
  }
  return matchedLabels.length > 0 ? matchedLabels : ["General Announcement"];
}

/**
 * Formats an array of category labels into a single comma-separated string for persistence.
 */
export function formatEventCategories(labels: string[]): string {
  if (!labels || labels.length === 0) return "General Announcement";
  return labels.join(", ");
}
