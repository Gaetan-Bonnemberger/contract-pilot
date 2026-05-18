import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { EmailSettingsClient } from "./email-settings-client";

export default async function EmailSettingsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Paramètres email"
        subtitle="Configuration SMTP et notifications automatiques"
      />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <EmailSettingsClient smtpConfigured={smtpConfigured} />
      </main>
    </div>
  );
}
