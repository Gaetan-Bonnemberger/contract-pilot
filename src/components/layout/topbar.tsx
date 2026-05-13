"use client";

import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  DIRECTEUR: "Directeur",
  RESPONSABLE_MARCHE: "Resp. Marché",
  EXPLOITATION: "Exploitation",
  QSE: "QSE",
  LECTURE: "Lecture",
};

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { data: session } = useSession();

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {session?.user && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">{session.user.name}</span>
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABELS[session.user.role] ?? session.user.role}
            </Badge>
          </div>
        )}
      </div>
    </header>
  );
}
