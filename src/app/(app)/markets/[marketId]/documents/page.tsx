import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock } from "@/components/icons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) notFound();

  const documents = await prisma.projectDocument.findMany({
    where: { marketId },
    include: {
      project: true,
      documentType: true,
      verifiedBy: true,
    },
    orderBy: [{ project: { projectCode: "asc" } }, { expectedDate: "asc" }],
  });

  const missingCount = documents.filter((d) => d.isMandatory && !d.receivedDate).length;
  const lateCount = documents.filter(
    (d) => d.isMandatory && !d.receivedDate && d.expectedDate && new Date() > d.expectedDate
  ).length;

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total documents</p>
          <p className="text-xl font-bold">{documents.length}</p>
        </div>
        <div className={`border rounded-lg p-3 ${missingCount > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-500">Manquants (obligatoires)</p>
          <p className={`text-xl font-bold ${missingCount > 0 ? "text-orange-600" : ""}`}>{missingCount}</p>
        </div>
        <div className={`border rounded-lg p-3 ${lateCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-500">En retard</p>
          <p className={`text-xl font-bold ${lateCount > 0 ? "text-red-600" : ""}`}>{lateCount}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Chantier", "Site", "Document", "Obligatoire", "Date attendue", "Date reçue", "Valide", "Retard (j)", "Commentaires"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((doc) => {
                const isLate = doc.isMandatory && !doc.receivedDate && doc.expectedDate && new Date() > doc.expectedDate;
                return (
                  <tr key={doc.id} className={`hover:bg-gray-50 ${isLate ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-700 font-medium">
                      {doc.project.projectCode}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{doc.project.siteName ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{doc.documentType.name}</td>
                    <td className="px-4 py-2.5 text-center">
                      {doc.isMandatory ? (
                        <span className="text-xs text-orange-600 font-medium">Oui</span>
                      ) : (
                        <span className="text-xs text-gray-400">Non</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {doc.expectedDate
                        ? format(doc.expectedDate, "dd/MM/yyyy", { locale: fr })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {doc.receivedDate ? (
                        <span className="text-green-700">
                          {format(doc.receivedDate, "dd/MM/yyyy", { locale: fr })}
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">Non reçu</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {doc.isValid === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : doc.isValid === false ? (
                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-center">
                      {doc.lateDays ? (
                        <span className="text-red-600 font-medium">{doc.lateDays}j</span>
                      ) : isLate ? (
                        <span className="text-red-600 font-medium">
                          {Math.floor((new Date().getTime() - doc.expectedDate!.getTime()) / (1000 * 60 * 60 * 24))}j
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{doc.comments ?? "—"}</td>
                  </tr>
                );
              })}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Aucun document enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
