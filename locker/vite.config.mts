/**
 * Build do Locker web (locker.keyconapp.com): React no navegador, sem react-native.
 *   npm run locker:dev    → servidor local para desenvolvimento
 *   npm run locker:build  → gera a pasta dist-locker/ (estática, para o subdomínio)
 *
 * Usa o mesmo projeto Supabase do app (src/config/supabase.ts), os mesmos limites
 * (src/files/limits.ts) e as mesmas traduções (src/i18n).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const lockerDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: lockerDir,
  // Caminho absoluto: os links /f/<código> e /d/<código> carregam o mesmo index.html
  base: '/',
  plugins: [react()],
  server: { port: 5174 },
  build: {
    outDir: path.resolve(lockerDir, '../dist-locker'),
    emptyOutDir: true,
  },
});
