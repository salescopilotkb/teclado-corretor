# Ligar o Locker: roteiro único (do zero)

Siga **de cima para baixo**, sem pular. Nada disto foi feito ainda: o roteiro parte do zero.
Tempo total: cerca de 1 hora. Detalhes técnicos de cada parte estão em `LOCKER-SETUP.md`.

**Você vai precisar de:**
- acesso ao painel do Supabase (projeto `ldobmaflbrqruqfalkvi`);
- uma conta na Cloudflare (pede cartão; os primeiros 10 GB por mês são grátis);
- acesso ao cPanel do HostGator;
- este projeto no computador, com o Node instalado (o mesmo que roda `npm run`);
- os dois pacotes gerados: `locker-public_html.zip` e `keyconapp-public_html.zip`
  (para gerar de novo: `powershell -ExecutionPolicy Bypass -File scripts/build_hostgator_zips.ps1`).

Anote num lugar seguro (gerenciador de senhas), conforme for criando:

| Anotação | Onde aparece |
| --- | --- |
| R2 Account ID | Passo 1.3 |
| R2 Access Key ID | Passo 1.4 |
| R2 Secret Access Key (só aparece uma vez) | Passo 1.4 |
| CRON_SECRET (você inventa: uma senha longa) | Passo 3 |

---

## 1. Cloudflare R2: onde os arquivos ficam (15 min)

1. Entre em [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → ative o R2.
2. **Create bucket** → nome `keycon-locker` → região automática. Deixe **sem** acesso público.
3. Na página do R2, copie o **Account ID** (à direita).
4. **Manage R2 API Tokens** → **Create API token**:
   - permissão **Object Read & Write**;
   - só para o bucket `keycon-locker`;
   - copie o **Access Key ID** e o **Secret Access Key**.
5. Abra o bucket `keycon-locker` → **Settings** → **CORS policy** → **Edit** → cole e salve:

```json
[
  {
    "AllowedOrigins": ["https://locker.keyconapp.com", "https://keyconapp.com", "http://localhost:5174"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 2. Supabase: as tabelas (5 min)

1. Supabase → **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `supabase/locker.sql` → **Run**. (Pode rodar de novo sem perder nada.)
3. Confira em **Table Editor**: `locker_folders`, `locker_files`, `locker_plans`, `locker_teams`,
   `locker_team_members` e `locker_shares`.

## 3. Supabase: chaves e funções (15 min)

No terminal, na pasta do projeto:

```bash
npx supabase login
npx supabase link --project-ref ldobmaflbrqruqfalkvi
```

Guarde as chaves (troque os `<...>`; o CRON_SECRET é uma senha longa que você inventa agora):

```bash
npx supabase secrets set R2_ACCOUNT_ID=<account id> R2_ACCESS_KEY_ID=<access key id> R2_SECRET_ACCESS_KEY=<secret> R2_BUCKET=keycon-locker LOCKER_URL=https://locker.keyconapp.com CRON_SECRET=<senha longa>
```

Publique as quatro funções:

```bash
npx supabase functions deploy locker
npx supabase functions deploy locker-handoff
npx supabase functions deploy locker-public --no-verify-jwt
npx supabase functions deploy locker-purge --no-verify-jwt
```

Confira em Supabase → **Edge Functions**: as quatro aparecem.

## 4. Supabase: lixeira que se esvazia sozinha (3 min)

1. Abra `supabase/locker-purge.sql` no editor e troque `<CRON_SECRET>` pela **mesma** senha do passo 3.
2. Cole no **SQL Editor** → **Run**.
3. Confira em **Database** → **Cron Jobs**: aparece `locker-purge-daily`.
4. **Não salve** o arquivo com a senha dentro (desfaça a troca no editor).

## 5. Supabase: entrada e "Esqueci a senha" (5 min)

1. **Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL**:
   `https://locker.keyconapp.com/**`
2. **Authentication** → **Email Templates** → **Reset Password**:
   - Assunto: `KEYCON: crie uma senha nova`
   - Corpo:

```html
<p>Recebemos um pedido para trocar a senha da sua conta KEYCON.</p>
<p><a href="{{ .ConfirmationURL }}">Criar senha nova</a></p>
<p>Se não foi você, ignore este e-mail. Sua senha continua a mesma.</p>
```

## 6. HostGator: o site do Locker (15 min)

1. cPanel → **Domínios** → **Criar um novo domínio** → `locker.keyconapp.com`.
   - Desmarque "compartilhar a raiz do documento".
   - A pasta sugerida (por exemplo, `locker.keyconapp.com`) está boa: anote qual é.
2. Se o DNS de `keyconapp.com` **não** for do HostGator (por exemplo, se estiver na Cloudflare),
   crie lá um registro **A** `locker` apontando para o mesmo IP de `keyconapp.com`.
3. cPanel → **SSL/TLS Status** → marque `locker.keyconapp.com` → **Run AutoSSL**.
   Espere o cadeado ficar verde (pode levar alguns minutos).
4. cPanel → **Gerenciador de Arquivos** → abra a pasta do passo 1 → **Carregar** →
   `locker-public_html.zip` → clique nele → **Extrair** (na própria pasta) → apague o zip.
   - Ative "Mostrar arquivos ocultos" (Configurações): deve aparecer o `.htaccess`.
5. Na mesma ocasião, suba o `keyconapp-public_html.zip` em `public_html` e extraia por cima
   (site e app de demonstração atualizados).

## 7. Conferir (20 min)

Use uma conta de teste e um celular com a versão nova do app.

**Locker web**
- [ ] `https://locker.keyconapp.com` abre com cadeado e mostra a página de entrada.
- [ ] Entra com a conta do app.
- [ ] "Esqueci a senha" manda o e-mail em português; o link abre "Crie uma senha nova"; a senha nova entra no app também.
- [ ] Envia uma foto, um PDF e uma pasta inteira (arrastando).
- [ ] No Supabase → `locker_files`: as linhas novas têm `storage = r2`. No R2 → bucket: os arquivos estão na pasta com o id do usuário.
- [ ] Prévia: foto, vídeo, áudio e PDF abrem; ← → passam de arquivo.
- [ ] Renomear, mover, estrela, lixeira e restaurar; "Trocar por nova versão".
- [ ] Baixar uma pasta (vem um .zip).

**App e teclado**
- [ ] O que foi enviado pela web aparece no app e no teclado sozinho, sem fechar o app.
- [ ] Botão "Abrir" na aba Locker do app abre o Locker web já logado.
- [ ] Enviar uma foto pelo teclado numa conversa: chega como **imagem**, não como link.
- [ ] "Organizar o teclado": a ordem mudada no app aparece na seção Teclado da web (e vice-versa).

**Links públicos** (abra numa janela anônima, sem login)
- [ ] Copie o link de um arquivo (`/f/...`): abre a página com a prévia e o botão Baixar.
- [ ] Pasta como "Qualquer pessoa com o link": `/d/...` mostra a pasta e as subpastas.
- [ ] Pasta "Privada": o link `/d/...` diz que não existe.

**Compartilhar** (precisa de uma segunda conta)
- [ ] Compartilhe uma pasta com o e-mail da segunda conta: ela vê em "Compartilhados comigo", abre e baixa, mas não muda nada.
- [ ] Crie uma equipe com a segunda conta e compartilhe com a equipe: funciona igual. Tire a pessoa da equipe: ela deixa de ver.

**Sem internet**
- [ ] No Locker web, marque um arquivo com "Disponibilizar sem internet"; desligue a internet; recarregue: a página abre e o arquivo também.

## 8. Antes de abrir para todos

- [ ] Política de privacidade, termos e página de exclusão no ar: vêm no `keyconapp-public_html.zip` (passo 6.5).
- [ ] Google Play › **Segurança dos dados** preenchida como em `GOOGLE-PLAY-SEGURANCA-DOS-DADOS.md`.
- [ ] Versão nova do app publicada nas lojas (o CI gera o AAB, o APK e o arquivo do iPhone a cada commit).

## Se algo der errado

| O que acontece | Onde olhar |
| --- | --- |
| Envio falha com "R2 ainda não foi ligado" | Passo 3: chaves (`npx supabase secrets list`) e `functions deploy locker` |
| Envio pelo navegador falha (erro de CORS no console) | Passo 1.5: regra de CORS do bucket |
| Botão "Abrir" do app cai na página de entrada | Passo 5.1 (Redirect URLs) e `functions deploy locker-handoff` |
| Link `/f/` ou `/d/` mostra a página de entrada | `.htaccess` não foi extraído (passo 6.4) |
| Link `/f/` diz que não existe | Função `locker-public` publicada com `--no-verify-jwt`? |
| "Compartilhados comigo" vazio | Rodou o `locker.sql` desta versão (passo 2)? Republicou a `locker`? |
| Lixeira não esvazia | Passo 4: o `CRON_SECRET` é o mesmo nas chaves e no SQL? |
