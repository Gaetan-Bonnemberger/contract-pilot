"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function CloseAlertButton({
  alertId,
  marketId,
}: {
  alertId: string;
  marketId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClose() {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets/${marketId}/alerts/${alertId}/close`, {
        method: "PATCH",
      });
      if (res.ok) {
        toast.success("Alerte clôturée");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-gray-500 hover:text-gray-900"
      onClick={handleClose}
      disabled={loading}
    >
      <X className="h-3 w-3 mr-1" />
      Clôturer
    </Button>
  );
}
