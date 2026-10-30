# Implementações futuras do KEYCON

Funcionalidades retiradas do app de propósito, para lançar uma versão estável o quanto antes.
O código delas ficou no projeto, sem uso, para facilitar a volta. Não religue nada daqui sem
pedido explícito.

| Funcionalidade | Saiu em | Último commit com ela |
| --- | --- | --- |
| IA: sugestões de resposta para a mensagem do cliente | 30/10/2026 | `0f6e70d` |
| Login com Google e com a Apple | 30/10/2026 | `fdc098c` |
| Google Meet / Google Agenda na agenda | 30/10/2026 | `fdc098c` |

Para ver um arquivo como era: `git show <commit>:<caminho>`, por exemplo
`git show 0f6e70d:src/keyboard/components/MoreTab.tsx`.

---

## 1. IA: sugestões de resposta

**O que fazia.** No teclado, em Mais › IA, a pessoa copiava a mensagem do cliente e tocava em
"Analisar mensagem recebida". O teclado mandava a mensagem, o nome do negócio, o ramo e os
produtos relacionados ao servidor, que pedia à OpenAI (`gpt-4o-mini`) três respostas no tom do
negócio e no idioma de venda. A pessoa tocava numa delas para inserir na conversa.

**Por que saiu.** Nunca saiu do modo de demonstração: o servidor não foi publicado
(`AI_CONFIG.useMock = true` e `baseUrl` de exemplo), então as respostas eram falsas.

**O que ficou guardado (sem uso):**
- `src/keyboard/components/AICopilotTab.tsx`: a tela da IA no teclado.
- `src/services/aiService.ts`: a chamada ao servidor, o modo de demonstração e `AI_CONFIG`.
- `backend/server.ts` (e `server.ts` na raiz): o servidor Express que chama a OpenAI com
  `OPENAI_API_KEY` e `JWT_SECRET`. Rodar: `npm run backend`.
- Os textos traduzidos da tela da IA em `src/i18n/en.ts` e `es.ts`.
- A cor lilás da IA nos ícones (`Icon.tsx`, ícone `ia`).

**Como religar:**
1. Publicar o `backend/server.ts` com `OPENAI_API_KEY` e `JWT_SECRET` (o JWT precisa aceitar o
   token do Supabase do app). Pôr o endereço em `AI_CONFIG.baseUrl` e `useMock: false`.
2. Teclado: voltar a opção IA na aba Mais (`src/keyboard/components/MoreTab.tsx`: o botão
   `more-btn-copilot` e o submenu `'copilot'`, que abre o `AICopilotTab` com `onInsert`) e o
   `'copilot'` no tipo `MoreSubMenu` (`src/types/index.ts`). Passar `onInsert={insert}` de novo no
   `CorretorKeyboard.tsx`.
3. App: a linha "IA" em Conta › Status (`ProfileSettingsScreen.tsx`, com `AI_CONFIG`).
4. Textos que voltam a citar a IA (pegar do commit `0f6e70d`):
   - App: dica do ramo no cadastro (`AuthScreen.tsx`), Ramo do negócio (`ProfileSettingsScreen.tsx`),
     passo do Acesso Total no iPhone (`KeyboardSetupScreen.tsx`).
   - Termos (`src/legal/legal.ts`): o "O que é o KEYCON" e a seção "Inteligência artificial"
     (aviso de que as sugestões podem ter erros), e "provedores de inteligência artificial" em
     Serviços de terceiros.
   - Política: a área de transferência (só lida pelo botão da IA), a seção "Inteligência
     artificial" (o que vai para o servidor e para o provedor) e o provedor de IA em "Com quem
     compartilhamos". Depois: `npm run landing:legal` e atualizar `LEGAL_UPDATED`.
   - Landing (`landing/index.html` e `landing/script.js`): cartão "Respostas com IA", item
     "Vai para o servidor", motivo do Acesso Total no iPhone, ramos e pergunta frequente 4.
   - Loja (`store/google-play/textos-da-loja.md`): tópico das respostas com IA, ramos, frase de
     privacidade e notas da versão. Recontar os caracteres das descrições.
5. Google Play: declarar na Segurança dos dados o envio da mensagem copiada ao servidor.

---

## 2. Login com Google e com a Apple

**Por que saiu.** O login com Google abria o navegador e passava pelo endereço do Supabase até
accounts.google.com, o que parecia um link malicioso. O da Apple tinha o mesmo fluxo.

**O que ficou guardado:** o retorno por `keycon://auth-callback` (`handleAuthUrl` em
`src/services/auth.ts`, intent filter no `AndroidManifest.xml` e esquemas no `Info.plist` do iOS).

**Como religar (caminho combinado: login nativo, sem navegador):**
1. `@react-native-google-signin/google-signin` 13.3.1 (compatível com o RN 0.74) e
   `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`.
2. Google Cloud: o ID do cliente "Aplicativo da Web" (o mesmo do Supabase) como `webClientId`; um
   cliente Android com o pacote `com.keycon.app` e o SHA-1 da chave de envio **e** da assinatura de
   apps da Play Console; um cliente iOS com o esquema de URL invertido no `Info.plist`.
3. Supabase › Authentication › Providers › Google: os IDs em "Authorized Client IDs" e
   **Skip nonce check** ligado (o iOS exige).
4. No iPhone, o login com a Apple volta junto (diretriz 4.8 da App Store).
5. Política de privacidade: a seção "Dados do usuário Google" (feita para a verificação do Google)
   está em `docs/backup/politica-dados-google.patch`.

---

## 3. Google Meet e Google Agenda na agenda

**O que fazia.** Criava a sala do Meet e o evento no Google Agenda direto do compromisso, com o
acesso que vinha do login com Google (escopo `calendar.events`).

**O que ficou guardado (sem uso):** `src/agenda/googleMeet.ts`, `src/agenda/googleAccess.ts`, as
funções do Google em `src/storage/storage.ts` e a Edge Function `supabase/functions/google-refresh`.
Compromissos antigos mantêm o `meetUrl` salvo.

**Como religar:** depende do login com Google (item 2). Voltar o campo e o botão do Meet em
`AgendaScreen.tsx` e `KeyboardAgenda.tsx`, a linha do Meet em Conta › Status e os textos da
política sobre o Google Agenda.
