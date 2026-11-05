// Monta as partes do site keyconapp.com que dependem de SEO:
//   1. landing/pt/index.html e landing/es/index.html: a página inicial com o texto
//      já traduzido no HTML (o Google lê cada idioma no seu endereço).
//      A fonte é landing/index.html (inglês) + os textos do I18N em landing/script.js.
//   2. O bloco <!-- seo:start --> ... <!-- seo:end --> das três páginas: canonical,
//      hreflang, descrição, redes sociais e dados estruturados (Schema.org).
//   3. O blog em inglês, português e espanhol (landing/blog/, landing/pt/blog/, landing/es/blog/),
//      a partir dos artigos em content/blog/<idioma>/*.html.
//   4. landing/sitemap.xml.
// Rodar: npm run landing:site   (o scripts/build_hostgator_zips.ps1 já roda)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = path.join(ROOT, 'landing');
const SITE = 'https://keyconapp.com';
// Data da última mudança das páginas fixas (para o sitemap)
const SITE_UPDATED = '2026-11-05';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');
const jsonLd = (obj) => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c').split('\n').map((l) => '  ' + l).join('\n');

// ── 1 e 2. Página inicial nos três idiomas ─────────────────────────────────
const LANGS = ['en', 'pt', 'es'];
const HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es' };
const OG_LOCALE = { en: 'en_US', pt: 'pt_BR', es: 'es_US' };
const PAGE_URL = { en: `${SITE}/`, pt: `${SITE}/pt/`, es: `${SITE}/es/` };
const META = {
  en: {
    desc: 'KEYCON is the sales keyboard for your phone: send products with photos, ready-made replies and customer details in one tap, inside WhatsApp or any chat app.',
    ogTitle: 'KEYCON: the sales keyboard for your phone',
    ogDesc: 'Your products, ready-made replies and customers inside your phone keyboard, in any chat app.',
    appDesc: 'A phone keyboard for people who sell. Products with photos, ready-made replies, customers (CRM), calendar and translation, sent in one tap inside any chat app.',
  },
  pt: {
    desc: 'O KEYCON é o teclado de vendas do seu celular: envie produtos com fotos, respostas prontas e dados dos clientes com um toque, no WhatsApp ou em qualquer app.',
    ogTitle: 'KEYCON: o teclado de vendas do seu celular',
    ogDesc: 'Seus produtos, respostas prontas e clientes dentro do teclado do celular, em qualquer app de conversa.',
    appDesc: 'Um teclado de celular para quem vende. Produtos com fotos, respostas prontas, clientes (CRM), agenda e tradução, enviados com um toque em qualquer app de conversa.',
  },
  es: {
    desc: 'KEYCON es el teclado de ventas de tu celular: envía productos con fotos, respuestas listas y datos de clientes con un toque, en WhatsApp o en cualquier app.',
    ogTitle: 'KEYCON: el teclado de ventas de tu celular',
    ogDesc: 'Tus productos, respuestas listas y clientes dentro del teclado del celular, en cualquier app de chat.',
    appDesc: 'Un teclado de celular para quien vende. Productos con fotos, respuestas listas, clientes (CRM), agenda y traducción, enviados con un toque en cualquier app de chat.',
  },
};

const source = read(path.join(LANDING, 'index.html'));
const scriptJs = read(path.join(LANDING, 'script.js'));
const i18nStart = scriptJs.indexOf('var I18N = ');
const endMatch = /\r?\n\};\r?\n/.exec(scriptJs.slice(i18nStart));
if (i18nStart < 0 || !endMatch) throw new Error('I18N não encontrado em landing/script.js');
const I18N = new Function(scriptJs.slice(i18nStart, i18nStart + endMatch.index + endMatch[0].length) + '\nreturn I18N;')();

// Textos em inglês: o que está no HTML
const EN = {};
for (const m of source.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)) EN[m[1]] ??= m[2];
EN['meta.title'] = source.match(/<title>([^<]*)<\/title>/)[1];
const tr = (lang, key) => (lang === 'en' ? EN[key] : I18N[lang][key] ?? EN[key]);
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function seoBlock(lang) {
  const m = META[lang];
  const alternates = LANGS.map((l) => `  <link rel="alternate" hreflang="${HTML_LANG[l]}" href="${PAGE_URL[l]}">`).join('\n');
  // Perguntas na ordem em que aparecem na página
  const faqKeys = [...source.matchAll(/data-i18n="(faq\.\d+)q"/g)].map((x) => x[1]);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#organization`,
        name: 'KEYCON',
        url: `${SITE}/`,
        logo: `${SITE}/img/icone-keycon.png`,
        email: 'contact@keyconapp.com',
        slogan: 'Smart keyboard. Organized sales.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: 'KEYCON',
        url: `${SITE}/`,
        inLanguage: ['en', 'pt-BR', 'es'],
        publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE}/#app`,
        name: 'KEYCON',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Keyboard',
        operatingSystem: 'Android, iOS',
        description: m.appDesc,
        url: PAGE_URL[lang],
        image: `${SITE}/img/icone-keycon.png`,
        inLanguage: ['en', 'pt-BR', 'es'],
        publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${PAGE_URL[lang]}#webpage`,
        url: PAGE_URL[lang],
        name: unesc(tr(lang, 'meta.title') || ''),
        description: m.desc,
        inLanguage: HTML_LANG[lang],
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${SITE}/#app` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${PAGE_URL[lang]}#faq`,
        inLanguage: HTML_LANG[lang],
        mainEntity: faqKeys.map((k) => ({
          '@type': 'Question',
          name: unesc(tr(lang, k + 'q')),
          acceptedAnswer: { '@type': 'Answer', text: unesc(tr(lang, k + 'a')) },
        })),
      },
    ],
  };
  return `  <!-- seo:start (gerado por scripts/build_landing_site.mjs: canonical, idiomas, descrição, redes sociais e dados estruturados) -->
  <meta name="description" content="${escAttr(m.desc)}">
  <link rel="canonical" href="${PAGE_URL[lang]}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${PAGE_URL.en}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="KEYCON">
  <meta property="og:locale" content="${OG_LOCALE[lang]}">
  <meta property="og:title" content="${escAttr(m.ogTitle)}">
  <meta property="og:description" content="${escAttr(m.ogDesc)}">
  <meta property="og:url" content="${PAGE_URL[lang]}">
  <meta property="og:image" content="${SITE}/img/og-keycon.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
${jsonLd(graph)}
  </script>
  <!-- seo:end -->`;
}

const SEO_RE = /  <!-- seo:start[\s\S]*?<!-- seo:end -->/;
if (!SEO_RE.test(source)) throw new Error('landing/index.html sem o bloco <!-- seo:start --> ... <!-- seo:end -->');

// Inglês: só o bloco de SEO muda (o resto do arquivo é a fonte)
write(path.join(LANDING, 'index.html'), source.replace(SEO_RE, () => seoBlock('en')));

for (const lang of ['pt', 'es']) {
  const dict = I18N[lang];
  const missing = [];
  let html = source.replace(SEO_RE, () => seoBlock(lang));
  // Textos
  html = html.replace(/(<[a-z0-9]+\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<)/g, (all, open, key, text, lt) => {
    if (dict[key] == null) { missing.push(key); return all; }
    return open + escText(dict[key]) + lt;
  });
  // alt e placeholder
  html = html.replace(/<[a-z]+\b[^>]*\sdata-i18n-(alt|placeholder)="([^"]+)"[^>]*>/g, (tag, attr, key) => {
    if (dict[key] == null) { missing.push(key); return tag; }
    return tag.replace(new RegExp(`\\s${attr}="[^"]*"`), ` ${attr}="${escAttr(dict[key])}"`);
  });
  html = html
    .replace('<html lang="en" data-lang="en">', `<html lang="${HTML_LANG[lang]}" data-lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escText(dict['meta.title'])}</title>`)
    // Telas do teclado no idioma da página
    .replace(/img\/en\//g, `img/${lang}/`)
    // Caminhos relativos: a página fica uma pasta abaixo
    .replace(/(\s(?:src|href)=")(?!https?:|#|\/|mailto:|tel:|data:|\.\.\/|blog\/)([^"]+")/g, '$1../$2');
    // "blog/" fica relativo: em /pt/ leva ao blog em português (/pt/blog/)
  const pressed = html.match(/data-set-lang="/g)?.length ?? 0;
  if (pressed !== 3) throw new Error('seletor de idioma inesperado');
  if (missing.length) console.warn(`[${lang}] sem tradução (fica em inglês): ${[...new Set(missing)].join(', ')}`);
  write(path.join(LANDING, lang, 'index.html'), html);
  console.log(`landing/${lang}/index.html`);
}

// ── 3. Blog (inglês, português e espanhol) ────────────────────────────────
// Artigos: content/blog/<idioma>/<id>.html. O mesmo <id> nos três idiomas = o mesmo
// artigo traduzido (o Google liga as versões pelo hreflang). Cada arquivo começa com
// um comentário JSON e depois vem o corpo em HTML:
// <!--{ "slug": "endereco-no-idioma", "title": "...", "description": "...",
//        "date": "AAAA-MM-DD", "updated": "AAAA-MM-DD", "category": "...", "lead": "..." }-->
// No corpo:  {{up}} = raiz do site · {{home}} = página inicial do idioma ·
//            {{shots}} = telas do app no idioma (img/<idioma>/) · {{post:<id>}} = outro artigo
// Endereços: /blog/<slug>/ (en), /pt/blog/<slug>/, /es/blog/<slug>/
const BLOG_SRC = path.join(ROOT, 'content', 'blog');
const ASSET_V = (scriptJs.match(/ASSET_VERSION = '(\d+)'/) || [])[1] || '1';
const LOCALE = { en: 'en-US', pt: 'pt-BR', es: 'es-US' };
const UI = {
  en: {
    skip: 'Skip to content', app: 'The app', cta: 'Get early access', toc: 'In this article', by: 'By the KEYCON team',
    min: 'min read', more: 'Keep reading', home: 'Home', privacy: 'Privacy Policy', terms: 'Terms of Use',
    note: 'WhatsApp, Instagram and Messenger are trademarks of Meta. KEYCON is not affiliated with Meta.',
    ctaTitle: 'Sell from the keyboard you already type on',
    ctaText: 'KEYCON puts your products, ready-made replies and customers inside your phone keyboard, so you can answer in any chat app with one tap. Available soon for iPhone and Android.',
    indexTitle: 'KEYCON Blog: Guides for Selling by Chat and Text',
    indexDesc: 'Practical guides for people who sell over WhatsApp, text and social media: faster replies, message templates, real estate tips and keyboard privacy.',
    eyebrow: 'KEYCON Blog', h1: 'Selling by chat, made faster',
    lead: 'Practical guides for people who sell over WhatsApp, text and social media: faster replies, better messages and a phone that works as hard as you do.',
    feed: 'Practical guides for people who sell by chat and text.', articles: 'Articles', langLabel: 'Language',
  },
  pt: {
    skip: 'Pular para o conteúdo', app: 'O app', cta: 'Quero acesso antecipado', toc: 'Neste artigo', by: 'Por equipe KEYCON',
    min: 'min de leitura', more: 'Continue lendo', home: 'Início', privacy: 'Política de Privacidade', terms: 'Termos de Uso',
    note: 'WhatsApp, Instagram e Messenger são marcas da Meta. O KEYCON não é afiliado à Meta.',
    ctaTitle: 'Venda pelo teclado que você já usa',
    ctaText: 'O KEYCON coloca seus produtos, respostas prontas e clientes dentro do teclado do celular, para você responder em qualquer app de conversa com um toque. Em breve para iPhone e Android.',
    indexTitle: 'Blog do KEYCON: guias para vender pelo WhatsApp e pelo celular',
    indexDesc: 'Guias práticos para quem vende pelo WhatsApp, Instagram e mensagens: respostas mais rápidas, mensagens prontas, dicas para corretores de imóveis e privacidade no teclado.',
    eyebrow: 'Blog do KEYCON', h1: 'Vender pelo celular, mais rápido',
    lead: 'Guias práticos para quem vende pelo WhatsApp, Instagram e mensagens: respostas mais rápidas, mensagens melhores e um celular que trabalha tanto quanto você.',
    feed: 'Guias práticos para quem vende pelo celular.', articles: 'Artigos', langLabel: 'Idioma',
  },
  es: {
    skip: 'Ir al contenido', app: 'La app', cta: 'Quiero acceso anticipado', toc: 'En este artículo', by: 'Por el equipo de KEYCON',
    min: 'min de lectura', more: 'Sigue leyendo', home: 'Inicio', privacy: 'Política de Privacidad', terms: 'Términos de Uso',
    note: 'WhatsApp, Instagram y Messenger son marcas de Meta. KEYCON no está afiliado a Meta.',
    ctaTitle: 'Vende desde el teclado que ya usas',
    ctaText: 'KEYCON pone tus productos, respuestas listas y clientes dentro del teclado del celular, para que respondas en cualquier app de chat con un toque. Muy pronto para iPhone y Android.',
    indexTitle: 'Blog de KEYCON: guías para vender por WhatsApp y por el celular',
    indexDesc: 'Guías prácticas para quien vende por WhatsApp, Instagram y mensajes: respuestas más rápidas, plantillas de mensajes, consejos para agentes inmobiliarios y privacidad del teclado.',
    eyebrow: 'Blog de KEYCON', h1: 'Vender por chat, más rápido',
    lead: 'Guías prácticas para quien vende por WhatsApp, Instagram y mensajes: respuestas más rápidas, mejores mensajes y un celular que trabaja tanto como tú.',
    feed: 'Guías prácticas para quien vende por chat.', articles: 'Artículos', langLabel: 'Idioma',
  },
};
const blogBase = (lang) => (lang === 'en' ? '' : lang + '/') + 'blog/';   // relativo à raiz
const blogDir = (lang) => path.join(LANDING, ...(lang === 'en' ? [] : [lang]), 'blog');

const posts = {};   // posts[lang] = [...]
for (const lang of LANGS) {
  const dir = path.join(BLOG_SRC, lang);
  posts[lang] = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => f.endsWith('.html')).map((f) => {
    const raw = read(path.join(dir, f));
    const m = raw.match(/^<!--([\s\S]*?)-->\s*/);
    if (!m) throw new Error(`${lang}/${f}: falta o cabeçalho JSON`);
    const meta = JSON.parse(m[1]);
    for (const k of ['title', 'description', 'date', 'category', 'lead']) if (!meta[k]) throw new Error(`${lang}/${f}: falta "${k}"`);
    const body = raw.slice(m[0].length).trim();
    const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const id = f.replace(/\.html$/, '');
    const slug = meta.slug || id;
    return { id, lang, slug, ...meta, updated: meta.updated || meta.date, body, words, minutes: Math.max(1, Math.round(words / 230)), path: blogBase(lang) + slug + '/' };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}
const byId = (lang, id) => posts[lang].find((p) => p.id === id);
const versions = (id) => LANGS.map((l) => byId(l, id)).filter(Boolean);

const fmtDate = (d, lang) => new Date(d + 'T12:00:00Z').toLocaleDateString(LOCALE[lang], { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });

function toc(body, lang) {
  const items = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  if (items.length < 3) return '';
  return `<nav class="toc" aria-label="${UI[lang].toc}"><p class="toc-title">${UI[lang].toc}</p><ol>${items.map((x) => `<li><a href="#${x[1]}">${x[2]}</a></li>`).join('')}</ol></nav>`;
}

const ORG_REF = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'KEYCON', url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/img/icone-keycon.png` } };

// alts: [{ lang, path }] (path relativo à raiz) das versões da mesma página
function layout({ lang, title, desc, pathRel, alts, ogType, ld, main }) {
  const u = UI[lang];
  const depth = pathRel.split('/').filter(Boolean).length;
  const up = '../'.repeat(depth);
  const home = up + (lang === 'en' ? '' : lang + '/');
  const canonical = `${SITE}/${pathRel}`;
  const hreflang = alts.map((a) => `  <link rel="alternate" hreflang="${HTML_LANG[a.lang]}" href="${SITE}/${a.path}">`).join('\n') +
    (alts.some((a) => a.lang === 'en') ? `\n  <link rel="alternate" hreflang="x-default" href="${SITE}/${alts.find((a) => a.lang === 'en').path}">` : '');
  const switcher = LANGS.map((l) => {
    const a = alts.find((x) => x.lang === l);
    if (!a) return '';
    return l === lang
      ? `<span aria-current="true" lang="${HTML_LANG[l]}">${l.toUpperCase()}</span>`
      : `<a href="${up}${a.path}" hreflang="${HTML_LANG[l]}" lang="${HTML_LANG[l]}" data-lang-link="${l}">${l.toUpperCase()}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escText(title)}</title>
  <meta name="description" content="${escAttr(desc)}">
  <link rel="canonical" href="${canonical}">
${hreflang}
  <meta name="theme-color" content="#FFFFFF">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="KEYCON">
  <meta property="og:locale" content="${OG_LOCALE[lang]}">
  <meta property="og:title" content="${escAttr(title)}">
  <meta property="og:description" content="${escAttr(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE}/img/og-keycon.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="${up}img/favicon.png">
  <link rel="apple-touch-icon" href="${up}img/apple-touch-icon.png">
  <link rel="alternate" type="application/rss+xml" title="${escAttr(u.eyebrow)}" href="${SITE}/${blogBase(lang)}feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${up}blog/blog.css?v=${ASSET_V}">
  <script type="application/ld+json">
${jsonLd(ld)}
  </script>
</head>
<body>
  <a class="skip" href="#conteudo">${u.skip}</a>
  <header class="bh">
    <div class="bh-row">
      <a class="bh-brand" href="${home}"><img src="${up}media-kit/img/logo-transp-without-slogan-dark.png" alt="KEYCON" width="132" height="28"></a>
      <nav class="bh-nav" aria-label="Blog">
        <a href="${up}${blogBase(lang)}">Blog</a>
        <a href="${home}">${u.app}</a>
        <span class="bh-lang" role="group" aria-label="${u.langLabel}">${switcher}</span>
        <a class="bh-cta" href="${home}#baixar">${u.cta}</a>
      </nav>
    </div>
  </header>
  <main id="conteudo">
${main}
  </main>
  <footer class="bf">
    <div class="bf-row">
      <a href="${home}"><img src="${up}media-kit/img/logo-transp-without-slogan-dark.png" alt="KEYCON" width="110" height="23"></a>
      <nav aria-label="Footer">
        <a href="${home}">${u.home}</a>
        <a href="${up}${blogBase(lang)}">Blog</a>
        <a href="${up}media-kit/">Media Kit</a>
        <a href="${up}privacidade.html${lang === 'en' ? '' : '?lang=' + lang}">${u.privacy}</a>
        <a href="${up}termos.html${lang === 'en' ? '' : '?lang=' + lang}">${u.terms}</a>
      </nav>
      <p>© 2026 KEYCON. ${u.note}</p>
    </div>
  </footer>
  <script>
    // Quem troca o idioma aqui leva a escolha para o resto do site
    document.querySelectorAll('[data-lang-link]').forEach(function (a) {
      a.addEventListener('click', function () { try { localStorage.setItem('keycon.lang', a.getAttribute('data-lang-link')); } catch (e) {} });
    });
  </script>
</body>
</html>
`;
}

const card = (p, up) => `<li class="card">
          <a href="${up}${p.path}">
            <span class="card-cat">${escText(p.category)}</span>
            <h2 class="card-title">${escText(p.title)}</h2>
            <p class="card-desc">${escText(p.description)}</p>
            <span class="card-meta"><time datetime="${p.date}">${fmtDate(p.date, p.lang)}</time> · ${p.minutes} ${UI[p.lang].min}</span>
          </a>
        </li>`;

for (const lang of LANGS) fs.rmSync(path.join(blogDir(lang)), { recursive: true, force: true });
fs.mkdirSync(blogDir('en'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'content', 'blog-assets', 'blog.css'), path.join(blogDir('en'), 'blog.css'));

for (const lang of LANGS) {
  const u = UI[lang];
  for (const p of posts[lang]) {
    const depth = p.path.split('/').filter(Boolean).length;
    const up = '../'.repeat(depth);
    const home = up + (lang === 'en' ? '' : lang + '/');
    const url = `${SITE}/${p.path}`;
    const body = p.body
      .replace(/\{\{post:([a-z0-9-]+)\}\}/g, (_, id) => {
        const t = byId(lang, id) || byId('en', id);
        if (!t) throw new Error(`${lang}/${p.id}: {{post:${id}}} não existe`);
        return up + t.path;
      })
      .replace(/\{\{home\}\}/g, home)
      .replace(/\{\{shots\}\}/g, `${up}img/${lang}/`)
      .replace(/\{\{up\}\}/g, up);
    const related = posts[lang].filter((x) => x.id !== p.id).slice(0, 2);
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BlogPosting',
          '@id': `${url}#article`,
          headline: p.title,
          description: p.description,
          datePublished: p.date,
          dateModified: p.updated,
          inLanguage: HTML_LANG[lang],
          mainEntityOfPage: url,
          image: `${SITE}/img/og-keycon.png`,
          author: ORG_REF,
          publisher: ORG_REF,
          articleSection: p.category,
          wordCount: p.words,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'KEYCON', item: `${SITE}/${lang === 'en' ? '' : lang + '/'}` },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/${blogBase(lang)}` },
            { '@type': 'ListItem', position: 3, name: p.title, item: url },
          ],
        },
      ],
    };
    const main = `    <article class="post">
      <header class="post-head">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${home}">KEYCON</a><span aria-hidden="true">/</span><a href="${up}${blogBase(lang)}">Blog</a><span aria-hidden="true">/</span><span>${escText(p.category)}</span></nav>
        <h1>${escText(p.title)}</h1>
        <p class="lead">${escText(p.lead)}</p>
        <p class="post-meta">${u.by} · <time datetime="${p.date}">${fmtDate(p.date, lang)}</time> · ${p.minutes} ${u.min}</p>
      </header>
      ${toc(body, lang)}
      <div class="prose">
${body.split('\n').map((l) => '        ' + l).join('\n')}
      </div>
      <aside class="cta-box">
        <img src="${up}img/icone-keycon.png" width="56" height="56" alt="">
        <div>
          <p class="cta-title">${u.ctaTitle}</p>
          <p>${u.ctaText}</p>
          <a class="btn" href="${home}#baixar">${u.cta}</a>
        </div>
      </aside>
    </article>
    <section class="more" aria-labelledby="more-title">
      <h2 id="more-title">${u.more}</h2>
      <ul class="cards">
        ${related.map((r) => card(r, up)).join('\n        ')}
      </ul>
    </section>`;
    write(path.join(LANDING, p.path, 'index.html'), layout({
      lang, title: `${p.title} · ${u.eyebrow}`, desc: p.description, pathRel: p.path,
      alts: versions(p.id).map((v) => ({ lang: v.lang, path: v.path })), ogType: 'article', ld, main,
    }));
  }

  // Índice do blog no idioma
  const pathRel = blogBase(lang);
  const up = '../'.repeat(pathRel.split('/').filter(Boolean).length);
  const url = `${SITE}/${pathRel}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${url}#blog`,
    name: u.eyebrow,
    url,
    inLanguage: HTML_LANG[lang],
    publisher: ORG_REF,
    blogPost: posts[lang].map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/${p.path}`, datePublished: p.date })),
  };
  const main = `    <section class="blog-head">
      <p class="eyebrow">${u.eyebrow}</p>
      <h1>${u.h1}</h1>
      <p class="lead">${u.lead}</p>
    </section>
    <section class="blog-list" aria-label="${u.articles}">
      <ul class="cards">
        ${posts[lang].map((p) => card(p, up)).join('\n        ')}
      </ul>
    </section>`;
  write(path.join(LANDING, pathRel, 'index.html'), layout({
    lang, title: u.indexTitle, desc: u.indexDesc, pathRel,
    alts: LANGS.filter((l) => posts[l].length).map((l) => ({ lang: l, path: blogBase(l) })), ogType: 'website', ld, main,
  }));

  // RSS do idioma
  write(path.join(LANDING, pathRel, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escText(u.eyebrow)}</title>
  <link>${url}</link>
  <atom:link href="${url}feed.xml" rel="self" type="application/rss+xml"/>
  <description>${escText(u.feed)}</description>
  <language>${HTML_LANG[lang]}</language>
${posts[lang].map((p) => `  <item>
    <title>${escText(p.title)}</title>
    <link>${SITE}/${p.path}</link>
    <guid>${SITE}/${p.path}</guid>
    <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
    <description>${escText(p.description)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);
  console.log(`landing/${pathRel} (${posts[lang].length} artigos)`);
}

// ── 4. Sitemap ─────────────────────────────────────────────────────────────
const altLinks = (alts) => alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[a.lang]}" href="${SITE}/${a.path}"/>`).join('\n') +
  (alts.some((a) => a.lang === 'en') ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/${alts.find((a) => a.lang === 'en').path}"/>` : '');
const homeAlts = LANGS.map((l) => ({ lang: l, path: l === 'en' ? '' : l + '/' }));
const blogAlts = LANGS.filter((l) => posts[l].length).map((l) => ({ lang: l, path: blogBase(l) }));
const urls = [
  ...homeAlts.map((a) => ({ loc: `${SITE}/${a.path}`, lastmod: SITE_UPDATED, extra: altLinks(homeAlts) })),
  ...blogAlts.map((a) => ({ loc: `${SITE}/${a.path}`, lastmod: posts[a.lang][0]?.updated || SITE_UPDATED, extra: altLinks(blogAlts) })),
  ...LANGS.flatMap((l) => posts[l].map((p) => ({ loc: `${SITE}/${p.path}`, lastmod: p.updated, extra: altLinks(versions(p.id).map((v) => ({ lang: v.lang, path: v.path }))) }))),
  { loc: `${SITE}/media-kit/`, lastmod: SITE_UPDATED },
  { loc: `${SITE}/privacidade.html`, lastmod: SITE_UPDATED },
  { loc: `${SITE}/termos.html`, lastmod: SITE_UPDATED },
  { loc: `${SITE}/excluir-conta.html`, lastmod: SITE_UPDATED },
];
write(path.join(LANDING, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>${u.extra ? '\n' + u.extra : ''}
  </url>`).join('\n')}
</urlset>
`);
console.log(`landing/sitemap.xml (${urls.length} endereços)`);
