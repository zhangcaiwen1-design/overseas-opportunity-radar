export async function pushToWxPusher(appToken: string, uid: string, content: string) {
  await fetch('https://wxpusher.zjiecode.com/api/send/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appToken,
      content,
      uids: [uid],
      contentType: 1,
    }),
  });
}
