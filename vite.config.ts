import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/apiHandler.mjs';

function kavcyDevApiPlugin() {
  return {
    name: 'kavcy-dev-api',
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          void handleApiRequest(req, res);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), kavcyDevApiPlugin()],
  server: {
    port: 5173,
  },
});
