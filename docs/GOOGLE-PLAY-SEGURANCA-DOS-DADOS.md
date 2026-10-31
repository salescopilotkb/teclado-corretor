# Google Play › Segurança dos dados: o que marcar (versão com o Locker)

Play Console → o app KEYCON → **Política e programas** → **Conteúdo do app** → **Segurança dos
dados** → **Gerenciar**. Responda como abaixo e envie. A política publicada
(`keyconapp.com/privacidade.html`) já diz o mesmo; os dois precisam bater.

Atualize **antes** de publicar a versão do app que liga o Locker.

## 1. Coleta e segurança

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha algum dos tipos de dados do usuário exigidos? | **Sim** |
| Todos os dados coletados são criptografados em trânsito? | **Sim** |
| Você oferece uma forma de os usuários solicitarem a exclusão dos dados? | **Sim**: `https://keyconapp.com/excluir-conta.html` |

## 2. Tipos de dados

"Compartilhado" no Google Play **não** inclui os provedores que trabalham para nós (Supabase,
Cloudflare) nem o que a própria pessoa decide compartilhar (links e compartilhamentos do
Locker). Por isso, nada abaixo é marcado como "compartilhado".

| Categoria › tipo | Coletado | Compartilhado | Processado só no aparelho? | Obrigatório ou opcional | Finalidades |
| --- | --- | --- | --- | --- | --- |
| Informações pessoais › Nome | Sim | Não | Não | Obrigatório | Funcionalidade do app; Gerenciamento da conta |
| Informações pessoais › Endereço de e-mail | Sim | Não | Não | Obrigatório | Funcionalidade do app; Gerenciamento da conta; Comunicações do desenvolvedor |
| Informações pessoais › Número de telefone | Sim | Não | Não | Opcional | Funcionalidade do app |
| Informações pessoais › Outras informações (nome do negócio, ramo, país onde vende; e-mails das pessoas e equipes com quem a pessoa compartilha no Locker) | Sim | Não | Não | Opcional | Funcionalidade do app |
| Fotos e vídeos › Fotos | Sim | Não | Não | Opcional | Funcionalidade do app |
| Fotos e vídeos › Vídeos | Sim | Não | Não | Opcional | Funcionalidade do app |
| Arquivos de áudio › Gravações de voz ou som | Sim | Não | Não | Opcional | Funcionalidade do app |
| Arquivos de áudio › Outros arquivos de áudio | Sim | Não | Não | Opcional | Funcionalidade do app |
| Arquivos e documentos › Arquivos e documentos (PDFs e documentos do Locker) | Sim | Não | Não | Opcional | Funcionalidade do app |
| Atividade no app › Outro conteúdo gerado pelo usuário (nomes de pastas e arquivos, organização do Locker) | Sim | Não | Não | Opcional | Funcionalidade do app |

**Não marque** (o KEYCON não coleta): localização, contatos da agenda do celular, mensagens,
histórico de navegação, informações financeiras, saúde, identificadores do dispositivo,
dados de desempenho/falhas, e **o que é digitado no teclado** (o texto é processado só no
aparelho e não sai dele).

Produtos, atalhos, clientes do CRM e agenda ficam só no celular: não entram aqui.

## 3. Depois de enviar

- Confira que a página da loja continua apontando a política em
  `https://keyconapp.com/privacidade.html`.
- Se o Locker ganhar coisas novas (por exemplo, o papel de Editor ou avisos por e-mail),
  revise esta tabela e a política (`src/legal/legal.ts` → `npm run landing:legal`).

## App Store (iPhone), quando publicar

Em **App Privacy**, os mesmos dados: Contact Info (Name, Email Address, Phone Number), User
Content (Photos or Videos, Audio Data, Other User Content), todos **ligados à identidade da
pessoa**, **sem rastreamento**, para **App Functionality**.
