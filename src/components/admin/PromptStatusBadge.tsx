"use client";

import Badge from "@/components/ui/Badge";

const statusConfig: Record<string, { variant: "success" | "warning" | "muted"; label: string }> = {
  active: { variant: "success", label: "Active" },
  draft: { variant: "warning", label: "Draft" },
  archived: { variant: "muted", label: "Archived" },
};

interface PromptStatusBadgeProps {
  status: string;
}

export default function PromptStatusBadge({ status }: PromptStatusBadgeProps) {
  const config = statusConfig[status] ?? { variant: "muted" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
