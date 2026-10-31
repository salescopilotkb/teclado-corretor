# Prompt para continuar o projeto KEYCON em outra IA

Copie tudo abaixo da linha e cole como primeira mensagem na nova ferramenta.

---

Você vai continuar o desenvolvimento do **KEYCON**, um app de vendas com teclado inteligente. Converse comigo **em português**. Leia este contexto inteiro antes de agir. Não faça commit nem push sem eu pedir. Nunca use `--no-verify`.

## O produto
- KEYCON é um **teclado de sistema para quem vende** qualquer produto ou serviço. Tem catálogo de produtos com fotos, atalhos de texto, áudio e link, arquivos, CRM, agenda, respostas com IA, tradução no aparelho e corretor ortográfico. Tudo funciona dentro do WhatsApp e de qualquer app.
- **Mercado principal: Estados Unidos.** O inglês é o idioma padrão e o português e o espanhol são secundários.
- Público: todos os perfis de vendedor. Modelo: **assinatura mensal**, com preço ainda não definido. Nunca prometa preço, plano grátis nem teste grátis.
- Empresa: **7STUDIO DIGITAL MARKETING CORP.**, Florida Profit Corporation, 5256 International Drive, Apt 561, Orlando, FL 32819, USA. Foro: Orange County, Florida. Não publique o EIN.
- Domínio: **keyconapp.com**, hospedado no HostGator (cPanel, pasta public_html).
- E-mails:
  - `contact@keyconapp.com`: privacidade e exclusão de conta;
  - `support@keyconapp.com`: suporte, botão "Contact us" e e-mail da Play Console;
  - `contato@keyconapp.com`: sem uso.
- Marca: grafite #242833 é a cor de estrutura; coral #F17860 é só para ações, marca e estado ativo. Fonte Inter. Artes oficiais em `assets/`; **nunca redesenhe o K à mão**.
- Regras do produto:
  - conta nova começa vazia, sem dados de exemplo;
  - o dicionário é geral, nunca por ramo;
  - não há campos de registro profissional (CRECI, SUSEP, OAB).
- Os identificadores internos antigos ficam como estão, de propósito: namespace `com.corretorkeyboard`, componentes `CorretorKeyboard` e `CorretorApp`, id do MMKV `corretor-keyboard` e chave `broker.profile`.
- As identidades nas lojas são permanentes: `com.keycon.app`, `com.keycon.app.keyboard` e `group.com.keycon.app`.
- Mais contexto de produto e marca em `PRODUCT.md`.

## O repositório
- Pasta local: `F:\PROJETOS OUTBOX\RAFAEL MARTINEZ\KEYCON\keycon-app-IDE`
- GitHub: `salescopilotkb/teclado-corretor` (público), branch `main`. O último commit enviado é `c78ec5e`.
- Stack: React Native 0.74.5 com TypeScript. Tem um IME Android (Kotlin), uma Keyboard Extension iOS (Swift, projeto gerado pelo XcodeGen a partir de `ios/project.yml`) e uma versão web de testes (react-native-web + Vite, em `web/`). Os arquivos `*.web.ts` substituem os nativos na web.
- Backend: Supabase (tabelas em `supabase/schema.sql`). A chave anon pode ir no app; **nunca coloque a service_role no app**.
- Comandos:

| Comando | O que faz |
| --- | --- |
| `npx tsc --noEmit -p .` | Checa os tipos |
| `npx tsx scripts/check_i18n.ts` | Confere as traduções |
| `npm run web:build` | Gera a versão web em `dist/` |
| `npm run landing:legal` | Gera `landing/privacidade.html` e `landing/termos.html` a partir de `src/legal/legal.ts` |

- **Toda interface usa `t('texto em português')`.** As traduções ficam em `src/i18n/en.ts` e `src/i18n/es.ts`. Todo texto novo precisa entrar nos dois arquivos, e o `check_i18n` deve mostrar 0 faltando.
- No Windows, os arquivos usam CRLF. Para editar com scripts, Python com `io.open` preserva as quebras de linha.

## CI (GitHub Actions)
- `.github/workflows/build-android.yml`:
  - a cada push, gera **AAB e APK de release**;
  - assina com a chave de envio da Google Play usando os segredos `KEYCON_UPLOAD_KEYSTORE_BASE64`, `KEYCON_UPLOAD_STORE_PASSWORD`, `KEYCON_UPLOAD_KEY_PASSWORD` e `KEYCON_UPLOAD_KEY_ALIAS` (já cadastrados);
  - antes de compilar, confere a chave com o keytool.
- A chave fica fora do repositório, em `C:\Users\fehpa\Documents\KEYCON-chave-google-play`. Impressão digital SHA-256: `6E:3D:63:07:1D:B2:69:51:20:EE:D5:B7:36:58:39:E8:68:CD:88:96:9B:B0:D9:53:F1:A0:4F:3D:6C:EA:54:CA`.
- A v1.0.40 compilou assinada ("assinado com a chave: upload") e já está como rascunho de produção na Play Console.
- `.github/workflows/build-ios.yml`: compila o iPhone sem assinatura (XcodeGen 2.41.0, macos-14).

## Landing page (pasta `landing/`)
- HTML, CSS e JS puros. Abre em inglês; os botões EN/ES/PT trocam o idioma e a escolha fica salva em `localStorage` (`keycon.lang`).
- Seções: abertura com logo, slogan "Smart keyboard. Organized sales.", teclado 3D em CSS que segue o mouse (neon salmão em volta das teclas e linhas animadas no canvas do fundo) e selos das lojas; a venda em 3 quadros (casas nos EUA, foto e ficha como no WhatsApp); lista de espera; recursos; privacidade; ramos; passos; perguntas; chamada final.
- Configuração no `CONFIG` do `landing/script.js`:
  - links das lojas, ainda vazios, que mostram "Coming soon";
  - `contactEmail` = support@;
  - lista de espera: tabela `waitlist` no Supabase, com insert anônimo.
- `ASSET_VERSION` e os parâmetros `?v=` precisam subir a cada mudança de arquivo, por causa do cache do navegador.
- Páginas: `privacidade.html` e `termos.html` (geradas), e `excluir-conta.html` (feita à mão, EN/ES/PT, pedidos por contact@).
- `three.min.js` é um arquivo antigo que a página não usa.
- `store/google-play/` tem o ícone 512, a imagem de destaque 1024×500, 6 capturas de tela e o arquivo `textos-da-loja.md` (nome, descrições e notas da versão em en-US, es-419 e pt-BR).

## App web de testes (`web/`, publicado em keyconapp.com/app)
- **Modo demonstração** (`src/config/demo.web.ts` com `DEMO_MODE = true`):
  - abre logado com o usuário de exemplo **Rafael Martinez (KEYCON Demo)**, em inglês;
  - não chama o servidor (login, perfil e upload); fotos e arquivos ficam como links `blob:` na aba;
  - recarregar a página limpa tudo (script no `<head>` de `web/index.html`).
- O simulador é um **iPhone 17 Pro Max** em CSS: tela de 440×956 pontos, carcaça laranja-cósmico com espessura e Dynamic Island.
  - O `main.tsx` aplica `zoom` no celular inteiro para caber na janela.
  - Por causa disso, `TypingKeyboard.tsx` e `SystemMenuBar.tsx` usam `measureInWindow` e uma escala **só na web**, para o toque cair na tecla certa.
- Também na versão web:
  - fundo igual ao da landing, com as linhas animadas;
  - logo e título acima do celular;
  - QR Code (`web/qr-keyconapp.svg`, que aponta para https://keyconapp.com/) numa caixa com borda luminosa no canto inferior esquerdo.
- O teclado do PC digita no teclado KEYCON:
  - na tradução e nos formulários, pelo mesmo caminho das teclas virtuais;
  - na conversa, direto no campo;
  - usa listeners de captura no `document`, só com o teclado visível.
- A tradução real usa a Translator API do Chrome 138+ no computador (`Translator.web.ts`).
- Produto com foto ("Use") e envio de arquivos chegam na conversa de teste como mensagem de imagem com legenda, igual ao WhatsApp (`sendMedia` no `KeyboardBridge.web.ts`).
- Cliente de exemplo, **Jessica Miller**: abre com 2 mensagens e responde 3 vezes, uma depois de cada mensagem do vendedor, com "typing…" no topo.
- Pacotes para o HostGator: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build_hostgator_zips.ps1` gera `keyconapp-public_html.zip` (landing sem `three.min.js` + `dist/` em `app/`; vai em public_html) e `locker-public_html.zip` (Locker web, `dist-locker/`; vai na pasta do subdomínio locker.keyconapp.com), com "/" nos caminhos. Pastas geradas e zips estão no `.gitignore`. O usuário sobe e extrai. Para ligar o Locker do zero: `docs/LOCKER-DEPLOY.md`.

## Locker (30/10/2026)
- A seção Arquivos vai virar o **Locker**: um "Google Drive" do KEYCON em locker.keyconapp.com, com o mesmo login, sincronizado em tempo real com o app e o teclado. Planos de 5, 20 e 100 GB por usuário.
- Decidido: **Supabase** para login e organização (tabelas `locker_*`) + **Cloudflare R2** para os arquivos (sem custo de download). Já feito: `supabase/locker.sql`, a Edge Function `supabase/functions/locker` e `src/files/locker.ts` (envio para o R2, fila, tempo real). Sem migração: dados de teste, o Locker começa do zero (`supabase/locker-reset.sql` limpa a nuvem). Como ligar: `docs/LOCKER-SETUP.md`.
- O dono respondeu as 15 perguntas e quer **uma tarefa por resposta, feita uma de cada vez, perguntando antes de seguir**. Feitas: 1 (nome "Locker"), 2 (abrir o Locker web logado pelo app: Edge Function `locker-handoff`) e 3 (sem migração). Faltam: 4, 5, 6, 7, 8 (site com as funções do Drive), 9 a 15.

## Implementações futuras (30/10/2026)
- **A IA (sugestões de resposta) saiu do app, do site, da política e da loja**, junto com o login com Google/Apple e o Google Meet. Tudo o que saiu, o código guardado e como religar está em `IMPLEMENTACOES-FUTURAS.md`. Não religue sem eu pedir.

## Downgrade: sem Google, Apple e Meet (30/10/2026)
- **O login é só por e-mail e senha.** Login com Google, login com a Apple e a integração com o Google Meet/Google Agenda foram retirados de propósito, para o app ficar estável o quanto antes. Não coloque de volta sem eu pedir.
- Motivo: o login com Google abria o navegador passando pelo endereço do Supabase até accounts.google.com, e isso parecia um link malicioso.
- Ficaram no projeto, sem uso, para religar depois: `src/agenda/googleMeet.ts`, `src/agenda/googleAccess.ts`, as funções do Google em `storage.ts` e a Edge Function `supabase/functions/google-refresh`.
- A política de privacidade não fala mais de dados do Google. A versão longa da seção "Dados do usuário Google", feita para a verificação do Google, está em `docs/backup/politica-dados-google.patch`.
- Para religar o Google: usar o login nativo (`@react-native-google-signin/google-signin` 13.3.1 + `supabase.auth.signInWithIdToken`), não o navegador. No iOS, o login com a Apple tem que voltar junto (diretriz 4.8 da App Store).

## Estado atual (29/10/2026)
- **Há muitas alterações sem commit**: landing, páginas legais, modo demonstração, simulador iPhone, digitação pelo PC, envio de mídia na web, inglês como padrão no app e no site, `store/` e `excluir-conta.html`. Confira com `git status` e faça o commit quando eu pedir.
- Inglês virou o padrão para quem é novo: `src/i18n/index.ts` (current e selling = 'en'), `markets.ts` (US_EN primeiro e como padrão) e `storage.ts` (perfil vazio en/US_EN).
- Existe o mercado `US_PT` (EUA, USD, português) para brasileiros que vendem nos EUA.

## Pendências
1. **Play Console:** terminar a Segurança dos dados (o link de exclusão é https://keyconapp.com/excluir-conta.html), a Política (https://keyconapp.com/privacidade.html), o Acesso ao app (conta de teste para o revisor), a página da loja em 3 idiomas e enviar para análise.
2. **Exclusão de conta dentro do app** (botão "Excluir conta"): obrigatória na Play e ainda não existe. Hoje só existe o pedido por e-mail.
3. Cobrança da assinatura (Google Play Billing e App Store) ainda não implementada.
4. Rodar o bloco "Lista de espera" do `supabase/schema.sql` no Supabase, se ainda não foi feito.
5. iOS: conta Apple Developer, assinatura e TestFlight.
6. Bugs no app que encontrei e não corrigi:
   - em espanhol, a aba "Atalhos" aparece cortada no menu do teclado ("Accesos…");
   - em inglês, a aba de imóveis aparece cortada ("Real Est…");
   - o campo Área do ramo Imobiliária usa m², mas nos EUA o padrão é sq ft.
7. O usuário pode trazer mais diferenças entre o teclado da web e o do app oficial; corrija uma por uma, sempre mantendo o código nativo igual.

Comece confirmando que entendeu o contexto. Depois rode `git status` e me pergunte qual é a próxima tarefa.
