import path from 'node:path';
import type { VideoScene } from '../types';

export async function renderDailyVideo(entry: string, outputPath: string, scenes: VideoScene[]) {
  const [{ bundle }, { renderMedia, selectComposition }, { VIDEO_COMPOSITION_ID }] = await Promise.all([
    import('@remotion/bundler'),
    import('@remotion/renderer'),
    import('./remotion/compositionId'),
  ]);

  const serveUrl = await bundle({ entryPoint: path.resolve(entry) });
  const inputProps = { scenes };
  const composition = await selectComposition({
    serveUrl,
    id: VIDEO_COMPOSITION_ID,
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
  });
}
