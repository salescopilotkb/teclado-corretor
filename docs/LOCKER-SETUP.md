# Locker: como ligar a nuvem (Supabase + Cloudflare R2)

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
    "AllowedOrigins": ["https://locker.keyconapp.com", "https://keyconapp.com"],
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

## Planos de espaço

- Sem nada configurado, cada pessoa tem **5 GB** (`basic`).
- Para mudar o plano de alguém (até existir a cobrança da assinatura), no SQL Editor:

```sql
insert into public.locker_plans (user_id, plan, limit_bytes)
values ('<id do usuário>', 'plus', 21474836480)   -- 20 GB; 'pro' = 107374182400 (100 GB)
on conflict (user_id) do update set plan = excluded.plan, limit_bytes = excluded.limit_bytes, updated_at = now();
```

A pessoa só consegue **ler** o próprio plano: quem muda é o servidor (chave service_role).

## Antes de ligar para todos

- **Política de privacidade:** hoje ela diz que os arquivos ficam em links públicos. Com o R2,
  eles ficam privados, com links temporários, e a Cloudflare entra como provedora de
  armazenamento. Atualizar `src/legal/legal.ts` e rodar `npm run landing:legal`.
- **Google Play › Segurança dos dados:** os arquivos e a organização ficam na nuvem.

## Como funciona (para quem for mexer no código)

| Parte | Onde |
| --- | --- |
| Tabelas, segurança, espaço usado, tempo real | `supabase/locker.sql` |
| Links assinados do R2, limite do plano | `supabase/functions/locker/index.ts` |
| Link de entrada de uso único (abrir o Locker web logado) | `supabase/functions/locker-handoff/index.ts` |
| Links públicos (arquivo e pasta compartilhada, sem login) | `supabase/functions/locker-public/index.ts` |
| Assinatura de links do R2 (usada pelas duas funções) | `supabase/functions/_shared/r2.ts` |
| Envio para o R2, fila de mudanças, tempo real, limpeza única do aparelho | `src/files/locker.ts` |
| Telas que usam (app e teclado) | `src/app/screens/FilesManagerScreen.tsx`, `src/keyboard/components/FilesTab.tsx` |

- O app e o teclado continuam lendo a cópia local (`Repo.getFiles`): funciona sem internet.
- Cada mudança entra numa fila (`locker.pending`) e sobe quando der; a nuvem só é baixada
  depois que a fila esvazia, para não desfazer o que ainda não subiu.
- No R2, `storagePath` é `r2:<id do usuário>/<nome>` e `url` é um link de download que vale
  7 dias, renovado quando faltam menos de 2 dias.
- Os arquivos do catálogo de produtos e dos atalhos de áudio continuam no bucket "media".
