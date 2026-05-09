import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export function readStyleText(styleUrl: URL) {
  if (styleUrl.pathname.startsWith('/_next/')) {
    const nextRelativePath = styleUrl.pathname.replace(/^\/_next\//, '');
    const candidatePaths = [
      path.join(process.cwd(), '.next', nextRelativePath),
      path.join(process.cwd(), '.next', 'server', 'chunks', nextRelativePath),
    ];

    for (const candidatePath of candidatePaths) {
      if (existsSync(candidatePath)) {
        return readFileSync(candidatePath, 'utf8');
      }
    }

    throw new Error(`Traced style asset not found: ${styleUrl.toString()}`);
  }

  if (styleUrl.protocol === 'file:') {
    return readFileSync(styleUrl, 'utf8');
  }

  throw new TypeError(`Unsupported style URL: ${styleUrl.toString()}`);
}
