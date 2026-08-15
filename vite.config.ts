import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
      watch: {},
    },
    build: {
      outDir: 'dist/public',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // Split heavy vendors into their own long-lived chunks so they are
          // cached independently and only re-downloaded when they actually change.
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
              if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
              if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
              return 'vendor';
            }
          },
        },
      },
    },
    envPrefix: 'VITE_',
  };
});
