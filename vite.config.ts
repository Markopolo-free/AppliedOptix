import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
    const env = loadEnv(mode, '.', '');

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
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins,
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
        sourcemap: true,
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
                if (id.includes('react') || id.includes('react-dom')) return 'vendor_react';
                if (id.includes('recharts')) return 'vendor_recharts';
                if (id.includes('firebase')) {
                  // Prefer splitting firebase into its specific submodules when present
                  if (id.includes('firebase' + path.sep + 'app') || id.includes('firebase' + '/app')) return 'vendor_firebase_app';
                  if (id.includes('firebase' + path.sep + 'auth') || id.includes('firebase' + '/auth')) return 'vendor_firebase_auth';
                  if (id.includes('firebase' + path.sep + 'firestore') || id.includes('firebase' + '/firestore')) return 'vendor_firebase_firestore';
                  if (id.includes('firebase' + path.sep + 'storage') || id.includes('firebase' + '/storage')) return 'vendor_firebase_storage';
                  if (id.includes('firebase' + path.sep + 'functions') || id.includes('firebase' + '/functions')) return 'vendor_firebase_functions';
                  if (id.includes('firebase' + path.sep + 'analytics') || id.includes('firebase' + '/analytics')) return 'vendor_firebase_analytics';
                  if (id.includes('firebase' + path.sep + 'database') || id.includes('firebase' + '/database')) return 'vendor_firebase_database';
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
