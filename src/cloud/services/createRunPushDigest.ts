import { renderPushDigest } from '../../push/renderPushDigest';

export function createRunPushDigest(input: Parameters<typeof renderPushDigest>[0]) {
  return renderPushDigest(input);
}
