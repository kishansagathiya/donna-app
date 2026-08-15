/**
 * @jest-environment node
 */

import { accessTokenNeedsRefresh } from '../jwtExpiry';

function jwtWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    'base64url',
  );
  return `hdr.${payload}.sig`;
}

describe('accessTokenNeedsRefresh', () => {
  it('is false when the token is still valid', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    expect(accessTokenNeedsRefresh(token)).toBe(false);
  });

  it('is true when the token expires within 15s', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) + 5);
    expect(accessTokenNeedsRefresh(token)).toBe(true);
  });

  it('is true when the token is already expired', () => {
    const token = jwtWithExp(Math.floor(Date.now() / 1000) - 60);
    expect(accessTokenNeedsRefresh(token)).toBe(true);
  });

  it('is false when exp is missing', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u1' })).toString(
      'base64url',
    );
    expect(accessTokenNeedsRefresh(`hdr.${payload}.sig`)).toBe(false);
  });
});
