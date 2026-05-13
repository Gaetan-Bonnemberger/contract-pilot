import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { recalculateAlerts } from "@/lib/alerts";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.alerts.recalculate(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const { marketId } = await params;

  try {
    const count = await recalculateAlerts(marketId);
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors du recalcul" },
      { status: 500 }
    );
  }
}
