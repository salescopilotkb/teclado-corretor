/**
 * Gera src/config/buildInfo.ts com a versão do app, calculada a cada commit:
 *   versão = <major>.<minor do package.json>.<número de commits>   (ex.: 1.0.58)
 * mais o código curto do commit e a data dele. A tela Conta › Sobre mostra.
 *
 * Roda sozinho no `npm install`/`npm ci` (postinstall), antes do build web e
 * na CI antes de gerar o AAB (a CI precisa do histórico completo: fetch-depth 0).
 * Com --github-env, também exporta KEYCON_VERSION_NAME e KEYCON_VERSION_CODE
 * para o Gradle (versionName / versionCode do AAB).
 *
 * O arquivo gerado não vai para o git (.gitignore).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const git = cmd => {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const [major = '1', minor = '0'] = String(pkg.version || '1.0.0').split('.');
const count = Number(git('rev-list --count HEAD')) || 0;
const commit = git('rev-parse --short HEAD') || 'dev';
const date = git('log -1 --format=%cI') || new Date().toISOString();

const info = {
  version: `${major}.${minor}.${count}`,
  buildNumber: count,
  commit,
  date,
};

const out = path.join(root, 'src', 'config', 'buildInfo.ts');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  `/** Gerado por scripts/write_build_info.js a cada build — não editar. */\n` +
    `export const BUILD_INFO = ${JSON.stringify(info, null, 2)} as const;\n`,
);

if (process.argv.includes('--github-env') && process.env.GITHUB_ENV) {
  // versionCode só pode crescer (senão o Android recusa a atualização): o maior
  // entre o número de commits e o número do build da CI
  const code = Math.max(1, count, Number(process.env.GITHUB_RUN_NUMBER) || 0);
  fs.appendFileSync(process.env.GITHUB_ENV, `KEYCON_VERSION_NAME=${info.version}\nKEYCON_VERSION_CODE=${code}\n`);
}
console.log(`KEYCON ${info.version} (${commit})`);
