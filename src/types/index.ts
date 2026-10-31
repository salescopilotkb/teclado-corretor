/**
 * Modelos de domínio compartilhados entre App principal e Teclado.
 */

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  title: string;
  /** URL hospedada na nuvem (CDN / Cloud Storage - sem consumo de memória no aparelho). */
  url: string;
  thumbnailUrl?: string;
  duration?: string;
  /** Caminho no Storage quando o arquivo foi enviado pelo app (vazio = link externo). */
  storagePath?: string;
}

/**
 * Característica de um produto (ex.: "Quartos: 3", "Ano: 2022"). Os campos
 * sugeridos vêm do ramo; o rótulo fica gravado junto para a ficha continuar
 * certa mesmo se o usuário trocar de ramo depois.
 */
export interface ProductAttribute {
  key: string;
  label: string;
  value: string;
}

/** Qualquer produto ou serviço que o usuário vende. */
export interface Product {
  id: string;
  title: string;
  /** 0 = sem preço fixo ("Sob consulta"), quando o ramo permite. */
  price: number;
  shortDescription: string;
  attributes?: ProductAttribute[];
  /** Link da página do produto (loja, catálogo, Drive...). Vazio = sem link. */
  datasheetUrl: string;
  photos: MediaItem[];
  videos: MediaItem[];
}

/** Pasta / categoria de produtos (ex.: "Linha Verão", "Acessórios"). */
export interface ProductFolder {
  id: string;
  name: string;
  /** Descrição curta da pasta (opcional). */
  description?: string;
  products: Product[];
}

export interface TextShortcut {
  id: string;
  title: string;
  text: string;
}

export interface AudioShortcut {
  id: string;
  title: string;
  duration: string;
  audioUrl: string;
  transcript: string;
  /** Caminho no Storage quando o áudio foi gravado ou enviado pelo app. */
  storagePath?: string;
}

/** Link para envio rápido (site, catálogo, agenda online, Pix...). */
export interface LinkShortcut {
  id: string;
  title: string;
  url: string;
  /** Texto que vai antes do link na mensagem (opcional). */
  message?: string;
}

export interface ShortcutsData {
  texts: TextShortcut[];
  audios: AudioShortcut[];
  links: LinkShortcut[];
}

/** Ramo do negócio, escolhido no cadastro (ver src/segments). */
export type SegmentId =
  | 'general'
  | 'real_estate'
  | 'insurance'
  | 'food'
  | 'legal'
  | 'retail'
  | 'beauty'
  | 'automotive';

export type CountryId =
  | 'US'
  | 'BR'
  | 'PT'
  | 'ES'
  | 'MX'
  | 'AR'
  | 'CO'
  | 'CL'
  | 'UK'
  | 'CA'
  | 'OTHER';

export type CurrencyId = 'USD' | 'BRL' | 'EUR' | 'GBP' | 'CAD' | 'MXN' | 'ARS' | 'COP' | 'CLP';

export type TargetAudienceId = 'brasileiros' | 'americanos' | 'mexicanos' | 'europeus';

/** Perfil de quem vende (usado nas mensagens prontas). */
export interface SellerProfile {
  name: string;
  /** Nome do negócio / loja / empresa. */
  business: string;
  phone: string;
  segment: SegmentId;
  /** Idioma do app e do teclado (ver src/i18n). */
  language: 'pt' | 'en' | 'es';
  /** Onde vende: moeda, formato dos números e idioma das mensagens ao cliente (src/i18n/markets). */
  market: 'BR' | 'US_EN' | 'US_ES' | 'US_PT' | 'PT' | 'ES' | 'MX' | 'AR' | 'CO' | 'CL' | 'UK' | 'CA';
  /** País onde opera/vende. */
  country?: CountryId;
  /** Moeda que vende. */
  currency?: CurrencyId;
  /** Para quem vende (público-alvo / clientes). */
  targetAudience?: TargetAudienceId;
}

export type SuggestionTone = 'cordial' | 'objetiva' | 'persuasiva';

export interface AISuggestion {
  id: string;
  tone: SuggestionTone;
  text: string;
  referencedProductIds?: string[];
}

export type ThemePreference = 'dark' | 'light' | 'system';

export type AgendaKind = 'meeting' | 'task';

/** Compromisso da agenda: reunião (com hora) ou tarefa. Mesmo dado no app e no teclado. */
export interface ScheduleItem {
  id: string;
  kind: AgendaKind;
  title: string;
  /** Dia no formato AAAA-MM-DD. */
  date: string;
  /** HH:MM; sem hora = o dia todo. */
  time?: string;
  /** Cliente do CRM ligado ao compromisso. */
  clientId?: string;
  clientName?: string;
  /** WhatsApp / Telefone do cliente. */
  clientPhone?: string;
  /** Assunto / observações do compromisso. */
  notes?: string;
  /** Link da reunião no Google Meet (ex.: https://meet.google.com/xxx-yyyy-zzz). */
  meetUrl?: string;
  done: boolean;
}

/** Cliente no funil de vendas (CRM). */
export interface CRMLead {
  id: string;
  clientName: string;
  phone: string;
  /** Uma das etapas do funil do ramo (SegmentProfile.crmStages). */
  stage: string;
  /** Último contato (ISO). */
  lastContactAt?: string;
  /** Texto livre de versões antigas ("Hoje, 14:32"). */
  lastContact?: string;
  notes?: string;
  createdAt?: string;
  /** Etiquetas livres para organizar os clientes ("Quente", "Indicação", "VIP"...). */
  tags?: string[];
}

/** Pasta da seção Arquivos. parentId null = pasta na raiz. */
/** Quem vê a pasta pelo Locker: só o dono, quem tem o link, ou também a vitrine pública. */
export type FolderVisibility = 'private' | 'link' | 'public';

export interface FileFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  /** Sem valor = privada (padrão). */
  visibility?: FolderVisibility;
  /** Código do link público da pasta (locker.keyconapp.com/d/<código>); vem da nuvem. */
  shareToken?: string;
  /** Aparece no teclado (sem valor = sim). A pessoa escolhe no app ou no Locker web. */
  inKeyboard?: boolean;
  /** Ordem escolhida pela pessoa (no teclado e no Locker); sem valor = ordem padrão. */
  position?: number;
}

/** Tipo de arquivo do Locker (o Locker web aceita também PDF, áudio e documentos). */
export type SavedFileType = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'other';

/** Arquivo guardado no Locker (fora do catálogo). */
export interface SavedFile {
  id: string;
  /** null = solto na raiz, fora de pasta. */
  folderId: string | null;
  type: SavedFileType;
  title: string;
  url: string;
  /**
   * Onde está o arquivo: "r2:<caminho>" no Cloudflare R2 (Locker), "<caminho>" no
   * bucket "media" do Supabase (versão antiga) ou vazio para link externo.
   */
  storagePath?: string;
  duration?: string;
  createdAt: string;
  /** Tipo do conteúdo (image/jpeg...) e tamanho em bytes: o Locker conta o espaço do plano. */
  mime?: string;
  size?: number;
  /** R2: o `url` é um link temporário; vale até aqui (ms) e o app renova antes de vencer. */
  urlExpiresAt?: number;
  /** Código do link público do arquivo (locker.keyconapp.com/f/<código>): abre sem login. Vem da nuvem. */
  shareToken?: string;
  /** Aparece no teclado (sem valor = sim). A pessoa escolhe no app ou no Locker web. */
  inKeyboard?: boolean;
  /** Ordem escolhida pela pessoa (no teclado e no Locker); sem valor = ordem padrão. */
  position?: number;
}

/** Seção Arquivos: pastas, subpastas e os arquivos (mesmo dado no app e no teclado). */
export interface FilesData {
  folders: FileFolder[];
  files: SavedFile[];
}

/** Botões do menu do teclado (a ordem é escolhida pelo usuário). */
export type MenuTab = 'files' | 'products' | 'shortcuts' | 'agenda' | 'crm' | 'more';

/** Botões do menu + o teclado de letras (ícone fixo no topo). */
export type MainSystemTab = MenuTab | 'keyboard';

export type MoreSubMenu = 'settings' | null;

export interface KeyboardData {
  seller: SellerProfile;
  folders: ProductFolder[];
  shortcuts: ShortcutsData;
  agenda: ScheduleItem[];
  crm: CRMLead[];
  files: FilesData;
  theme: ThemePreference;
}
