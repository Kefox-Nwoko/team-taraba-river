const getEnv = (key: string, fallback: string): string => {
  if (typeof window !== 'undefined') {
    const meta = (window as any).__APP_CONFIG__?.[key];
    if (meta) return meta;
  }
  const viteEnv = (import.meta.env as any)?.[`VITE_${key}`];
  if (viteEnv) return viteEnv;
  return fallback;
};

export const clientConfig = {
  ownerEmail: getEnv('OWNER_EMAIL', 'tarabateam@gmail.com'),
};

// Admin status is intentionally NOT decided on the client. The server is the
// single source of truth (ADMIN_EMAILS in server/config.ts, enforced by
// authMiddleware on every protected request). Use apiClient.verifySession()
// to get the authoritative role instead of checking an email against a
// locally held list — a client-side copy of that list would silently drift
// from the server's whenever ADMIN_EMAILS changes, and would also mean
// shipping admin email addresses in the public JS bundle for no benefit.
