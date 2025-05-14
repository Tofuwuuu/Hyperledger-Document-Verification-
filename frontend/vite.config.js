import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const API_BASE_URL = env.VITE_API_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      proxy: {
        // Proxy all API requests to avoid CORS issues during development
        '/api/v1': {
          target: API_BASE_URL,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => {
            // Fix path routing by removing any /api/v1 duplications
            const parts = path.split('/api/v1');
            // Keep only the first /api/v1 occurrence
            if (parts.length > 1) {
              const correctedPath = '/api/v1' + parts[parts.length - 1];
              return correctedPath;
            }
            return path;
          },
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
          }
        }
      }
    }
  }
})
