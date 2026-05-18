/**
 * POST /api/analysis
 * Lance l'extraction PDF + analyse IA pour un marché donné.
 * Retourne le runId et le résultat complet pour prévisualisation côté client.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeContract } from "@/lib/llm";
import { extractFileText } from "@/lib/pdf";
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
    select: { id: true, title: true, clientName: true, marketType: true, marketCode: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Marché introuvable" }, { status: 404 });
  }

  // Créer le run en état RUNNING
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
    let sourceFileId: string | null = existingFileId;

    // ── Étape 1 : extraction du texte ──────────────────────────────────────
    if (file && file.size > 0) {
      // Sauvegarde physique du fichier
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = await saveFile(buffer, `contracts/${marketId}`, file.name);

      const marketFile = await prisma.marketFile.create({
        data: {
          marketId,
          fileName: file.name,
          filePath,
          fileType: file.type || "application/octet-stream",
          documentType: "CONTRAT",
          uploadedById: session.user.id,
        },
      });
      sourceFileId = marketFile.id;

      await prisma.contractAnalysisRun.update({
        where: { id: run.id },
        data: { sourceFileId: marketFile.id },
      });

      // Extraction réelle du texte (PDF ou texte brut)
      extractedText = await extractFileText(file);

      console.log(
        `[analysis] Texte extrait : ${extractedText.length} caractères depuis ${file.name}`
      );
    } else if (existingFileId) {
      // Utiliser un fichier déjà uploadé
      const existingFile = await prisma.marketFile.findUnique({
        where: { id: existingFileId },
        select: { filePath: true, fileName: true },
      });
      if (existingFile) {
        // Tenter de lire le fichier depuis le système de fichiers
        try {
          const fs = await import("fs/promises");
          const buf = await fs.readFile(existingFile.filePath);
          const ext = existingFile.fileName.split(".").pop()?.toLowerCase();
          if (ext === "pdf") {
            const { extractPdfText } = await import("@/lib/pdf");
            extractedText = await extractPdfText(buf);
          } else {
            extractedText = buf.toString("utf-8");
          }
        } catch {
          console.warn("[analysis] Impossible de lire le fichier existant");
        }
      }
    }

    // ── Étape 2 : analyse IA ───────────────────────────────────────────────
    const marketContext = `Type : ${market.marketType} | Client : ${market.clientName} | Marché : ${market.title} (${market.marketCode})`;

    const result = await analyzeContract(
      extractedText || `Marché ${market.title} — ${market.clientName}`,
      marketContext
    );

    // ── Étape 3 : persistance ──────────────────────────────────────────────
    await prisma.contractAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        rawExtractedText: extractedText.substring(0, 50000), // limiter la taille en DB
        llmRawResponse: result as object,
        completedAt: new Date(),
      },
    });

    // Créer ou remplacer le résumé (non validé jusqu'à validation manuelle)
    const existingSummary = await prisma.marketSummary.findUnique({ where: { marketId } });
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
      label: `Analyse IA terminée${file ? ` — ${file.name} (${(file.size / 1024).toFixed(0)} Ko)` : ""}`,
      details: {
        fileName: file?.name ?? null,
        extractedChars: extractedText.length,
        clausesFound: result.extractedClauses.length,
        kpisFound: result.extractedKpis.length,
        obligationsFound: result.extractedObligations.length,
        penaltiesFound: result.extractedPenalties?.length ?? 0,
        runId: run.id,
      },
    });

    return NextResponse.json({
      runId: run.id,
      extractedChars: extractedText.length,
      result,
    });

  } catch (error) {
    console.error("[analysis] Erreur :", error);

    await prisma.contractAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });

    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
