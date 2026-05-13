import fs from "fs/promises";
import path from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

export async function ensureStorageDir(subDir: string): Promise<string> {
  const dir = path.join(STORAGE_PATH, subDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveFile(
  buffer: Buffer,
  subDir: string,
  fileName: string
): Promise<string> {
  const dir = await ensureStorageDir(subDir);
  const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(dir, safeName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore si déjà supprimé
  }
}

export async function readFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
