"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function RecalculateAlertsButton({ marketId }: { marketId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRecalculate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets/${marketId}/alerts/recalculate`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.count} alerte(s) recalculée(s)`);
        router.refresh();
      } else {
        toast.error(data.error ?? "Erreur lors du recalcul");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRecalculate}
      disabled={loading}
    >
      <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
      Recalculer
    </Button>
  );
}
