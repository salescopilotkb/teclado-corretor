<?php
/**
 * KEYCON — porteiro do keyconapp.com/app (área só do administrador).
 *
 * Toda requisição ao /app passa por aqui (app/.htaccess). Sem login válido, NENHUM
 * arquivo do app é entregue: só a página de login. Com login, o arquivo pedido é
 * servido daqui (com o tipo certo), sem nunca sair da pasta do app.
 *
 * Segurança:
 *  - senha guardada só como hash (password_hash, Argon2id ou bcrypt), FORA do site:
 *    /home/<usuário>/keycon-admin/password.php (o navegador nunca alcança);
 *  - criar a senha pela primeira vez exige o "código de instalação", que só existe
 *    num arquivo fora do site (cPanel → Gerenciador de arquivos → keycon-admin);
 *  - tentativas erradas: 5 por IP em 15 min bloqueiam esse IP por 15 min, e 30 no
 *    total em 1 h bloqueiam o login de todos por 1 h (contra robôs com muitos IPs);
 *  - formulário com código anti-falsificação (CSRF), comparação em tempo constante e
 *    espera de 1 s a cada erro;
 *  - sessão com cookie Secure, HttpOnly e SameSite=Strict, id novo a cada login,
 *    expira com 2 h parado ou 12 h no total; botão Sair;
 *  - páginas fora dos buscadores, sem cache e sem poder abrir dentro de outro site.
 *
 * Trocar a senha: apague keycon-admin/password.php no cPanel e abra /app de novo
 * (pede o novo código de instalação, que aparece em keycon-admin/setup-code.txt).
 */

declare(strict_types=1);

// ── Onde ficam a senha e os registros ───────────────────────────────────────
// 1º: fora do public_html (/home/<usuário>/keycon-admin). Se a hospedagem não deixar o
// PHP gravar lá, 2º: public_html/app/.keycon-admin, fechada para o navegador (o
// app/.htaccess manda tudo para cá, e este porteiro nunca entrega arquivos com ponto).
$docRoot = rtrim(str_replace('\\', '/', (string)($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__))), '/');
$appDir = __DIR__;
$adminDir = dirname($docRoot) . '/keycon-admin';
$adminWhere = 'keycon-admin (na pasta principal, ao lado do public_html)';
if (!is_dir($adminDir)) {
    @mkdir($adminDir, 0700, true);
}
if (!is_dir($adminDir) || !is_writable($adminDir)) {
    $adminDir = $appDir . '/.keycon-admin';
    $adminWhere = 'public_html/app/.keycon-admin (ative "Mostrar arquivos ocultos" no Gerenciador de arquivos)';
    if (!is_dir($adminDir)) {
        @mkdir($adminDir, 0700, true);
    }
    // Trava extra: mesmo sem o porteiro, o servidor não entrega nada desta pasta
    if (is_dir($adminDir) && !is_file($adminDir . '/.htaccess')) {
        @file_put_contents($adminDir . '/.htaccess', "Require all denied\n");
    }
}
$passwordFile = $adminDir . '/password.php';
$setupFile = $adminDir . '/setup-code.txt';
$attemptsFile = $adminDir . '/attempts.json';

const IDLE_SECONDS = 7200;       // 2 h parado
const MAX_SESSION_SECONDS = 43200; // 12 h no total
const IP_MAX_FAILS = 5;
const IP_WINDOW = 900;           // 15 min
const GLOBAL_MAX_FAILS = 30;
const GLOBAL_WINDOW = 3600;      // 1 h
const MIN_PASSWORD = 14;

// ── Cabeçalhos de toda resposta ─────────────────────────────────────────────
header('X-Robots-Tag: noindex, nofollow, noarchive, nosnippet');
header('Cache-Control: no-store, private');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// ── Sessão ──────────────────────────────────────────────────────────────────
session_name('keycon_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/app',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_start();

function client_ip(): string
{
    // Atrás da Cloudflare, o IP real vem neste cabeçalho
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr((string)preg_replace('/[^0-9a-fA-F:.]/', '', (string)$ip), 0, 45);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_ok(): bool
{
    return isset($_POST['csrf'], $_SESSION['csrf']) && hash_equals($_SESSION['csrf'], (string)$_POST['csrf']);
}

function logged_in(): bool
{
    if (empty($_SESSION['admin']) || empty($_SESSION['since']) || empty($_SESSION['seen'])) {
        return false;
    }
    $now = time();
    if ($now - (int)$_SESSION['seen'] > IDLE_SECONDS || $now - (int)$_SESSION['since'] > MAX_SESSION_SECONDS) {
        $_SESSION = [];
        session_regenerate_id(true);
        return false;
    }
    $_SESSION['seen'] = $now;
    return true;
}

/** Lê e grava as tentativas com trava de arquivo (duas requisições ao mesmo tempo). */
function with_attempts(string $file, callable $fn)
{
    $h = @fopen($file, 'c+');
    if (!$h) {
        // Sem como gravar (pasta keycon-admin sem permissão): confere sem guardar
        $r = $fn(['ip' => [], 'all' => []]);
        return $r[0] ?? null;
    }
    flock($h, LOCK_EX);
    $raw = stream_get_contents($h);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        $data = ['ip' => [], 'all' => []];
    }
    $now = time();
    // Esquece o que já passou da janela
    foreach ($data['ip'] as $ip => $list) {
        $data['ip'][$ip] = array_values(array_filter($list, fn($t) => $now - $t < IP_WINDOW));
        if (!$data['ip'][$ip]) {
            unset($data['ip'][$ip]);
        }
    }
    $data['all'] = array_values(array_filter($data['all'] ?? [], fn($t) => $now - $t < GLOBAL_WINDOW));
    $result = $fn($data);
    $next = $result[1] ?? $data;
    ftruncate($h, 0);
    rewind($h);
    fwrite($h, json_encode($next));
    fflush($h);
    flock($h, LOCK_UN);
    fclose($h);
    return $result[0] ?? null;
}

/** null = pode tentar; senão, os minutos até poder tentar de novo. */
function locked_minutes(string $file, string $ip): ?int
{
    return with_attempts($file, function (array $d) use ($ip) {
        $now = time();
        $mine = $d['ip'][$ip] ?? [];
        if (count($mine) >= IP_MAX_FAILS) {
            return [(int)ceil((IP_WINDOW - ($now - min($mine))) / 60), $d];
        }
        if (count($d['all']) >= GLOBAL_MAX_FAILS) {
            return [(int)ceil((GLOBAL_WINDOW - ($now - min($d['all']))) / 60), $d];
        }
        return [null, $d];
    });
}

function record_failure(string $file, string $ip): void
{
    with_attempts($file, function (array $d) use ($ip) {
        $d['ip'][$ip][] = time();
        $d['all'][] = time();
        return [null, $d];
    });
}

function clear_failures(string $file, string $ip): void
{
    with_attempts($file, function (array $d) use ($ip) {
        unset($d['ip'][$ip]);
        return [null, $d];
    });
}

function load_credentials(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $c = include $file;
    return is_array($c) && isset($c['user'], $c['hash']) ? $c : null;
}

function hash_password(string $password): string
{
    return defined('PASSWORD_ARGON2ID') ? password_hash($password, PASSWORD_ARGON2ID) : password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
}

// ── Página (login, instalação ou aviso) ─────────────────────────────────────
function page(string $title, string $body): void
{
    $nonce = base64_encode(random_bytes(16));
    header("Content-Security-Policy: default-src 'none'; style-src 'nonce-$nonce'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    header('Content-Type: text/html; charset=utf-8');
    $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    echo <<<HTML
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>$t · KEYCON</title>
<style nonce="$nonce">
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body { display: grid; place-items: center; padding: 24px; background: #14161D;
    background-image: radial-gradient(70% 55% at 50% -5%, rgba(124,147,230,.22), transparent 65%), radial-gradient(55% 45% at 88% 78%, rgba(241,120,96,.22), transparent 70%);
    color: #F5F6F8; font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .card { width: 100%; max-width: 400px; background: #1E2129; border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 32px 28px; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; font-weight: 700; font-size: 18px; }
  .brand img { width: 34px; height: 34px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  p { margin: 0 0 18px; color: #A3A9B6; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 6px; color: #D5D9E1; }
  input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); background: #2F3441; color: #F5F6F8; font: inherit; }
  input:focus { outline: 2px solid #F17860; outline-offset: 1px; }
  button { width: 100%; margin-top: 22px; padding: 13px; border: 0; border-radius: 999px; font: inherit; font-weight: 700; color: #fff; cursor: pointer;
    background: linear-gradient(135deg, #f58a6f 0%, #f17860 45%, #e2654d 100%); }
  .error { background: rgba(239,68,68,.16); color: #FCA5A5; padding: 10px 12px; border-radius: 10px; font-size: 14px; margin: 0 0 6px; }
  .note { font-size: 12px; color: #8C93A1; margin-top: 18px; }
  code { background: #2F3441; padding: 1px 6px; border-radius: 6px; }
</style>
</head>
<body>
<main class="card">
  <div class="brand"><img src="/img/k-mark.png" alt=""><span>KEYCON · Admin</span></div>
  $body
</main>
</body>
</html>
HTML;
    exit;
}

function esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

$ip = client_ip();
$path = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/app/'), PHP_URL_PATH);
$action = (string)($_POST['action'] ?? '');
$credentials = load_credentials($passwordFile);

// ── Sair ────────────────────────────────────────────────────────────────────
if ($action === 'logout' && csrf_ok()) {
    $_SESSION = [];
    session_regenerate_id(true);
    header('Location: /app/', true, 303);
    exit;
}

// ── Primeira vez: criar o usuário e a senha (com o código de instalação) ──────
if ($credentials === null) {
    if (!is_file($setupFile)) {
        @file_put_contents($setupFile, strtoupper(bin2hex(random_bytes(6))) . PHP_EOL);
        @chmod($setupFile, 0600);
    }
    $error = '';
    if ($action === 'setup') {
        $code = strtoupper(trim((string)($_POST['code'] ?? '')));
        $user = trim((string)($_POST['user'] ?? ''));
        $pass = (string)($_POST['password'] ?? '');
        $pass2 = (string)($_POST['password2'] ?? '');
        $locked = locked_minutes($attemptsFile, $ip);
        $expected = strtoupper(trim((string)@file_get_contents($setupFile)));
        if ($locked !== null) {
            $error = "Muitas tentativas. Tente de novo em $locked min.";
        } elseif (!csrf_ok()) {
            $error = 'A página expirou. Tente de novo.';
        } elseif ($expected === '' || !hash_equals($expected, $code)) {
            record_failure($attemptsFile, $ip);
            sleep(1);
            $error = 'Código de instalação errado.';
        } elseif (!preg_match('/^[A-Za-z0-9._@-]{3,60}$/', $user)) {
            $error = 'Usuário: de 3 a 60 letras, números ou . _ @ -';
        } elseif (strlen($pass) < MIN_PASSWORD) {
            $error = 'A senha precisa ter pelo menos ' . MIN_PASSWORD . ' caracteres.';
        } elseif ($pass !== $pass2) {
            $error = 'As duas senhas não são iguais.';
        } else {
            $content = "<?php\n// KEYCON admin: usuário e hash da senha (a senha em si não fica guardada)\nreturn " .
                var_export(['user' => $user, 'hash' => hash_password($pass), 'created' => gmdate('c')], true) . ";\n";
            if (@file_put_contents($passwordFile, $content, LOCK_EX) === false) {
                $error = 'Não foi possível gravar a senha no servidor (pasta keycon-admin).';
            } else {
                @chmod($passwordFile, 0600);
                @unlink($setupFile);
                session_regenerate_id(true);
                $_SESSION = ['admin' => $user, 'since' => time(), 'seen' => time()];
                header('Location: /app/', true, 303);
                exit;
            }
        }
    }
    // O servidor não deixou gravar o código em lugar nenhum: sem como criar o acesso
    if (!is_file($setupFile)) {
        $error = $error ?: 'O servidor não deixou criar o arquivo do código de instalação. Fale com o suporte do KEYCON.';
    }
    $err = $error ? '<p class="error">' . esc($error) . '</p>' : '';
    $csrf = esc(csrf_token());
    $where = esc($adminWhere);
    page('Criar acesso', <<<HTML
  <h1>Criar o acesso do administrador</h1>
  <p>Primeira vez aqui. Abra o <strong>cPanel → Gerenciador de arquivos</strong>, vá até a pasta <code>$where</code> e copie o código do arquivo <code>setup-code.txt</code>.</p>
  $err
  <form method="post" autocomplete="off">
    <input type="hidden" name="action" value="setup">
    <input type="hidden" name="csrf" value="$csrf">
    <label for="code">Código de instalação</label>
    <input id="code" name="code" required autocomplete="off" spellcheck="false">
    <label for="user">Usuário</label>
    <input id="user" name="user" required autocomplete="username">
    <label for="password">Senha (14 caracteres ou mais)</label>
    <input id="password" name="password" type="password" required minlength="14" autocomplete="new-password">
    <label for="password2">Repita a senha</label>
    <input id="password2" name="password2" type="password" required minlength="14" autocomplete="new-password">
    <button>Criar acesso</button>
  </form>
  <p class="note">A senha fica guardada só como código (hash), fora do site.</p>
HTML);
}

// ── Login ───────────────────────────────────────────────────────────────────
if (!logged_in()) {
    $error = '';
    if ($action === 'login') {
        $locked = locked_minutes($attemptsFile, $ip);
        if ($locked !== null) {
            $error = "Muitas tentativas. Tente de novo em $locked min.";
        } elseif (!csrf_ok()) {
            $error = 'A página expirou. Tente de novo.';
        } else {
            $user = trim((string)($_POST['user'] ?? ''));
            $pass = (string)($_POST['password'] ?? '');
            $okUser = hash_equals((string)$credentials['user'], $user);
            $okPass = password_verify($pass, (string)$credentials['hash']);
            if ($okUser && $okPass) {
                clear_failures($attemptsFile, $ip);
                session_regenerate_id(true);
                $_SESSION = ['admin' => $user, 'since' => time(), 'seen' => time()];
                // Hash antigo (bcrypt) vira o mais forte disponível
                if (password_needs_rehash((string)$credentials['hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT)) {
                    $credentials['hash'] = hash_password($pass);
                    @file_put_contents($passwordFile, "<?php\nreturn " . var_export($credentials, true) . ";\n", LOCK_EX);
                }
                header('Location: ' . ($path ?: '/app/'), true, 303);
                exit;
            }
            record_failure($attemptsFile, $ip);
            sleep(1);
            $error = 'Usuário ou senha incorretos.';
        }
    }
    http_response_code($action === 'login' ? 401 : 200);
    $err = $error ? '<p class="error">' . esc($error) . '</p>' : '';
    $csrf = esc(csrf_token());
    page('Entrar', <<<HTML
  <h1>Área do administrador</h1>
  <p>Entre para abrir o app KEYCON de teste.</p>
  $err
  <form method="post">
    <input type="hidden" name="action" value="login">
    <input type="hidden" name="csrf" value="$csrf">
    <label for="user">Usuário</label>
    <input id="user" name="user" required autocomplete="username" autofocus>
    <label for="password">Senha</label>
    <input id="password" name="password" type="password" required autocomplete="current-password">
    <button>Entrar</button>
  </form>
  <p class="note">Acesso restrito. Tentativas erradas bloqueiam o acesso por um tempo.</p>
HTML);
}

// ── Logado: entrega o arquivo pedido, só de dentro da pasta do app ─────────────
$rel = ltrim((string)preg_replace('#^/app/?#', '', $path), '/');
if ($rel === '' || substr($rel, -1) === '/') {
    $rel .= 'index.html';
}
$file = realpath($appDir . '/' . $rel);
$base = realpath($appDir);
$blocked = ['gate.php', '.htaccess'];
// Nada de arquivos ou pastas com ponto no começo (como a .keycon-admin, com a senha)
$hidden = (bool)preg_match('#(^|/)\.#', $rel);
if ($hidden || $file === false || $base === false || strpos($file, $base . DIRECTORY_SEPARATOR) !== 0 || !is_file($file) || in_array(basename($file), $blocked, true)) {
    // Caminho do app de uma página só (sem arquivo): abre o index.html
    $file = $appDir . '/index.html';
}

$types = [
    'html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'mjs' => 'text/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8', 'json' => 'application/json', 'webmanifest' => 'application/manifest+json',
    'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
    'svg' => 'image/svg+xml', 'ico' => 'image/x-icon', 'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf',
    'mp3' => 'audio/mpeg', 'mp4' => 'video/mp4', 'wasm' => 'application/wasm', 'txt' => 'text/plain; charset=utf-8', 'map' => 'application/json',
];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($file));

// Na página principal, um botão discreto de Sair (o app em si não muda)
if ($ext === 'html') {
    $html = (string)file_get_contents($file);
    $csrf = esc(csrf_token());
    $logout = '<form method="post" action="/app/" style="position:fixed;left:10px;top:10px;z-index:2147483647;margin:0">'
        . '<input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="' . $csrf . '">'
        . '<button style="font:600 12px system-ui,sans-serif;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(20,22,29,.85);color:#fff;cursor:pointer">Sair do admin</button></form>';
    $html = str_ireplace('</body>', $logout . '</body>', $html);
    header('Content-Length: ' . strlen($html));
    echo $html;
    exit;
}
readfile($file);
