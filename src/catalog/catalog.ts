/**
 * Regras do catálogo usadas pelo app e pelo teclado: o formulário do produto
 * (nome, preço, categoria, descrição e imagem), a validação e a gravação no
 * Repo. Os dois lados gravam no mesmo lugar, então o que um faz o outro vê.
 */
import { t } from '../i18n';
import { currentMarketInfo, digitsFromMoney, moneyFromDigits } from '../i18n/markets';
import type { SegmentProfile } from '../segments/segments';
import { limitError } from '../plans/plan';
import { deleteUploadedMedia } from '../services/mediaUpload';
import { Repo } from '../storage/storage';
import type { MediaItem, Product, ProductFolder } from '../types';

/** Formulário do produto: id null = produto novo. */
export interface ProductDraft {
  id: string | null;
  /** Pasta (categoria) escolhida; vazio = criar uma nova com newCategoryName. */
  folderId: string;
  newCategoryName: string;
  title: string;
  /** Só os dígitos do preço ("18990" = 189,90): o campo monta o valor. */
  price: string;
  desc: string;
  imageUrl: string;
  imageStoragePath?: string;
}

export function emptyDraft(folderId = ''): ProductDraft {
  return { id: null, folderId, newCategoryName: '', title: '', price: '', desc: '', imageUrl: '' };
}

export function draftFromProduct(p: Product, folderId: string): ProductDraft {
  const photo = p.photos[0];
  return {
    id: p.id,
    folderId,
    newCategoryName: '',
    title: p.title,
    // Preço 0 = "Sob consulta": o campo volta vazio
    price: digitsFromMoney(p.price, currentMarketInfo()),
    desc: p.shortDescription,
    imageUrl: photo?.url ?? '',
    imageStoragePath: photo?.storagePath,
  };
}

export type SaveResult = { ok: true; product: Product; folderId: string; created: boolean } | { ok: false; error: string };

/**
 * Valida e grava. `newCategory`: a pessoa escolheu criar uma categoria (ou
 * ainda não tem nenhuma). Uma categoria com o mesmo nome de uma que já existe
 * reaproveita a existente.
 */
export function saveProductDraft(draft: ProductDraft, segment: SegmentProfile, newCategory: boolean): SaveResult {
  const { item } = segment.terms;
  const title = draft.title.trim();
  if (!title) return { ok: false, error: t('Informe o nome do {item}.', { item }) };

  const price = moneyFromDigits(draft.price, currentMarketInfo());
  if (!(price > 0) && !segment.price.optional) return { ok: false, error: t('Informe o preço.') };

  const folders = Repo.getFolders();
  // Plano grátis: até 3 produtos (supabase/plans.sql); editar um que já existe sempre pode
  const isNew = !draft.id || !folders.some(f => f.products.some(p => p.id === draft.id));
  const tooMany = isNew ? limitError('products') : null;
  if (tooMany) return { ok: false, error: tooMany };
  let folderId = draft.folderId;
  if (newCategory || !folderId || !folders.some(f => f.id === folderId)) {
    const name = draft.newCategoryName.trim();
    if (!name) return { ok: false, error: t('Informe a categoria do produto.') };
    const same = folders.find(f => f.name.trim().toLowerCase() === name.toLowerCase());
    if (same) folderId = same.id;
    else {
      const noFolder = limitError('productFolders');
      if (noFolder) return { ok: false, error: noFolder };
      folderId = `folder-${Date.now()}`;
      Repo.addFolder({ id: folderId, name, products: [] });
    }
  }

  const from = draft.id ? folders.find(f => f.products.some(p => p.id === draft.id)) : undefined;
  const existing = from?.products.find(p => p.id === draft.id);

  // A imagem do formulário é a 1ª foto; as outras fotos, vídeos, link e
  // características de versões anteriores continuam como estavam
  const url = draft.imageUrl.trim();
  const others = existing?.photos.slice(1) ?? [];
  const replaced = existing?.photos[0];
  if (replaced?.storagePath && replaced.storagePath !== draft.imageStoragePath) deleteUploadedMedia(replaced.storagePath);
  const cover: MediaItem[] = url
    ? [{ id: replaced?.url === url ? replaced.id : `photo-${Date.now()}`, type: 'image', title, url, storagePath: draft.imageStoragePath }]
    : [];

  const product: Product = {
    datasheetUrl: '',
    attributes: [],
    videos: [],
    ...existing,
    id: existing?.id ?? `prod-${Date.now()}`,
    title,
    price,
    shortDescription: draft.desc.trim(),
    photos: [...cover, ...others],
  };

  if (existing && from) {
    if (from.id !== folderId) {
      Repo.deleteProduct(from.id, existing.id);
      Repo.addProduct(folderId, product);
    } else Repo.updateProduct(folderId, product);
  } else Repo.addProduct(folderId, product);

  return { ok: true, product, folderId, created: !existing };
}

/** Arquivos do produto guardados na nuvem (fotos e vídeos enviados pelo app ou pelo teclado). */
function deleteProductMedia(p: Product) {
  [...p.photos, ...p.videos].forEach(m => deleteUploadedMedia(m.storagePath));
}

export function deleteProduct(folderId: string, product: Product): void {
  Repo.deleteProduct(folderId, product.id);
  deleteProductMedia(product);
}

/** Exclui a pasta com os produtos dela (e os arquivos deles na nuvem). */
export function deleteFolder(folder: ProductFolder): void {
  Repo.deleteFolder(folder.id);
  folder.products.forEach(deleteProductMedia);
}

/** Cria ou renomeia a pasta. Devolve o id, ou a mensagem de erro. */
export function saveFolder(id: string | null, name: string, description: string): { ok: true; id: string } | { ok: false; error: string } {
  const clean = name.trim();
  if (!clean) return { ok: false, error: t('Informe o nome da pasta.') };
  const desc = description.trim() || undefined;
  if (id) {
    Repo.updateFolder(id, { name: clean, description: desc });
    return { ok: true, id };
  }
  const tooMany = limitError('productFolders');
  if (tooMany) return { ok: false, error: tooMany };
  const newId = `folder-${Date.now()}`;
  Repo.addFolder({ id: newId, name: clean, description: desc, products: [] });
  return { ok: true, id: newId };
}
