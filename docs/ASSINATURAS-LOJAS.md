# Assinaturas: configurar Google Play, App Store e RevenueCat

Roteiro da tarefa 10. Siga na ordem. Os nomes e códigos abaixo são os que o app e o
servidor esperam: copie exatamente.

| Plano | Código do produto (nas duas lojas) | Nível de acesso (RevenueCat) | Preço |
| --- | --- | --- | --- |
| Basic | `keycon_basic_monthly` | `basic` | US$ 24,99/mês |
| Plus | `keycon_plus_monthly` | `plus` | US$ 49,99/mês, com 7 dias grátis para quem nunca assinou |
| Pro | `keycon_pro_monthly` | `pro` | US$ 99,99/mês |

Antes de começar:

- Google: perfil de pagamentos e conta de serviço `revenuecat@keycon.iam.gserviceaccount.com`
  (com a chave JSON) prontos.
- Apple: contrato **Paid Apps** aceito, com banco e impostos (W-9) aprovados.
- Um AAB com a cobrança (versão com o RevenueCat) enviado ao **teste interno** da Google: sem
  ele, a Google não libera "Assinaturas".

---

## 1. Google Play: as 3 assinaturas

Play Console → app KEYCON → **Monetizar com o Google Play** → **Produtos** → **Assinaturas** →
**Criar assinatura**. Para cada plano:

1. **ID do produto:** o código da tabela (ex.: `keycon_basic_monthly`). Não muda depois.
2. **Nome:** `KEYCON Basic` (Plus, Pro). → **Criar**.
3. **Detalhes da assinatura:** nome e benefícios em inglês, português e espanhol (ex.: "5 GB
   in the Locker", "Calendar and clients").
4. **Adicionar plano básico:**
   - ID do plano básico: `monthly`;
   - tipo: **Renovação automática**, período de faturamento **1 mês**;
   - **Período de carência:** 7 dias; **Suspensão da conta:** 30 dias (o padrão);
   - **Preços:** US$ 24,99 (49,99 / 99,99) nos Estados Unidos e **Atualizar preços** para a
     Google converter para os outros países;
   - **Salvar** e **Ativar**.
5. Só no **Plus**: no plano básico `monthly` → **Adicionar oferta**:
   - ID da oferta: `trial7`;
   - qualificação: **Aquisição de novos clientes** → "Nunca teve nenhuma assinatura";
   - fase: **Teste sem custo financeiro**, duração **7 dias**;
   - **Salvar** e **Ativar**.

### Campos de "Editar detalhes da assinatura" (Google Play)

Idioma padrão: inglês (en-US). Espanhol e português entram em **Gerenciar traduções**.
Benefícios: até 4, com no máximo 40 caracteres cada.

| Campo | Basic | Plus | Pro |
| --- | --- | --- | --- |
| Nome | KEYCON Basic | KEYCON Plus | KEYCON Pro |
| Benefício 1 | 5 GB Locker storage | 20 GB Locker storage | 100 GB Locker storage |
| Benefício 2 | Unlimited products and shortcuts | Team of up to 5 people | 5 teams, up to 50 people |
| Benefício 3 | Calendar and clients (CRM) | Shareable folder links | Priority support |
| Benefício 4 | Share folders with up to 3 people | Everything in Basic | Everything in Plus |
| Descrição (interna) | Monthly KEYCON Basic plan: 5 GB in the Locker, unlimited products and shortcuts, calendar and clients (CRM). | Monthly KEYCON Plus plan: 20 GB in the Locker, a team of up to 5 people, shareable folder links. 7-day free trial for new subscribers. | Monthly KEYCON Pro plan: 100 GB in the Locker, 5 teams with up to 50 people, priority support. |

Traduções dos benefícios:

| Plano | Espanhol (es-US) | Português (pt-BR) |
| --- | --- | --- |
| Basic | 5 GB de almacenamiento en el Locker · Productos y atajos ilimitados · Calendario y clientes (CRM) · Compartir carpetas con hasta 3 personas | 5 GB de armazenamento no Locker · Produtos e atalhos ilimitados · Agenda e clientes (CRM) · Compartilhe pastas com até 3 pessoas |
| Plus | 20 GB de almacenamiento en el Locker · Equipo de hasta 5 personas · Enlaces de carpetas para compartir · Todo lo de Basic | 20 GB de armazenamento no Locker · Equipe de até 5 pessoas · Links de pastas para compartilhar · Tudo do Basic |
| Pro | 100 GB de almacenamiento en el Locker · 5 equipos, hasta 50 personas · Soporte prioritario · Todo lo de Plus | 100 GB de armazenamento no Locker · 5 equipes, até 50 pessoas · Suporte prioritário · Tudo do Plus |

Traduções da descrição:

| Plano | Espanhol (es-US) | Português (pt-BR) |
| --- | --- | --- |
| Basic | Plan mensual KEYCON Basic: 5 GB en el Locker, productos y atajos ilimitados, agenda y clientes (CRM). | Plano mensal KEYCON Basic: 5 GB no Locker, produtos e atalhos ilimitados, agenda e clientes (CRM). |
| Plus | Plan mensual KEYCON Plus: 20 GB en el Locker, un equipo de hasta 5 personas, enlaces de carpetas para compartir. Prueba gratis de 7 días para nuevos suscriptores. | Plano mensal KEYCON Plus: 20 GB no Locker, uma equipe de até 5 pessoas, links de pastas para compartilhar. Teste grátis de 7 dias para novos assinantes. |
| Pro | Plan mensual KEYCON Pro: 100 GB en el Locker, 5 equipos con hasta 50 personas, soporte prioritario. | Plano mensal KEYCON Pro: 100 GB no Locker, 5 equipes com até 50 pessoas, suporte prioritário. |

Iguais nos três planos:

- **Ícone:** `assets/planos/keycon-basic.png`, `keycon-plus.png`, `keycon-pro.png` (1024×1024, PNG de 32 bits).
- **Categoria fiscal do produto:** Vendas de apps digitais (o padrão).
- **Configurações de conformidade:** Serviço (o padrão).
- **Classificação indicativa:** a mesma do app (Painel → Classificação do conteúdo).
- **Restrição de local de pagamento:** nenhuma.

## 2. App Store: o grupo e as 3 assinaturas

App Store Connect → app KEYCON → **Monetização** → **Assinaturas**:

1. **Grupo de assinaturas** → **Criar** → nome `KEYCON Plans`.
2. Dentro do grupo, **Criar** cada assinatura:
   - **Nome de referência:** `KEYCON Basic` (Plus, Pro);
   - **ID do produto:** o código da tabela;
   - **Duração:** 1 mês;
   - **Preço:** US$ 24,99 (49,99 / 99,99), deixando a Apple calcular os outros países;
   - **Localização** (inglês, português, espanhol): nome de exibição e descrição;
   - **Revisão:** uma captura da tela de planos do app e uma nota (ex.: "Monthly plan with
     5 GB of storage in the KEYCON Locker").
3. **Níveis** (no grupo, arraste para ordenar): **Pro = nível 1**, **Plus = nível 2**,
   **Basic = nível 3**. Assim, subir de plano vale na hora e descer vale na renovação.
4. Só no **Plus**: **Preços da assinatura** → **Ofertas introdutórias** → **Criar** → **Grátis**,
   duração **1 semana**, em todos os países.
5. As assinaturas vão para a revisão **junto com a primeira versão do app** enviada à App Store.

## 3. RevenueCat

[app.revenuecat.com](https://app.revenuecat.com) → projeto **KEYCON**:

1. **Apps**: o app da Google Play (`com.keycon.app`, com o JSON da conta de serviço) e o da App
   Store (`com.keycon.app`, com a chave In-App Purchase `.p8`, Key ID e Issuer ID).
   Na Google, ative **Google developer notifications** (Connect to Google).
   Na Apple, copie a **URL de notificações do servidor** que o RevenueCat mostra e cole em App
   Store Connect → app → **Informações do app** → **Notificações do servidor da App Store**
   (produção e sandbox).
2. **Products** → **+ New** → importe os 3 produtos de cada loja (na Google aparecem como
   `keycon_basic_monthly:monthly` etc.).
3. **Entitlements** (níveis de acesso) → crie `basic`, `plus` e `pro` → em cada um, **Attach**
   os produtos daquele plano das duas lojas.
4. **Offerings** → **+ New** → identificador `default` → marque **Current** → adicione 3
   pacotes, cada um com o produto de cada loja:
   - `basic` (Custom) → `keycon_basic_monthly` (Google e Apple);
   - `plus` (Custom) → `keycon_plus_monthly`;
   - `pro` (Custom) → `keycon_pro_monthly`.
5. **Project settings → API keys:**
   - as duas **chaves públicas** (`goog_...` e `appl_...`): mande para mim, elas vão no app
     (`src/config/revenuecat.ts`);
   - a **chave secreta** (`sk_...`): **não mande**; ela vai nos segredos do Supabase (passo 4).
6. **Integrations → Webhooks → + New**:
   - URL: `https://ldobmaflbrqruqfalkvi.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization header value:** `Bearer ` seguido de uma senha longa que você inventa
     (a mesma do passo 4).
   - Ambiente: **Both** (produção e sandbox).

## 4. Supabase

1. SQL Editor: rode o `supabase/plans.sql` de novo (seção 8: o plano muda na tela na hora).
2. Segredos (eu abro uma janela para você colar, como no R2):
   `REVENUECAT_SECRET_KEY` (a `sk_...`) e `REVENUECAT_WEBHOOK_SECRET` (a senha do webhook).
3. Funções (eu publico): `billing` e `revenuecat-webhook --no-verify-jwt`.

## 5. Testar (sem pagar)

- **Android:** a conta do Play Console e a lista "Testadores Keycon" compram com cartões de
  teste. A assinatura mensal renova a cada 5 minutos (até 6 vezes) e o teste grátis dura 3 minutos.
- **iPhone:** use o testador **sandbox** (App Store Connect → Usuários e acesso → Sandbox).
  Renovações também aceleradas (1 mês = 5 minutos).
- Confira: assinar o Plus com 7 dias grátis, subir para o Pro, descer para o Basic, cancelar e
  ver o aviso dos 30 dias, **Restaurar compras** num celular novo e a **troca de celular**
  (assinar no Android e abrir no iPhone).
