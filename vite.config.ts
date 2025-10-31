import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Split vendor and react-related code into separate chunks to reduce the main bundle size
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id) return;
              if (id.includes('node_modules')) {
                // Split large, specific libraries into their own vendor chunks
                if (id.includes('react') || id.includes('react-dom')) return 'vendor_react';
                if (id.includes('recharts')) return 'vendor_recharts';
                if (id.includes('firebase')) return 'vendor_firebase';
                if (id.includes('@google/genai') || id.includes('genai')) return 'vendor_genai';
                // Further split common heavy transitive libs
                if (id.includes('d3') || id.includes('d3-')) return 'vendor_d3';
                if (id.includes('lodash') || id.includes('lodash-es')) return 'vendor_lodash';
                if (id.includes('redux') || id.includes('@reduxjs') || id.includes('redux-toolkit') || id.includes('rtk')) return 'vendor_redux';
                if (id.includes('immer')) return 'vendor_immer';
                // fallback vendor bundle
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
