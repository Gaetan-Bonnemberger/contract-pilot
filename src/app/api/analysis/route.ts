import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeContract } from "@/lib/llm";
import { PERMISSIONS } from "@/lib/permissions";
import { saveFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PERMISSIONS.analysis.run(session.user.role)) {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const formData = await req.formData();
  const marketId = formData.get("marketId") as string;
  const file = formData.get("file") as File | null;
  const existingFileId = formData.get("fileId") as string | null;

  if (!marketId) {
    return NextResponse.json({ error: "marketId requis" }, { status: 400 });
  }

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, title: true, clientName: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Marché introuvable" }, { status: 404 });
  }

  // Créer le run d'analyse
  const run = await prisma.contractAnalysisRun.create({
    data: {
      marketId,
      sourceFileId: existingFileId,
      status: "RUNNING",
      createdById: session.user.id,
    },
  });

  try {
    let extractedText = "";

    // Si un fichier est uploadé
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = await saveFile(buffer, `contracts/${marketId}`, file.name);

      const marketFile = await prisma.marketFile.create({
        data: {
          marketId,
          fileName: file.name,
          filePath,
          fileType: file.type,
          documentType: "CONTRAT",
          uploadedById: session.user.id,
        },
      });

      await prisma.contractAnalysisRun.update({
        where: { id: run.id },
        data: { sourceFileId: marketFile.id },
      });

      // Extraction texte (simplifié — en prod utiliser pdf-parse)
      extractedText = `[Contenu du fichier: ${file.name}]\n[Taille: ${buffer.length} octets]\nAnalyse en cours...`;
    }

    // Lancer l'analyse IA
    const result = await analyzeContract(
      extractedText || "Contrat de marché travaux TPE",
      `${market.title} — ${market.clientName}`
    );

    // Mettre à jour le run
    await prisma.contractAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        rawExtractedText: extractedText,
        llmRawResponse: result as object,
        completedAt: new Date(),
      },
    });

    // Créer ou mettre à jour le résumé (non validé)
    const existingSummary = await prisma.marketSummary.findUnique({
      where: { marketId },
    });

    if (existingSummary) {
      await prisma.marketSummary.update({
        where: { marketId },
        data: {
          analysisRunId: run.id,
          executiveSummary: result.executiveSummary,
          criticalClauses: result.criticalClauses,
          majorRisks: result.majorRisks,
          financialMechanisms: result.financialMechanisms,
          clarificationsNeeded: result.clarificationsNeeded,
          validatedAt: null,
          validatedById: null,
        },
      });
    } else {
      await prisma.marketSummary.create({
        data: {
          marketId,
          analysisRunId: run.id,
          executiveSummary: result.executiveSummary,
          criticalClauses: result.criticalClauses,
          majorRisks: result.majorRisks,
          financialMechanisms: result.financialMechanisms,
          clarificationsNeeded: result.clarificationsNeeded,
        },
      });
    }

    await audit({
      userId: session.user.id,
      action: "ANALYSIS_STARTED",
      entityType: "ContractAnalysisRun",
      entityId: run.id,
      marketId,
      label: `Analyse IA lancée${file ? ` — fichier : ${file.name}` : ""}`,
      details: { fileName: file?.name ?? null, runId: run.id },
    });

    return NextResponse.json({
      runId: run.id,
      result,
    });
  } catch (error) {
    await prisma.contractAnalysisRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date() },
    });

    return NextResponse.json(
      { error: "Erreur lors de l'analyse" },
      { status: 500 }
    );
  }
}
