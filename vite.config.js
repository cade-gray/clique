import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under an IIS virtual directory as well as the site root.
  base: './',
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
