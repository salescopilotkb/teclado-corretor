/**
 * Locker de exemplo (demonstração): as mesmas pastas e arquivos no app de
 * demonstração (keyconapp.com/app) e no Locker web de exemplo
 * (locker.keyconapp.com/?demo=1). Nada vai ao servidor; as "fotos" são desenhos
 * (SVG) embutidos no próprio endereço. Os nomes seguem o idioma da demonstração.
 */
import type { Lang } from '../i18n';
import type { FilesData, SavedFileType } from '../types';

type Names = Record<Lang, string>;

export type DemoFolder = { id: string; parent: string | null; name: Names; daysAgo: number; starred?: boolean; inKeyboard?: boolean; trashed?: boolean; visibility?: 'private' | 'link' | 'public' };
export type DemoFile = {
  id: string;
  folder: string | null;
  title: Names;
  ext: string;
  mime: string;
  size: number;
  daysAgo: number;
  /** Desenho da miniatura (só imagens). */
  art?: string;
  duration?: string;
  starred?: boolean;
  inKeyboard?: boolean;
  trashed?: boolean;
};

const MB = 1024 * 1024;

/** "Foto" de exemplo: degradê com um objeto simples, em SVG. */
function photo(a: string, b: string, shape: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/>${shape}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const BAG = '<rect x="300" y="230" width="200" height="190" rx="18" fill="#fff" opacity=".9"/><path d="M350 240v-30a50 50 0 0 1 100 0v30" fill="none" stroke="#fff" stroke-width="16" opacity=".9"/>';
const SHOE = '<path d="M220 400c40-10 90-60 120-110 40 30 120 60 230 70 30 3 40 40 10 50H230c-20 0-30-8-10-10z" fill="#fff" opacity=".9"/>';
const SUN = '<circle cx="400" cy="300" r="110" fill="#fff" opacity=".85"/>';
const BOTTLE = '<rect x="350" y="200" width="100" height="240" rx="30" fill="#fff" opacity=".9"/><rect x="375" y="160" width="50" height="50" rx="8" fill="#fff" opacity=".9"/>';

export const DEMO_FOLDERS: DemoFolder[] = [
  { id: 'f-catalogo', parent: null, name: { pt: 'Catálogo verão 2026', en: 'Summer 2026 catalog', es: 'Catálogo verano 2026' }, daysAgo: 1, starred: true, visibility: 'link' },
  { id: 'f-precos', parent: null, name: { pt: 'Tabelas de preço', en: 'Price lists', es: 'Listas de precios' }, daysAgo: 4 },
  { id: 'f-videos', parent: null, name: { pt: 'Vídeos dos produtos', en: 'Product videos', es: 'Videos de productos' }, daysAgo: 9 },
  { id: 'f-clientes', parent: null, name: { pt: 'Clientes VIP', en: 'VIP customers', es: 'Clientes VIP' }, daysAgo: 20, inKeyboard: false },
  { id: 'f-bolsas', parent: 'f-catalogo', name: { pt: 'Bolsas', en: 'Bags', es: 'Bolsos' }, daysAgo: 1 },
  { id: 'f-calcados', parent: 'f-catalogo', name: { pt: 'Calçados', en: 'Shoes', es: 'Calzado' }, daysAgo: 2 },
  { id: 'f-antigo', parent: null, name: { pt: 'Promoção de inverno', en: 'Winter sale', es: 'Promoción de invierno' }, daysAgo: 40, trashed: true },
];

export const DEMO_FILES: DemoFile[] = [
  { id: 'a1', folder: 'f-bolsas', title: { pt: 'Bolsa caramelo', en: 'Caramel bag', es: 'Bolso caramelo' }, ext: 'jpg', mime: 'image/jpeg', size: 2.4 * MB, daysAgo: 0, art: photo('#F4A27E', '#C8553D', BAG), starred: true },
  { id: 'a2', folder: 'f-bolsas', title: { pt: 'Bolsa preta', en: 'Black bag', es: 'Bolso negro' }, ext: 'jpg', mime: 'image/jpeg', size: 2.1 * MB, daysAgo: 1, art: photo('#5B6271', '#242833', BAG) },
  { id: 'a3', folder: 'f-calcados', title: { pt: 'Tênis branco', en: 'White sneakers', es: 'Zapatillas blancas' }, ext: 'jpg', mime: 'image/jpeg', size: 3.2 * MB, daysAgo: 2, art: photo('#BFD7EA', '#6C8EBF', SHOE) },
  { id: 'a4', folder: 'f-calcados', title: { pt: 'Sandália coral', en: 'Coral sandals', es: 'Sandalias coral' }, ext: 'jpg', mime: 'image/jpeg', size: 1.8 * MB, daysAgo: 3, art: photo('#FFC6B5', '#F17860', SHOE) },
  { id: 'a5', folder: 'f-catalogo', title: { pt: 'Capa do catálogo', en: 'Catalog cover', es: 'Portada del catálogo' }, ext: 'jpg', mime: 'image/jpeg', size: 4.6 * MB, daysAgo: 1, art: photo('#FFE3A3', '#F59E0B', SUN) },
  { id: 'a6', folder: 'f-precos', title: { pt: 'Tabela de preços 2026', en: '2026 price list', es: 'Lista de precios 2026' }, ext: 'pdf', mime: 'application/pdf', size: 820 * 1024, daysAgo: 4 },
  { id: 'a7', folder: 'f-precos', title: { pt: 'Condições de pagamento', en: 'Payment terms', es: 'Condiciones de pago' }, ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 64 * 1024, daysAgo: 6 },
  { id: 'a8', folder: 'f-videos', title: { pt: 'Demonstração do perfume', en: 'Perfume demo', es: 'Demostración del perfume' }, ext: 'mp4', mime: 'video/mp4', size: 38 * MB, daysAgo: 9, duration: '0:42' },
  { id: 'a9', folder: null, title: { pt: 'Mensagem de boas-vindas', en: 'Welcome message', es: 'Mensaje de bienvenida' }, ext: 'm4a', mime: 'audio/mp4', size: 1.1 * MB, daysAgo: 0 },
  { id: 'a10', folder: null, title: { pt: 'Perfume floral', en: 'Floral perfume', es: 'Perfume floral' }, ext: 'jpg', mime: 'image/jpeg', size: 2.7 * MB, daysAgo: 0, art: photo('#E9D5FF', '#8B5CF6', BOTTLE), starred: true },
  { id: 'a11', folder: 'f-clientes', title: { pt: 'Lista de clientes', en: 'Customer list', es: 'Lista de clientes' }, ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 48 * 1024, daysAgo: 20 },
  { id: 'a12', folder: null, title: { pt: 'Folheto antigo', en: 'Old flyer', es: 'Folleto antiguo' }, ext: 'pdf', mime: 'application/pdf', size: 1.4 * MB, daysAgo: 50, trashed: true },
];

export const demoAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
/** Código de link de exemplo (32 caracteres, como os de verdade). */
export const demoToken = (id: string) => `demo${id}`.padEnd(32, '0').slice(0, 32);

const typeOf = (mime: string): SavedFileType =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : mime === 'application/pdf' ? 'pdf' : 'document';

/** O Locker de exemplo no formato do app (o que está na lixeira não entra). */
export function demoFilesData(lang: Lang): FilesData {
  return {
    folders: DEMO_FOLDERS.filter(f => !f.trashed).map(f => ({
      id: f.id,
      name: f.name[lang],
      parentId: f.parent,
      createdAt: demoAgo(f.daysAgo),
      visibility: f.visibility ?? 'private',
      shareToken: demoToken(f.id),
      inKeyboard: f.inKeyboard ?? true,
    })),
    files: DEMO_FILES.filter(f => !f.trashed).map(f => ({
      id: f.id,
      folderId: f.folder,
      type: typeOf(f.mime),
      title: f.title[lang],
      url: f.art ?? '',
      createdAt: demoAgo(f.daysAgo),
      mime: f.mime,
      size: Math.round(f.size),
      duration: f.duration,
      shareToken: demoToken(f.id),
      inKeyboard: f.inKeyboard ?? true,
    })),
  };
}
