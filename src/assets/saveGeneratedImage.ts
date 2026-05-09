import { writeFile } from 'node:fs/promises';

export async function saveGeneratedImage(b64: string, outputPath: string) {
  await writeFile(outputPath, Buffer.from(b64, 'base64'));
}
