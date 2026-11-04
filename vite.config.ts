import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: './', // Use relative paths so Electron and mobile WebViews can load assets via file://
  plugins: [react()],
});
