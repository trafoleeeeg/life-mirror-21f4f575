import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.mirr',
  appName: 'Mirr',
  webDir: 'dist',
  server: {
    url: 'https://97654a1e-aafa-458e-888f-e8e42ca185ae.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
