import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MarketNav } from "@/components/markets/market-nav";

export default async function MarketLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      marketCode: true,
      title: true,
      clientName: true,
      status: true,
    },
  });

  if (!market) notFound();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MarketNav market={market} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
