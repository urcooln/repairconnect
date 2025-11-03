// small helper to decode JWT payload without external dependency
export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let payload = parts[1];
    // base64url -> base64
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    // pad
    while (payload.length % 4) payload += '=';
    const decoded = atob(payload);
    try {
      // Some JWTs include percent-encoded bytes
      const json = decodeURIComponent(
        decoded
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(json);
    } catch {
      return JSON.parse(decoded);
    }
  } catch {
    return null;
  }
}
