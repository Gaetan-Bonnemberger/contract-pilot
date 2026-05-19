import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-8xl font-black text-gray-200">404</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Page introuvable</h1>
          <p className="text-gray-500 mt-2">
            La page que vous cherchez n'existe pas ou a été déplacée.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard">Retour au dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
