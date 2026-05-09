import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function archiveRun(outputRoot: string, dateKey: string, payload: Record<string, string>) {
  const folder = path.join(outputRoot, dateKey);
  await mkdir(folder, { recursive: true });

  for (const [name, value] of Object.entries(payload)) {
    const filePath = path.join(folder, name);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, value, 'utf8');
  }

  return folder;
}
