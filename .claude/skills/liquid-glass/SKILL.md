---
name: liquid-glass
description: Coloca o efeito "liquid glass" (vidro curvo que refrata, magnifica e brilha) em telas do KEYCON. Use quando o usuário pedir liquid glass, vidro líquido, efeito de vidro, glassmorphism ou "deixar com cara de iOS 26" em qualquer parte do site, do Locker web ou do app. Decide a técnica certa para cada superfície (web component zerowing na web; vidro do app no React Native) e aplica com os parâmetros certos.
---

# Liquid glass no KEYCON

Fonte: componente `<liquid-glass>` de zerowing (https://zerowing.in/glass/,
https://github.com/MuhammadaliMS/liquid-glass), licença MIT, versão estável **v1.1.1**.
É um web component em WebGL que faz ray-tracing de cada elemento marcado com `glass` como uma
placa de vidro grossa e curva sobre o fundo da própria cena.

## 1. Primeiro: qual superfície?

| Onde o usuário pediu | Pasta | Técnica |
|---|---|---|
| Site (landing, blog, media kit) | `landing/` (HTML puro) | `<liquid-glass>` por `<script type="module">` |
| Locker no computador | `locker/` (React + Vite) | `<liquid-glass>` pelo pacote npm |
| App (Android/iPhone e `/app` na web) | `src/app/` | **`GlassScene` + `GlassPane`** (`src/app/glass/`). No celular: o shader do componente portado para SkSL (Skia, `liquidGlassSksl.ts`), uma peça por canvas, fundo = aurora calculada no próprio shader. Na web: o `<liquid-glass>` original (arquivos `.web.tsx`), com a mesma aurora lisa passada como imagem. Peça em movimento: passe `windowBox` a cada quadro (ver `LiquidTabBar.tsx`). Sem Skia ou fora da paleta de vidro, cai no vidro desenhado (`LiquidSheen`). |
| Teclado | `src/keyboard/` | **Não usar** (o teclado não carrega o Skia): vidro desenhado, `glassBorder(colors)` + `LiquidSheen`. |

Regras do app: a tela precisa estar dentro de uma `GlassScene` (hoje só a principal, em `App.tsx`); no máximo 16 `GlassPane` visíveis por cena (limite da web) — telas com muitos ícones usam `AppIcon plain`; o fundo é liso (sem linhas de contorno, pedido do usuário em 2026-11-28) e parado.

## 2. Instalar

**Site (HTML puro)** — no fim do `<body>`, versão fixa (nunca `@1` solto em produção):

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/MuhammadaliMS/liquid-glass@v1.1.1/dist/liquid-glass.js"></script>
```

**Locker (React)**:

```bash
npm install github:MuhammadaliMS/liquid-glass#v1.1.1
```

```ts
import '@zerowing/liquid-glass'; // uma vez, no main.tsx do Locker
```

TypeScript não conhece a tag no JSX. Declare uma vez (ex.: `locker/src/liquid-glass.d.ts`):

```ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
type GlassScene = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  backdrop?: string; dim?: string | number; colors?: string;
  'inner-light'?: boolean | ''; 'reduce-motion'?: boolean | '';
};
declare module 'react' {
  namespace JSX { interface IntrinsicElements { 'liquid-glass': GlassScene } }
}
declare module 'react' { interface HTMLAttributes<T> { glass?: '' | boolean; 'glass-drag'?: '' | boolean } }
```

No JSX, atributos booleanos vão como string vazia: `<button glass="">`.

## 3. Como usar (3 passos)

```html
<liquid-glass backdrop="hero.jpg" dim=".25" style="height: 100vh">
  <nav glass class="navbar">…</nav>
  <h1>Your headline</h1>
  <a glass href="/signup" class="button">Get started</a>
</liquid-glass>
```

1. Envolva a seção em `<liquid-glass>` e dê um `backdrop`.
2. Ponha `glass` em cada elemento que deve virar vidro.
3. Estilize como sempre (padding, tamanho, `border-radius`), com **fundo transparente**. O vidro
   segue tamanho, posição e raio do elemento a cada quadro (transições e hover funcionam).

## 4. Parâmetros

### Na cena `<liquid-glass>`

| Atributo | Valores | Efeito |
|---|---|---|
| `backdrop` | `aurora` (padrão, animada) ou URL de imagem/vídeo (`.mp4`, `.webm`) | O que o vidro refrata. Outro domínio precisa de CORS. |
| `dim` | `0` a `0.9` | Escurece o fundo (como um scrim) para o texto ficar legível. |
| `colors` | até 4 cores CSS | Cores da aurora. Para o KEYCON: as da marca. |
| `inner-light` | booleano | O vidro brilha sozinho em seis cores. |
| `reduce-motion` | booleano | Congela tudo. Já segue a preferência do sistema. |

### Em cada elemento `glass`

| Atributo | Efeito |
|---|---|
| `glass` | Vira vidro. Máximo 16 por cena; os de baixo no HTML ficam por cima. |
| `glass-drag` | O visitante arrasta; estica enquanto se move. |

| Propriedade CSS | Padrão | Faixa útil | Efeito |
|---|---|---|---|
| `--glass-tint` | nenhum | `rgba(r,g,b,.3–.6)` | Cor misturada; o alfa é a força. |
| `--glass-depth` | `1` | `0.6–2.5` | Espessura (2 = lente pesada). |
| `--glass-dome` | `1` | `0.5–2.5` | Quanto a face estufa; mais = mais zoom. |
| `--glass-ior` | `1.38` | `1.2–1.6` | Índice de refração (vidro 1.5, água 1.33). |
| `--glass-frost` | `0` | `0–1` | Fosco. Suba sobre fundos agitados com texto. |
| `--glass-pull` | pouco | `0–20` px | Borda estufa em direção ao ponteiro; `0` desliga. |
| `--glass-lens` | nenhum | `"x y raio"` px do centro | Disco elevado na face (botão sobre botão). |
| `--glass-glow` | `1` | `0–2` | Quanto o som ilumina por dentro. |
| `--glass-press` | `1.045` | `1–1.1` | Cresce ao pressionar; `1` desliga. |
| `--glass-shadow` | `1` | `0–1` | Sombra. |
| `--glass-chroma` | `0.008` | `0–0.03` | Separação de cor (arco-íris na borda). |

### JavaScript

```js
const scene = document.querySelector('liquid-glass');
scene.backdrop = '/winter.jpg';                      // troca o fundo
await scene.startMicrophone();                        // só a partir de um clique
scene.stopMicrophone();
const stop = scene.listen(audioNode);                 // qualquer nó Web Audio
scene.setAudio({ bands: [.8,.5,.3,.2,.1,.05], level: .6 }); // níveis próprios; null para
scene.addEventListener('microphone-change', e => console.log(e.detail.status));
```

Nunca ligue o microfone sem um clique do usuário e sem o usuário ter pedido o recurso.

## 5. Receitas

```css
/* Barra de navegação flutuante */
.navbar { padding: 12px 20px; border-radius: 999px; background: transparent; }

/* Botão principal com a cor da marca */
.cta { padding: 14px 28px; border-radius: 999px; background: transparent;
       --glass-tint: rgba(255, 90, 31, .5); color: #fff; }

/* Cartão legível sobre foto */
.card { padding: 20px; border-radius: 24px; background: transparent;
        --glass-frost: .35; --glass-shadow: .6; }

/* Barra de abas (mobile) */
.tabbar { position: fixed; bottom: 16px; left: 16px; right: 16px; height: 64px;
          border-radius: 32px; background: transparent; }

/* Lente arrastável (magnificador) */
.lens { width: 160px; height: 160px; border-radius: 50%;
        --glass-depth: 2.2; --glass-dome: 2; --glass-chroma: .015; }
```

```html
<div glass glass-drag class="lens"></div>
```

## 6. Regras e armadilhas

- **O vidro refrata o fundo da cena, não a página.** O WebGL não lê o resto do DOM. Use em
  heroes, cabeçalhos e seções com imagem/vídeo forte ou aurora. Para vidro sobre conteúdo
  qualquer da página, use CSS: `backdrop-filter: blur(20px) saturate(160%)` + borda clara
  translúcida + sombra suave (é o que o componente faz de fallback).
- Conteúdo dentro do vidro continua HTML real (acessível, clicável, selecionável).
- Texto sobre o vidro: contraste mínimo AA. Use `dim` na cena e/ou `--glass-frost`.
- Cena tem no mínimo 120px de altura; para menor, `min-height: 0` + `height`.
- Máximo 16 elementos `glass` por cena (menos em GPUs fracas). Prefira poucas cenas grandes.
- Sem WebGL, cai para CSS fosco sozinho. Pausa fora da tela e em abas em segundo plano.
- CSP: usa `adoptedStyleSheets`; não precisa de `'unsafe-inline'`.
- Imagens de fundo do próprio domínio (`landing/`), para não depender de CORS.
- Site: o banner de cookies (GTM, Meta, GA) não interfere; não carregue o script antes dele.
- Mobile: teste em 360px de largura; nada de rolagem horizontal.

## 7. Checklist ao aplicar

1. Confirme a superfície (tabela da seção 1).
2. Web: versão fixa v1.1.1; fundos transparentes; `border-radius` definido.
3. Ajuste `dim`/`--glass-frost` até o texto ficar legível.
4. Rode o site/Locker local e confira no navegador (desktop e 360px).
5. Locker: `npm run locker:typecheck`. Site: `npm run landing:site` se a página for gerada.
6. Em textos visíveis do site, mantenha os 3 idiomas (en, pt, es).
