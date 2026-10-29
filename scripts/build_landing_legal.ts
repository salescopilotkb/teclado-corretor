/**
 * Gera as páginas da Política de Privacidade e dos Termos de Uso da landing
 * page (landing/privacidade.html e landing/termos.html) a partir dos mesmos
 * textos do app (src/legal/legal.ts), em português, inglês e espanhol.
 * O link público da Política é o que a Google Play e a App Store pedem.
 *
 * Uso: npm run landing:legal   (rode de novo quando mudar legal.ts)
 */
import * as fs from 'fs';
import * as path from 'path';
import { LEGAL_INFO, LEGAL_UPDATED, PRIVACY, TERMS, fillLegal, type LegalDocument } from '../src/legal/legal';

type Lang = 'pt' | 'en' | 'es';
// Inglês primeiro: o lançamento é nos Estados Unidos
const LANGS: Lang[] = ['en', 'es', 'pt'];
const HTML_LANG: Record<Lang, string> = { en: 'en', pt: 'pt-BR', es: 'es' };
const root = path.resolve(__dirname, '..');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const UI: Record<Lang, { updated: string; back: string }> = {
  pt: { updated: 'Última atualização', back: 'Voltar ao site' },
  en: { updated: 'Last updated', back: 'Back to the website' },
  es: { updated: 'Última actualización', back: 'Volver al sitio' },
};

function dateIn(lang: Lang): string {
  const [y, m, d] = LEGAL_UPDATED.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString({ pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[lang], { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

function section(doc: LegalDocument, lang: Lang): string {
  const body = doc.sections
    .map(s => `      <h2>${esc(s.title)}</h2>\n${s.paragraphs.map(p => `      <p>${esc(fillLegal(p))}</p>`).join('\n')}`)
    .join('\n');
  return `    <article class="legal-doc" lang="${HTML_LANG[lang]}" data-lang="${lang}"${lang === 'en' ? '' : ' hidden'}>
      <h1>${esc(doc.title)}</h1>
      <p class="legal-date">${UI[lang].updated}: ${dateIn(lang)}</p>
${body}
    </article>`;
}

function page(file: string, docs: Record<Lang, LegalDocument>) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(docs.en.title)} · KEYCON</title>
  <meta name="robots" content="index, follow">
  <link rel="icon" type="image/png" href="img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body class="legal-page">
  <!-- Gerado por scripts/build_landing_legal.ts a partir de src/legal/legal.ts. Não edite aqui. -->
  <header class="site-header">
    <div class="wrap header-row">
      <a class="brand" href="index.html"><img src="img/logo-keycon.png" alt="KEYCON" width="150" height="32"></a>
      <div class="lang-switch" role="group" aria-label="Language">
        ${LANGS.map(l => `<button type="button" data-set-lang="${l}" lang="${HTML_LANG[l]}">${l.toUpperCase()}</button>`).join('')}
      </div>
    </div>
  </header>
  <main class="wrap legal-main">
${LANGS.map(l => section(docs[l], l)).join('\n')}
    <p class="legal-back"><a href="index.html" data-i18n="legal.back">${UI.en.back}</a></p>
  </main>
  <script>
    // Idioma: o mesmo escolhido na página inicial (ou ?lang=pt / ?lang=es)
    (function () {
      var back = ${JSON.stringify({ pt: UI.pt.back, en: UI.en.back, es: UI.es.back })};
      var htmlLang = ${JSON.stringify(HTML_LANG)};
      var titles = ${JSON.stringify({ pt: docs.pt.title, en: docs.en.title, es: docs.es.title })};
      function apply(lang) {
        document.querySelectorAll('.legal-doc').forEach(function (a) { a.hidden = a.dataset.lang !== lang; });
        document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
        var link = document.querySelector('[data-i18n="legal.back"]');
        link.textContent = back[lang];
        link.href = 'index.html' + (lang === 'en' ? '' : '?lang=' + lang);
        document.documentElement.lang = htmlLang[lang];
        document.title = titles[lang] + ' · KEYCON';
        try { localStorage.setItem('keycon.lang', lang); } catch (e) {}
      }
      var q = new URLSearchParams(location.search).get('lang'), saved = null;
      try { saved = localStorage.getItem('keycon.lang'); } catch (e) {}
      var lang = [q, saved].find(function (l) { return l && back[l]; }) || 'en';
      document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.setLang); }); });
      apply(lang);
    })();
  </script>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, 'landing', file), html);
  console.log('landing/' + file);
}

page('privacidade.html', PRIVACY as Record<Lang, LegalDocument>);
page('termos.html', TERMS as Record<Lang, LegalDocument>);

const pending = Object.entries(LEGAL_INFO).filter(([, v]) => v.startsWith("["));
if (pending.length) console.warn(`⚠️  Ainda faltam os dados da empresa em src/legal/legal.ts (LEGAL_INFO): ${pending.map(([k]) => k).join(', ')}`);
