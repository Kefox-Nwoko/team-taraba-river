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
  adminEmails: getEnv('ADMIN_EMAILS', 'tarabateam@gmail.com,kefox.nwoko@gmail.com')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean),
};

export const isAdminEmailClient = (email?: string | null): boolean => {
  if (!email) return false;
  return clientConfig.adminEmails.includes(email.toLowerCase());
};
