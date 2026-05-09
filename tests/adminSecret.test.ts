import { describe, expect, it } from 'vitest';
import { buildAdminHeaders, hasAdminSecret } from '../app/adminSecret';

describe('adminSecret helpers', () => {
  it('adds x-admin-secret when a trimmed admin secret is provided', () => {
    expect(buildAdminHeaders('  demo-secret  ', 'application/json')).toEqual({
      'Content-Type': 'application/json',
      'x-admin-secret': 'demo-secret',
    });
  });

  it('treats blank admin secret as missing', () => {
    expect(hasAdminSecret('   ')).toBe(false);
    expect(buildAdminHeaders('   ')).toEqual({});
  });
});
