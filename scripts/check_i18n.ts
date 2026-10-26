/**
 * Confere as traduções (src/i18n/en.ts e es.ts):
 *  - toda chave usada em t(), tIn() e tSell() — lida pelo compilador do
 *    TypeScript, sem perder espaços nem aspas escapadas;
 *  - os textos dos ramos (src/segments), que getSegment traduz;
 *  - as listas fixas que a tela traduz depois (menus, campos dos formulários
 *    do teclado, tema) e as mensagens que chegam do Android em português;
 *  - se a tradução tem as mesmas {variáveis} da chave.
 *
 * Uso: npx tsx scripts/check_i18n.ts          (sai com erro se faltar algo)
 *      npx tsx scripts/check_i18n.ts --missing (só a lista do que falta, em JSON)
 */
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { pathToFileURL } from 'url';

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const load = (p: string) => import(pathToFileURL(p).href);

/** Constantes cujos textos a tela passa por t() (t(item.label), t(spec.label)...). */
const TRANSLATED_CONSTANTS = new Set(['NAV_ITEMS', 'BUTTONS', 'FILTERS', 'AGENDA_FIELDS', 'LEAD_FIELDS', 'NEW_TAG_FIELD', 'FOLDER_FIELDS', 'TEXT_FIELDS', 'LINK_FIELDS', 'AUDIO_FIELDS', 'THEME_LABEL', 'THEME_OPTIONS']);
const TRANSLATED_PROPS = new Set(['label', 'placeholder', 'desc']);

/**
 * Textos que chegam por fora do t() e são traduzidos na tela: erros do
 * Android (MediaPickActivity / KeyboardBridgeModule) e rótulos passados ao
 * formulário do teclado (FilesTab).
 */
const EXTRA_KEYS = [
  'Nenhum app de galeria ou câmera encontrado neste aparelho.',
  'Não foi possível abrir a galeria ou a câmera.',
  'Não foi possível abrir a galeria.',
  'Não foi possível ler o arquivo.',
  'Não foi possível ler o arquivo escolhido.',
  'Escolha uma foto ou um vídeo.',
  'O arquivo passa de 50 MB. Escolha um menor.',
  'O vídeo passa de 50 MB. Grave um mais curto.',
  'Escolha uma foto, um vídeo ou um áudio.',
  'O áudio passa de 50 MB.',
  'Não foi possível pedir a permissão do microfone.',
  'Nome do arquivo',
  'Nome da pasta',
  'Toque e digite',
  // Campos do produto no teclado (ProductsTab)
  'Nome do produto',
  'Preço',
  'Preço (opcional)',
  'Descrição',
  'Nome da nova categoria',
];

const used = new Map<string, string>(); // chave → onde aparece
const dynamic: string[] = [];
const add = (text: string | undefined, where: string) => {
  if (text && !used.has(text)) used.set(text, where);
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/^(en|es)\.ts$/.test(e.name) && !/^(words|bigrams)/.test(e.name)) out.push(p);
  }
  return out;
}

/** Textos literais de um argumento: 'a', `a`, cond ? 'a' : 'b'. */
function literals(node: ts.Expression): string[] | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return literals(node.expression);
  if (ts.isConditionalExpression(node)) {
    const a = literals(node.whenTrue);
    const b = literals(node.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

for (const file of walk(src)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const arg = node.arguments[name === 't' || name === 'tSell' ? 0 : name === 'tIn' ? 1 : -1];
      if (arg) {
        const texts = literals(arg);
        if (texts) texts.forEach(text => add(text, rel));
        else {
          const { line } = sf.getLineAndCharacterOfPosition(arg.getStart());
          dynamic.push(`${rel}:${line + 1}  ${name}(${arg.getText().slice(0, 60)})`);
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && TRANSLATED_CONSTANTS.has(node.name.text) && node.initializer) {
      const where = `${rel} (${node.name.text})`;
      const collect = (n: ts.Node) => {
        if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
          const prop = n.name.getText(sf);
          if (TRANSLATED_PROPS.has(prop) || node.name.getText(sf) === 'THEME_LABEL') add(n.initializer.text, where);
        }
        ts.forEachChild(n, collect);
      };
      collect(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
EXTRA_KEYS.forEach(k => add(k, 'scripts/check_i18n.ts (EXTRA_KEYS)'));

async function main() {
  const { SEGMENTS } = await load(path.join(src, 'segments', 'segments.ts'));
  for (const s of SEGMENTS) {
    const w = `ramo ${s.id}`;
    [s.label, s.description, s.terms.catalog, s.terms.item, s.terms.items, s.followUp].forEach(x => add(x, w));
    Object.values(s.examples as Record<string, string>).forEach(x => add(x, w));
    for (const f of s.fields) {
      add(f.label, w);
      add(f.placeholder, w);
      (f.options ?? []).forEach((o: string) => add(o, `${w} (opção)`));
    }
    add(s.price.label, w);
    add(s.price.placeholder, w);
    add(s.price.prefix, w);
    if (typeof s.price.suffix === 'string') add(s.price.suffix, w);
    s.crmStages.forEach((x: string) => add(x, `${w} (etapa)`));
  }

  const { EN } = await load(path.join(src, 'i18n', 'en.ts'));
  const { ES } = await load(path.join(src, 'i18n', 'es.ts'));
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

  if (process.argv.includes('--missing')) {
    const missing = [...used].filter(([k]) => !(k in EN) || !(k in ES)).map(([k, w]) => ({ key: k, where: w }));
    console.log(JSON.stringify(missing, null, 2));
    return;
  }

  let problems = 0;
  for (const [lang, dict] of [['EN', EN], ['ES', ES]] as const) {
    const missing = [...used].filter(([k]) => !(k in dict));
    const badVars = [...used.keys()].filter(k => k in dict && vars(k) !== vars(dict[k]));
    const unused = Object.keys(dict).filter(k => !used.has(k));
    problems += missing.length + badVars.length;
    console.log(`\n${lang}: ${used.size} textos, ${missing.length} sem tradução, ${badVars.length} com {variáveis} diferentes, ${unused.length} traduções sem uso`);
    missing.forEach(([k, w]) => console.log(`  FALTA  ${JSON.stringify(k)}   ← ${w}`));
    badVars.forEach(k => console.log(`  VARS   ${JSON.stringify(k)} → ${JSON.stringify(dict[k])}`));
  }
  console.log(`\nChamadas com texto dinâmico (confira se os textos de origem estão cobertos): ${dynamic.length}`);
  dynamic.forEach(d => console.log(`  ${d}`));
  if (problems) process.exitCode = 1;
}

main();
