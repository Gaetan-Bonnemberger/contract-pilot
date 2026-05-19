"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En production, envoyer l'erreur à un service de monitoring
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">⚠️</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Une erreur est survenue</h1>
          <p className="text-gray-500 mt-2">
            L'application a rencontré un problème inattendu.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 text-left overflow-auto max-h-48">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          )}
          {error.digest && (
            <p className="text-xs text-gray-400 mt-2">Code : {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} size="sm">
            Réessayer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Retour au dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
