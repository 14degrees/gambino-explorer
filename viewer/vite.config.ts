import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// /cdn, /catalog.json, /map.json and /thumbs come from server.mjs (port 8787)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/cdn': 'http://localhost:8787', '/catalog.json': 'http://localhost:8787', '/map.json': 'http://localhost:8787', '/thumbs': 'http://localhost:8787' } },
});
