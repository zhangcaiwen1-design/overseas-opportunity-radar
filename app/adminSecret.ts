export const ADMIN_SECRET_STORAGE_KEY = 'cloud-admin-secret';

export function hasAdminSecret(value: string) {
  return value.trim().length > 0;
}

export function buildAdminHeaders(adminSecret: string, contentType?: string) {
  const headers: Record<string, string> = {};

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (hasAdminSecret(adminSecret)) {
    headers['x-admin-secret'] = adminSecret.trim();
  }

  return headers;
}
