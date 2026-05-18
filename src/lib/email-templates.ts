const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contract Pilot</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:#1d4ed8;padding:20px 32px;display:flex;align-items:center;gap:12px;">
            <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">
              📋 Contract Pilot
            </span>
          </td>
        </tr>

        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Contract Pilot — Pilotage contractuel des marchés travaux<br/>
              <a href="${baseUrl}" style="color:#6b7280;">Accéder à l'application</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// 1. Alerte critique nouvelle
// ─────────────────────────────────────────────
export interface CriticalAlertEmailData {
  recipientName: string;
  marketCode: string;
  marketTitle: string;
  marketId: string;
  alerts: {
    alertType: string;
    severity: string;
    cause: string | null;
    projectCode?: string | null;
  }[];
}

export function criticalAlertEmail(data: CriticalAlertEmailData): string {
  const alertRows = data.alerts
    .map(
      (a) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;">
          <strong style="color:#991b1b;font-size:13px;">${a.alertType.replace(/_/g, " ")}</strong>
          ${a.projectCode ? `<span style="color:#6b7280;font-size:12px;margin-left:8px;">${a.projectCode}</span>` : ""}
          ${a.cause ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${a.cause}</p>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #fee2e2;text-align:right;white-space:nowrap;">
          <span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;">${a.severity}</span>
        </td>
      </tr>`
    )
    .join("");

  const content = `
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Bonjour ${data.recipientName},</p>
    <h2 style="margin:0 0 20px;font-size:20px;color:#111827;">
      🚨 ${data.alerts.length} nouvelle(s) alerte(s) critique(s)
    </h2>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Marché concerné</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">
        <span style="font-family:monospace;color:#1d4ed8;">${data.marketCode}</span>
        — ${data.marketTitle}
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#fef2f2;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Alerte</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Gravité</th>
        </tr>
      </thead>
      <tbody>${alertRows}</tbody>
    </table>

    <div style="text-align:center;">
      <a href="${baseUrl}/markets/${data.marketId}/alerts"
         style="display:inline-block;background:#1d4ed8;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Voir les alertes →
      </a>
    </div>`;

  return layout(content);
}

// ─────────────────────────────────────────────
// 2. Récapitulatif quotidien
// ─────────────────────────────────────────────
export interface DailyDigestEmailData {
  recipientName: string;
  date: string;
  markets: {
    marketCode: string;
    marketTitle: string;
    marketId: string;
    criticalAlerts: number;
    majorAlerts: number;
    score: number | null;
  }[];
  totalCritical: number;
  totalOpen: number;
}

export function dailyDigestEmail(data: DailyDigestEmailData): string {
  const marketRows = data.markets
    .map((m) => {
      const scoreColor =
        m.score === null ? "#9ca3af" : m.score >= 80 ? "#16a34a" : m.score >= 60 ? "#d97706" : "#dc2626";
      return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #f3f4f6;">
          <a href="${baseUrl}/markets/${m.marketId}/overview" style="text-decoration:none;">
            <span style="font-family:monospace;color:#1d4ed8;font-size:13px;font-weight:600;">${m.marketCode}</span>
            <span style="color:#374151;font-size:13px;margin-left:8px;">${m.marketTitle}</span>
          </a>
        </td>
        <td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:center;">
          ${m.criticalAlerts > 0 ? `<span style="background:#fee2e2;color:#991b1b;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;">${m.criticalAlerts} critique(s)</span>` : `<span style="color:#d1d5db;font-size:12px;">—</span>`}
        </td>
        <td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:center;">
          ${m.majorAlerts > 0 ? `<span style="background:#fff7ed;color:#c2410c;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;">${m.majorAlerts} majeur(s)</span>` : `<span style="color:#d1d5db;font-size:12px;">—</span>`}
        </td>
        <td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:center;">
          <span style="font-weight:700;color:${scoreColor};">${m.score ?? "—"}</span>
        </td>
      </tr>`;
    })
    .join("");

  const content = `
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Bonjour ${data.recipientName},</p>
    <h2 style="margin:0 0 6px;font-size:20px;color:#111827;">Récapitulatif du ${data.date}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Voici l'état de vos marchés ce matin.</p>

    ${data.totalCritical > 0 ? `
    <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
      <strong style="color:#991b1b;">⚠️ ${data.totalCritical} alerte(s) critique(s) en cours</strong>
      <span style="color:#6b7280;font-size:13px;margin-left:8px;">sur ${data.totalOpen} alertes ouvertes au total</span>
    </div>` : `
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
      <strong style="color:#15803d;">✅ Aucune alerte critique</strong>
      <span style="color:#6b7280;font-size:13px;margin-left:8px;">${data.totalOpen} alerte(s) mineure(s) en cours</span>
    </div>`}

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Marché</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Critique</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Majeur</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Score</th>
        </tr>
      </thead>
      <tbody>${marketRows}</tbody>
    </table>

    <div style="text-align:center;">
      <a href="${baseUrl}/dashboard"
         style="display:inline-block;background:#1d4ed8;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Ouvrir le dashboard →
      </a>
    </div>`;

  return layout(content);
}
