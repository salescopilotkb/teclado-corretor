import React from 'react';
import { createRoot } from 'react-dom/client';
import { isLang } from '../../src/i18n';
import { applyLanguage, browserLanguage, chosenLanguage } from './lang';
import { App } from './App';
import './styles.css';

// Idioma antes de entrar: o escolhido na página ou o do navegador (depois, o do perfil: lang.ts)
const asked = new URLSearchParams(location.search).get('lang');
applyLanguage(chosenLanguage() ?? (isLang(asked) ? asked : browserLanguage()));

// Uso sem internet: guarda a página (só no site publicado; no desenvolvimento atrapalharia)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
