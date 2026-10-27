# KEYCON — Teclado de vendas com CRM (React Native + TypeScript)

> Seu negócio na ponta dos dedos.

Teclado de sistema (IME Android / Keyboard Extension iOS) para quem vende qualquer produto ou
serviço: cadastre seus produtos com fotos e envie tudo pelo teclado, dentro do WhatsApp ou de qualquer app. O app principal só faz login e configuração.

## Arquitetura

```
┌─────────────── WhatsApp ───────────────┐
│  EditText  ◄── InputConnection (IPC) ──┼────┐
└────────────────────────────────────────┘    │
┌──────────── Processo do nosso app ──────────┼──────────────┐
│ CustomKeyboardService (InputMethodService)  ┘              │
│   └─ ReactRootView ("CorretorKeyboard")                    │
│        ├─ Toolbar: ABC | Produtos | Atalhos | IA | Mais     │
│        ├─ KeyboardBridge.insertText() ──► commitText()     │
│        ├─ MMKV (catálogo offline, leitura síncrona)        │
│        └─ aiService → Clipboard → POST backend → LLM       │
│ MainActivity ("CorretorApp") — login/config (mesmo MMKV)   │
└────────────────────────────────────────────────────────────┘
```

## Estrutura

| Caminho | Responsabilidade |
|---|---|
| `android/.../AndroidManifest.xml` | Declara o serviço IME com `BIND_INPUT_METHOD` |
| `android/.../res/xml/method.xml` | Metadados do teclado (subtype pt-BR, settings) |
| `android/.../keyboard/CustomKeyboardService.kt` | `InputMethodService` que hospeda o RN + `commitText` |
| `android/.../keyboard/KeyboardBridgeModule.kt` | NativeModule JS → InputConnection |
| `ios/CorretorKeyboardExtension/*` | `UIInputViewController` + bridge Swift (`textDocumentProxy`) |
| `src/keyboard/CorretorKeyboard.tsx` | Componente raiz do teclado |
| `src/keyboard/components/*` | Toolbar, abas, barra inferior |
| `src/services/aiService.ts` | Clipboard + contexto local + API de IA |
| `src/storage/storage.ts` | Repositório MMKV compartilhado |
| `backend/server.ts` | Rota Node.js que chama a OpenAI com saída JSON estruturada |

## Identidade visual (manual KEYCON v1.0)

| O quê | Onde |
|---|---|
| Cores (grafite `#242833`, coral `#F17860`, cloud `#F1F2F4`, branco), status, raios, espaçamentos, escala tipográfica | `src/keyboard/theme.ts` |
| Fonte Inter 400/500/600/700 (aplicada sozinha pelo `makeStyles`) | `android/app/src/main/assets/fonts/` |
| Ícones funcionais (cores do manual; Configurações = engrenagem) | `src/keyboard/components/Icon.tsx` |
| Artes originais da marca (ícone, símbolo K, logotipos com e sem slogan) | `assets/` |
| Versões otimizadas usadas no app + componente `KeyconLogo` / `KeyconMark` | `src/assets/brand/`, `src/keyboard/components/KeyconLogo.tsx` |
| Ícone do app no Android (clássico, redondo e adaptativo) | `android/app/src/main/res/mipmap-*` |
| Ícone do iPhone (App Store, 1024 × 1024 sem transparência) | `ios/CorretorKeyboard/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png` |

Coral só em ações, marca e estados ativos; grafite como cor estrutural.

## Ramos de negócio

No cadastro o usuário escolhe o ramo: Imobiliária, Seguros, Restaurante, Advocacia, Loja e varejo,
Beleza e estética, Veículos ou **Outro / Geral**. Dá para trocar depois na tela Conta.

| O que o ramo muda | Onde |
|---|---|
| Nome do catálogo (Imóveis, Planos, Cardápio...), campos extras dos produtos, preço (opcional, "a partir de", "/mês"), etapas do CRM, mensagem de retorno, orientação da IA | `src/segments/segments.ts` |

- Conta nova começa zerada (sem produtos, atalhos ou clientes de exemplo). Os exemplos gravados
  por versões antigas são removidos uma vez ao abrir (`purgeLegacyDemoData` em `storage.ts`).
- Trocar de ramo nunca apaga o que foi cadastrado.
- Fora dos ramos de propósito: registro profissional e dicionário do teclado (o corretor é um só,
  completo, para o dia a dia).
- Supabase: rode de novo o `supabase/schema.sql` (cria `profiles.segment` e `products.attributes`).
  Até lá, o ramo fica salvo só no aparelho.
- Novo ramo: id em `SegmentId` (`src/types`) e um perfil em `segments.ts`.

## Telas do app

| Aba | O que tem | Onde |
|---|---|---|
| Início | Card do teclado, Primeiros passos (marcados sozinhos), atalhos para as áreas; submenus de instalação, teste e passos | `src/app/screens/HomeScreen.tsx`, `KeyboardSetupScreen.tsx`, `src/app/onboarding/steps.ts` |
| Tutorial | 7 telas, abre no primeiro acesso da conta e pelo Início | `src/app/screens/TutorialScreen.tsx` |
| Catálogo / Atalhos | Cadastro de pastas, itens e atalhos (com estado vazio que guia) | `ProductsManagerScreen.tsx`, `ShortcutsManagerScreen.tsx` |
| Conta | Seus dados, Ramo, Aparência, Status, Sobre e licenças | `ProfileSettingsScreen.tsx` |

Peças comuns (card, linha de menu, botão, estado vazio): `src/app/components/ui.tsx`.

## Fotos, vídeos e áudios (Android)

| O quê | Onde |
|---|---|
| Galeria e câmera (fotos em JPEG até 2048 px; vídeos MP4 até 3 min) | `src/native/MediaPicker.ts` (`react-native-image-picker`) |
| Arquivo de áudio do celular | `MediaPicker.pickAudioFile` (`react-native-document-picker`) |
| Gravar áudio (M4A/AAC, até 5 min) | `android/.../keyboard/AudioRecorderModule.kt` + `src/native/AudioRecorder.ts` |
| Envio para o Storage do Supabase (bucket `media`, pasta do usuário), com andamento | `src/services/mediaUpload.ts` |
| Pré-download no teclado (fotos e áudios sempre; vídeos só no Wi-Fi) | `KeyboardBridge.prefetchMedia` → `KeyboardBridgeModule.kt` |

- No app: Catálogo › item › Fotos/Vídeos (Galeria, Tirar foto/Gravar vídeo, Link) e
  Atalhos › Áudios (Gravar agora, Arquivo do celular, Colar link). Excluir apaga o arquivo da nuvem.
- No teclado: a foto vai direto na conversa (quando o app aceita, como o WhatsApp); vídeo e áudio
  abrem o compartilhamento já no app da conversa. Áudio chega como arquivo de áudio (só o próprio
  WhatsApp cria mensagem de voz).
- Precisa do bucket `media` criado pelo `supabase/schema.sql`. Limite: 50 MB por arquivo.
- A câmera usa o app de câmera do celular (o KEYCON não pede permissão de câmera); o microfone é
  pedido na hora de gravar.

## CRM e Agenda (app + teclado expandido)

| O quê | Onde |
|---|---|
| Clientes no funil (etapas do ramo), ficha, cadastro | app: `src/app/screens/ClientsScreen.tsx` · teclado: `src/keyboard/components/KeyboardCRM.tsx` |
| Calendário, reuniões e tarefas | app: `src/app/screens/AgendaScreen.tsx` · teclado: `src/keyboard/components/KeyboardAgenda.tsx` |
| Regras comuns (datas, funil, mensagens) | `src/agenda/agenda.ts`, `src/crm/crm.ts`, `MonthCalendar.tsx` |
| Teclado em tela grande | `KeyboardBridge.setExpanded` → Android `CustomKeyboardService.setExpanded` (88% da tela), iOS `KeyboardViewController.setExpanded` (80%) |
| Formulário dentro do teclado | `KeyboardForm.tsx`: o teclado de letras escreve nos campos (`TextSink`), sem `TextInput` |

- Ao abrir CRM ou Agenda (Mais), o teclado cresce sobre a conversa; ao enviar uma mensagem
  (retorno, confirmação de reunião) ou voltar, ele volta ao tamanho normal. Um campo novo
  (outra conversa) também volta ao normal.
- App e teclado gravam no mesmo armazenamento do aparelho (MMKV; no iPhone, App Group):
  o que é marcado no teclado aparece no app e vice-versa. Entre aparelhos diferentes ainda não
  há sincronização (falta enviar CRM e agenda para o Supabase).

## Teclado de letras

| Recurso | Onde |
|---|---|
| Toques com vários dedos (digitação rápida sem perder teclas) | `src/keyboard/components/TypingKeyboard.tsx` |
| "Tecla invisível": a área de cada letra se ajusta à palavra | `src/keyboard/typing/keyResolver.ts` |
| Sugestões, correção, acentos e abreviações (vc → você) | `src/keyboard/typing/lexicon.ts` |
| Frase: palavra anterior, próxima palavra prevista, correção automática no espaço | `lexicon.ts` + `src/keyboard/typing/bigramsPt.ts` |
| Texto antes do cursor (maiúscula automática, palavra atual) | `src/keyboard/typing/typingContext.ts` |

Maiúscula automática no começo da mensagem e depois de `. ! ?`; volta às letras depois de um
símbolo ou do espaço; dois espaços viram `. `; ao escolher uma sugestão, a pontuação seguinte
"puxa" o espaço (`palavra .` → `palavra. `). E-mail, link e senha não recebem maiúscula nem sugestões.

- Shift: um toque = próxima maiúscula; dois toques ou **segurar 1 s** = maiúsculas travadas.
- Acentos: segurar a letra abre as opções acima dela; arraste o dedo até a escolhida e solte
  (o "ç" fica no "c"). A fileira do meio (a…l) fica centralizada.
- Correção automática: ao apertar espaço ou pontuação, uma palavra que não existe vira a correção
  mais provável para a frase. ⌫ logo em seguida desfaz, e o teclado não insiste naquela palavra.
  Nunca corrige palavras que existem, abreviações (vc, tbm), nomes no meio da frase, e-mail e links.

**Frases (palavra seguinte):** `src/keyboard/typing/bigramsPt.ts`, gerado por
`scripts/build_bigrams.py` a partir das frases em português do [Tatoeba](https://tatoeba.org),
licença [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) (crédito na tela Sobre e licenças).

**Dicionário:** `src/keyboard/typing/wordsPt.ts` — 40 mil palavras do pt-BR filtradas de
[FrequencyWords](https://github.com/hermitdave/FrequencyWords) (Hermit Dave, legendas do OpenSubtitles),
licença [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). O crédito precisa aparecer
também na tela "Sobre"/licenças do app publicado.

## Passo a passo

### 1. Criar o projeto base e copiar os arquivos
```bash
npx @react-native-community/cli@latest init CorretorKeyboard --version 0.74.5 --package-name com.corretorkeyboard
cd CorretorKeyboard
npm i react-native-mmkv@^2.12.2 @react-native-clipboard/clipboard react-native-svg@15.8.0
```
Copie `src/`, `index.js`, `backend/` e os arquivos de `android/` e `ios/` deste repositório por cima.

### 2. Android
1. Em `android/gradle.properties`: `newArchEnabled=false` (o serviço usa `ReactRootView`;
   para Bridgeless veja a nota no topo de `CustomKeyboardService.kt`).
2. Em `MainActivity.kt`: `override fun getMainComponentName() = "CorretorApp"`.
3. Em `MainApplication.kt`, registre o pacote:
   ```kotlin
   override fun getPackages(): List<ReactPackage> =
       PackageList(this).packages.apply { add(KeyboardBridgePackage()) }
   ```
4. `npm run android` → no app, toque em **Abrir configurações de teclado** → ative
   “KEYCON” → no WhatsApp, troque de teclado (ícone ⌨️ na barra de navegação).
5. CI: `.github/workflows/build-android.yml` gera a cada commit o **AAB de release**
   (`KEYCON-v<versão>.aab`), o formato que a Google Play pede. Para a Play aceitar o envio,
   o AAB precisa da chave de envio, guardada em quatro segredos do repositório
   (Settings › Secrets and variables › Actions):
   - `KEYCON_UPLOAD_KEYSTORE_BASE64`: o arquivo `.jks` em base64;
   - `KEYCON_UPLOAD_STORE_PASSWORD` e `KEYCON_UPLOAD_KEY_PASSWORD`: as senhas;
   - `KEYCON_UPLOAD_KEY_ALIAS`: o apelido da chave.

   Sem esses segredos, o AAB sai com a chave de debug (a CI avisa) e serve só para conferir
   a compilação. O AAB não instala direto no celular: por isso a mesma compilação gera também
   o **APK de release** (`KEYCON-v<versão>.apk`, artefato `-apk`), para instalar e testar.

### 3. iOS
O projeto Xcode é gerado pelo [XcodeGen](https://github.com/yonaskolb/XcodeGen) a partir de
`ios/project.yml` (o `.xcodeproj` não vai para o git). Precisa de um Mac com Xcode 15.4 (ou 16 até o 16.2).
O app pede iOS 15.5 ou mais novo (mínimo do Google ML Kit, usado na tradução do teclado).
1. `brew install xcodegen` (uma vez).
2. `cd ios && xcodegen generate && pod install`.
3. Abra `ios/CorretorKeyboard.xcworkspace`. Em **Signing & Capabilities**, escolha o seu Team nos
   dois alvos (`CorretorKeyboard` e `CorretorKeyboardExtension`) ou preencha `DEVELOPMENT_TEAM`
   em `ios/project.yml`. Registre na conta da Apple os IDs `com.keycon.app`,
   `com.keycon.app.keyboard` e o App Group `group.com.keycon.app`.
4. Rode no iPhone. Depois: Ajustes › Geral › Teclado › Teclados › Adicionar › “KEYCON” →
   **Permitir Acesso Total**.

O que já vem pronto no projeto:
- App (`ios/CorretorKeyboard`) abre o componente `CorretorApp`; o teclado
  (`ios/CorretorKeyboardExtension`) abre o `CorretorKeyboard`. Cada um leva o seu `main.jsbundle`.
- App Group nos dois alvos (entitlements + chave `AppGroup` no `Info.plist`, que o MMKV lê):
  app e teclado usam os mesmos dados.
- Fonte Inter nos dois alvos (o XcodeGen copia de `android/app/src/main/assets/fonts/` para
  `ios/Fonts/` antes de gerar o projeto) e ícone em
  `ios/CorretorKeyboard/Images.xcassets/AppIcon.appiconset/`.
- Tradução do teclado com o Google ML Kit, como no Android (`TranslatorModule.swift`, pod
  `GoogleMLKit/Translate` só no teclado). O ML Kit não roda no simulador arm64: no Mac M1+ o
  simulador usa x86_64 (`EXCLUDED_ARCHS`).
- Gravador dos atalhos de áudio só no app (`KeyconAudioRecorder.m`): a Apple proíbe microfone em teclados.
- CI: `.github/workflows/build-ios.yml` compila app + teclado para iPhone, sem assinatura,
  a cada commit (artefato `KEYCON-iOS-sem-assinatura-v…`).

### 4. Backend de IA
```bash
OPENAI_API_KEY=sk-... npm run backend
```
Ajuste `AI_CONFIG.baseUrl` em `src/services/aiService.ts`. Para testar sem backend: `useMock: true`.

## ⚠️ Restrições de plataforma (importante)

- **Sem `Modal`/`Alert` no teclado**: o IME não tem token de janela de Activity → `BadTokenException`.
- **Sem `TextInput` focável no teclado**: rouba o foco do WhatsApp e encerra a `InputConnection`.
- **Clipboard Android 10+**: só o IME *ativo* ou o app em foco leem — funciona porque somos o IME.
- **iOS – memória**: extensões de teclado têm limite de ~50–70 MB. RN + Hermes cabe, mas mantenha
  o bundle enxuto. Se ultrapassar, o iOS encerra o teclado silenciosamente; a alternativa é uma UI
  nativa SwiftUI para a extensão reaproveitando o mesmo MMKV/API.
- **iOS – rede/clipboard** só funcionam com “Acesso Total” ativado.
- **Chave da OpenAI nunca no app** — sempre via backend autenticado.
- **LGPD**: a mensagem do cliente vai ao backend; informe isso nos termos de uso e não persista o texto.

## 🌐 Versão web de testes (navegador, inclusive iPhone)

Roda o código **real** do app e do teclado no navegador (react-native-web + Vite), com o login
real do Supabase. A página tem duas telas: **App** e **WhatsApp + Teclado** (conversa de teste em
que o teclado escreve).

```bash
npm install
npm run web:dev      # desenvolvimento em http://localhost:5173
npm run web:build    # gera a pasta dist/ para publicar
npm run web:preview  # confere a dist/ em http://localhost:4173
```

- **Publicar:** envie o **conteúdo** de `dist/` para qualquer hospedagem estática (Netlify, Vercel,
  hospedagem comum via FTP...). Os caminhos são relativos, então funciona em subpastas.
- **Dados:** ficam no navegador de quem testa (localStorage), separados do celular.
- **Limitações na web:** fotos e áudios vão como link; envio de arquivos e a tecla 🌐 só no Android.
- Arquivos `.web.ts` (ex.: `src/native/KeyboardBridge.web.ts`) substituem os nativos só na web.
