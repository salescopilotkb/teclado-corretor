# Locker: como ligar a nuvem (Supabase + Cloudflare R2)

> **Para ligar tudo de uma vez, siga o roteiro único: [`LOCKER-DEPLOY.md`](LOCKER-DEPLOY.md).**
> Este arquivo é a referência técnica de cada parte (o que faz e por quê).

O código do Locker já está no app e no teclado. Enquanto estes passos não forem feitos,
tudo continua funcionando como antes (arquivos no bucket "media" do Supabase e a
organização só no aparelho). Depois deles, os arquivos novos vão para o R2, a
organização vai para a nuvem.

**Sem migração:** na fase de testes o Locker começa do zero. Cada aparelho apaga a própria
cópia dos arquivos de antes na primeira abertura da versão nova; para limpar a nuvem, rode
`supabase/locker-reset.sql` (instruções no próprio arquivo).

Ordem: 1 → 2 → 3 → 4. Os passos 5, 6 e 7 são para o Locker web (locker.keyconapp.com).

## 1. Tabelas no Supabase (5 min)

1. Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `supabase/locker.sql` → **Run**. Pode rodar de novo sem perder nada.
3. Confira em **Database → Tables**: `locker_folders`, `locker_files` e `locker_plans`.

A partir daqui, a organização dos Arquivos (pastas, nomes, o que vai para o teclado) já
sincroniza entre aparelhos, mesmo antes do R2.

## 2. Bucket no Cloudflare R2 (10 min)

1. Crie a conta em [dash.cloudflare.com](https://dash.cloudflare.com) e abra **R2 Object Storage**
   (pede cartão; os primeiros 10 GB por mês são grátis).
2. **Create bucket** → nome `keycon-locker` → região automática. Deixe **sem** acesso público.
3. Anote o **Account ID** (aparece na página do R2, à direita).
4. **Manage R2 API Tokens** → **Create API token** → permissão **Object Read & Write**, só para o
   bucket `keycon-locker` → anote o **Access Key ID** e o **Secret Access Key**
   (o segredo só aparece uma vez).

## 3. Chaves e função no Supabase (10 min)

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) instalada e logada no projeto:

```bash
supabase secrets set R2_ACCOUNT_ID=<account id> R2_ACCESS_KEY_ID=<access key> R2_SECRET_ACCESS_KEY=<secret> R2_BUCKET=keycon-locker
supabase functions deploy locker
```

As chaves do R2 ficam só nos segredos da função: nunca vão para o app.

## 4. Conferir

1. No app, entre na conta e envie uma foto em **Arquivos**.
2. No Supabase → **Table Editor** → `locker_files`: a linha nova tem `storage = r2`.
3. No R2 → bucket `keycon-locker`: o arquivo está numa pasta com o id do usuário.
4. No teclado, envie a foto numa conversa: ela chega como imagem.

## 5. CORS do bucket (só para o Locker web)

O navegador só envia direto para o R2 com esta regra. No bucket → **Settings** → **CORS policy**:

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

## 6. Abrir o Locker web já logado pelo app (5 min)

O botão **Abrir o Locker no navegador** (tela Locker do app) pede ao servidor um link de
entrada de **uso único** para a conta e abre no navegador: a pessoa chega logada, sem
digitar a senha. O link não serve de novo e vence sozinho. Sem estes passos, o botão abre a
página de login do Locker.

1. Supabase → **Authentication** → **URL Configuration** → **Redirect URLs** → adicione
   `https://locker.keyconapp.com/**`.
2. Publique a função:

```bash
supabase secrets set LOCKER_URL=https://locker.keyconapp.com
supabase functions deploy locker-handoff
```

A função usa a chave `service_role` (já existe nos segredos de toda Edge Function) só para
gerar o link; ela nunca vai para o app.

## 7. Links públicos e pastas compartilhadas (5 min)

- Todo arquivo tem um link permanente `locker.keyconapp.com/f/<código>` que abre **sem login**
  (é o que o app copia e o que o teclado manda quando o envio precisa ser por link).
- Cada pasta escolhe quem a vê: **Privada** (padrão), **Só com o link**
  (`locker.keyconapp.com/d/<código>`) ou **Pública** (como "só com o link", e também na
  vitrine do vendedor no Locker web).

1. Rode de novo o `supabase/locker.sql` (ele só acrescenta as colunas novas).
2. Publique a função pública, **sem exigir login**, e republique a `locker` (as duas usam
   `supabase/functions/_shared/r2.ts`):

```bash
supabase functions deploy locker-public --no-verify-jwt
supabase functions deploy locker
```

Os links `/f/` e `/d/` passam a abrir quando o site do Locker estiver no ar
(locker-public_html.zip, tarefa 12): a página chama a `locker-public`, que confere o código
do link e devolve só o que foi compartilhado.

## 8. Lixeira que se esvazia sozinha depois de 30 dias (5 min)

No Locker web, "Mover para a lixeira" guarda o item por 30 dias (dá para restaurar). Depois
disso, a função `locker-purge` apaga de vez, uma vez por dia: as linhas das tabelas e os
arquivos de verdade no R2 e no bucket "media".

1. Escolha uma senha longa qualquer (só para o agendador chamar a função) e publique:

```bash
supabase secrets set CRON_SECRET=<a senha>
supabase functions deploy locker-purge --no-verify-jwt
supabase functions deploy locker
```

   (A `locker` ganhou a ação de copiar arquivos, usada em "Fazer uma cópia".)

2. Abra `supabase/locker-purge.sql`, troque `<CRON_SECRET>` pela mesma senha → SQL Editor → **Run**.
   Ele liga as extensões `pg_cron` e `pg_net` e agenda a limpeza para todo dia às 4h17 (UTC).
3. Para conferir: **Database → Cron Jobs** mostra `locker-purge-daily`.

## 9. Compartilhar com pessoas e equipes (2 min)

No Locker web, **Compartilhar** dá acesso de **leitor** (ver, abrir e baixar) a um e-mail ou a
uma **equipe** (seção Equipes). Quem recebe acha em **Compartilhados comigo** ao entrar com
aquele e-mail. O app e o teclado continuam mostrando só o Locker da própria pessoa.

1. Rode de novo o `supabase/locker.sql` (cria `locker_teams`, `locker_team_members`,
   `locker_shares` e as regras de leitura do que foi compartilhado).
2. Republique a função `locker` (ela passou a assinar os links dos arquivos compartilhados
   com a pessoa):

```bash
supabase functions deploy locker
```

## 10. Entrada do Locker web e "Esqueci a senha" (5 min)

A página de entrada tem só **Entrar** e **Esqueci a senha** (a conta é criada no app). O link
de "Esqueci a senha" volta para `https://locker.keyconapp.com/?redefinir=1`, onde a pessoa
cria a senha nova (vale também no app).

1. O endereço de volta já está liberado pelo passo 6 (`https://locker.keyconapp.com/**`).
2. Supabase → **Authentication** → **Email Templates** → **Reset Password**: troque o texto
   padrão (em inglês) por um da KEYCON, por exemplo:
   - Assunto: `KEYCON: crie uma senha nova`
   - Corpo: `Recebemos um pedido para trocar a senha da sua conta KEYCON. <a href="{{ .ConfirmationURL }}">Criar senha nova</a>. Se não foi você, ignore este e-mail.`
3. O link vale 1 hora (Authentication → **Providers** → **Email** → *Email OTP expiration*). Se
   vencer, a página avisa e oferece mandar outro.

## Excluir a conta de alguém (pedido por e-mail)

A página `keyconapp.com/excluir-conta.html` promete apagar a conta **e o Locker** em até 30 dias.
Apagar o usuário no Supabase apaga as linhas do Locker (pastas, arquivos, compartilhamentos e
equipes), mas **não** os arquivos guardados no R2 e no bucket "media". Por isso, nesta ordem:

1. Supabase → **Authentication** → **Users** → procure o e-mail → copie o **User UID**.
2. Cloudflare → **R2** → bucket `keycon-locker` → abra a pasta com esse UID → selecione tudo → **Delete**.
3. Supabase → **Storage** → bucket `media` → pasta com esse UID → selecione tudo → **Delete**.
4. Supabase → **Authentication** → **Users** → o usuário → **Delete user**.
5. Responda o e-mail confirmando a exclusão.

Pedido de apagar **só o Locker** (sem a conta): faça os passos 2 e 3 e, no SQL Editor:

```sql
delete from public.locker_files where user_id = '<User UID>';
delete from public.locker_folders where user_id = '<User UID>';
```

## Planos de espaço e limites por arquivo

| Plano | Espaço | `plan` | `limit_bytes` |
| --- | --- | --- | --- |
| Basic | 5 GB | `basic` | 5368709120 |
| Plus | 20 GB | `plus` | 21474836480 |
| Pro | 100 GB | `pro` | 107374182400 |
| Enterprise | combinado com o suporte | `enterprise` | o valor combinado (ex.: 1 TB = 1099511627776) |

Limite de cada arquivo (no app e no servidor): **foto 16 MB, vídeo 64 MB, outros 10 MB**
(PDF, documentos, áudio). O medidor na tela Locker do app mostra quanto já foi usado.

- Sem nada configurado, cada pessoa tem **5 GB** (`basic`).
- Para mudar o plano de alguém (até existir a cobrança da assinatura), no SQL Editor:

```sql
insert into public.locker_plans (user_id, plan, limit_bytes)
values ('<id do usuário>', 'plus', 21474836480)
on conflict (user_id) do update set plan = excluded.plan, limit_bytes = excluded.limit_bytes, updated_at = now();
```

Depois de mudar o `locker.sql` (o Enterprise entrou agora), rode o arquivo de novo e
republique a função `locker`, que confere os limites por tipo:

```bash
supabase functions deploy locker
```

A pessoa só consegue **ler** o próprio plano: quem muda é o servidor (chave service_role).

## Antes de ligar para todos

- **Política de privacidade e termos:** já descrevem o Locker (atualizados em 2026-10-31, em
  `src/legal/legal.ts`); basta subir o `keyconapp-public_html.zip`.
- **Google Play › Segurança dos dados:** preencher como em `GOOGLE-PLAY-SEGURANCA-DOS-DADOS.md`.

## Como funciona (para quem for mexer no código)

| Parte | Onde |
| --- | --- |
| Tabelas, segurança, espaço usado, tempo real | `supabase/locker.sql` |
| Links assinados do R2, limite do plano | `supabase/functions/locker/index.ts` |
| Link de entrada de uso único (abrir o Locker web logado) | `supabase/functions/locker-handoff/index.ts` |
| Links públicos (arquivo e pasta compartilhada, sem login) | `supabase/functions/locker-public/index.ts` |
| Assinatura de links do R2 (usada pelas funções) | `supabase/functions/_shared/r2.ts` |
| Lixeira: apagar de vez depois de 30 dias (todo dia) | `supabase/functions/locker-purge/index.ts`, `supabase/locker-purge.sql` |
| Locker web (locker.keyconapp.com) | `locker/` (`npm run locker:dev`, `npm run locker:build` → `dist-locker/`) |
| Envio para o R2, fila de mudanças, tempo real, limpeza única do aparelho | `src/files/locker.ts` |
| Telas que usam (app e teclado) | `src/app/screens/FilesManagerScreen.tsx`, `src/keyboard/components/FilesTab.tsx` |

- O app e o teclado continuam lendo a cópia local (`Repo.getFiles`): funciona sem internet.
- Cada mudança entra numa fila (`locker.pending`) e sobe quando der; a nuvem só é baixada
  depois que a fila esvazia, para não desfazer o que ainda não subiu.
- No R2, `storagePath` é `r2:<id do usuário>/<nome>` e `url` é um link de download que vale
  7 dias, renovado quando faltam menos de 2 dias.
- Os arquivos do catálogo de produtos e dos atalhos de áudio continuam no bucket "media".
