"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  smtpConfigured: boolean;
}

export function EmailSettingsClient({ smtpConfigured }: Props) {
  const [digestStatus, setDigestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [digestResult, setDigestResult] = useState<string>("");

  async function sendDigest() {
    setDigestStatus("loading");
    setDigestResult("");
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDigestStatus("ok");
        setDigestResult(`✅ Digest envoyé à ${data.sent} / ${data.recipients} destinataire(s) — ${data.markets} marché(s) inclus`);
      } else {
        setDigestStatus("error");
        setDigestResult(`❌ Erreur : ${data.error}`);
      }
    } catch {
      setDigestStatus("error");
      setDigestResult("❌ Erreur réseau");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Statut SMTP */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configuration SMTP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                smtpConfigured
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {smtpConfigured ? "✅ SMTP configuré" : "⚠️ SMTP non configuré"}
            </span>
          </div>

          {!smtpConfigured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p className="font-semibold mb-1">Configuration requise dans le fichier <code>.env</code> :</p>
              <pre className="text-xs mt-2 bg-white border border-yellow-100 rounded p-3 overflow-x-auto">{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM="Contract Pilot <votre.email@gmail.com>"`}</pre>
              <p className="mt-2 text-xs">
                Pour Gmail, créez un{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  mot de passe d'application
                </a>{" "}
                (compte avec 2FA activée requis).
              </p>
            </div>
          )}

          {smtpConfigured && (
            <p className="text-xs text-gray-500">
              Les emails sont envoyés via Gmail SMTP (smtp.gmail.com, port 587).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Alertes critiques */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Notifications d'alertes critiques</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            À chaque recalcul d'alertes, si des alertes critiques sont générées, un email est
            automatiquement envoyé au responsable du marché.
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700">Actif — déclenché automatiquement lors du recalcul</span>
          </div>
        </CardContent>
      </Card>

      {/* Digest quotidien */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Récapitulatif quotidien (digest)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Le digest présente l'état de tous les marchés actifs (alertes, scores) et est envoyé
            à tous les <strong>ADMIN</strong> et <strong>DIRECTEUR</strong>.
          </p>

          <Button
            onClick={sendDigest}
            disabled={digestStatus === "loading" || !smtpConfigured}
            size="sm"
          >
            {digestStatus === "loading" ? "Envoi en cours…" : "Envoyer le digest maintenant"}
          </Button>

          {!smtpConfigured && (
            <p className="text-xs text-gray-400">Configurez d'abord le SMTP pour activer cette fonctionnalité.</p>
          )}

          {digestResult && (
            <p className={`text-sm mt-2 ${digestStatus === "ok" ? "text-green-700" : "text-red-600"}`}>
              {digestResult}
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
