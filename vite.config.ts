import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const DEV_TUNNEL_HOST = env.DEV_TUNNEL_HOST || '';
  const isTunnel = !!DEV_TUNNEL_HOST;

  // Base plugins
  const plugins = [react()];
  let visualizerPlugin: any = null;

    // Optionally include bundle visualizer if available
    try {
      // @ts-ignore - visualizer is an optional dev dependency; ignore type resolution
      const { visualizer } = await import('rollup-plugin-visualizer');
      visualizerPlugin = visualizer({
        filename: 'dist/bundle-report.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
        emitFile: false
      }) as any;
    } catch (e) {
      // Visualizer not installed; skip without failing the build
    }

    return {
      base: mode === 'production' ? './' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
        },
        proxy: isTunnel ? undefined : {
          '/api': {
            target: 'http://localhost:5050',
            changeOrigin: true,
            secure: false,
          }
        },
        hmr: isTunnel
          ? false  // Disable HMR for tunnel to prevent hanging
          : true,
        cors: true,
        watch: {
          usePolling: false,
        },
      },
      plugins,
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        // Ensure only a single copy of React, ReactDOM, and Firebase are bundled
        dedupe: ['react', 'react-dom', 'use-sync-external-store', 'firebase', 'firebase/app', 'firebase/database', 'firebase/messaging']
      },
      build: {
        sourcemap: mode === 'development',
        // Split vendor and react-related code into separate chunks to reduce the main bundle size
        rollupOptions: {
          plugins: [
            // only include if available
            ...(visualizerPlugin ? [visualizerPlugin] : [])
          ],
          output: {
            manualChunks(id) {
              if (!id) return;
              if (id.includes('node_modules')) {
                // Split large, specific libraries into their own vendor chunks
                // Group use-sync-external-store WITH React to ensure proper initialization order
                if (id.includes('react') || id.includes('react-dom') || id.includes('use-sync-external-store')) return 'vendor_react';
                if (id.includes('recharts')) return 'vendor_recharts';
                if (id.includes('firebase')) {
                  // Keep all firebase modules together to preserve initialization order
                  return 'vendor_firebase';
                }
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
