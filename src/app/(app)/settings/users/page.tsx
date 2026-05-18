import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await auth();
  // Réservé aux ADMIN
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { responsibleMarkets: true } },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { lastName: "asc" }],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Gestion des utilisateurs"
        subtitle={`${users.length} compte(s) enregistré(s)`}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <UsersClient
          initialUsers={users.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
          }))}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  );
}
