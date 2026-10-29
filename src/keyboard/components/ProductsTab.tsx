/**
 * Produtos no teclado: ver e enviar os produtos na conversa e também
 * gerenciá-los ali mesmo — criar, editar e excluir pastas (categorias) e
 * produtos (nome, preço, categoria, descrição e imagem).
 *
 * As regras de salvar são as mesmas do app (src/catalog) e tudo grava no
 * mesmo armazenamento: o que muda aqui aparece no app e vice-versa.
 * Os formulários abrem com o teclado em tela grande, com o teclado de letras
 * do KEYCON escrevendo nos campos (KeyboardForm).
 */
import { t, tSell } from '../../i18n';
import { useKeyboardBack } from '../../navigation/back';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { deleteFolder, deleteProduct, draftFromProduct, emptyDraft, saveFolder, saveProductDraft } from '../../catalog/catalog';
import type { ProductDraft } from '../../catalog/catalog';
import { currentMarketInfo, formatMoney, moneyFromDigits } from '../../i18n/markets';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { KeyboardPickSource } from '../../native/KeyboardBridge';
import type { SegmentProfile } from '../../segments/segments';
import type { MediaItem, Product, ProductFolder } from '../../types';
import { formatPrice, formatProductMessage } from '../../utils/formatters';
import { UploadStatus, useUploader } from '../../app/components/MediaUpload';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../theme';
import { CoralSheen } from './Glass';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';
import { ActionButton, AppOnlyNote, BarButton, ConfirmDelete, UseButton } from './KeyboardButtons';
import { Header } from './KeyboardCRM';
import { MAX_RESULTS, NoResults, ResultsSection, SearchLauncher, SearchPanel, matches } from './KeyboardSearch';
import { ChoiceRow, KeyboardFormField, KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';

interface Props {
  folders: ProductFolder[];
  /** Ramo do usuário: preço e nomes da ficha. */
  segment: SegmentProfile;
  onInsert: (text: string) => void;
  /** Foto direto na conversa (cai no link se o app não aceitar). */
  onSendImage: (url: string, title: string) => void;
  /** Compartilhamento do Android; fallbackText é inserido se falhar. */
  onShare: (urls: string[], fallbackText: string) => void;
  /** Foto com o texto de legenda (no WhatsApp: uma mensagem só). */
  onShareWithCaption: (urls: string[], caption: string) => void;
  /** Os formulários abrem com o teclado em tela grande. */
  onExpandedChange: (expanded: boolean) => void;
  /** Depois de gravar: relê os dados. */
  onChanged: () => void;
}

const photoLink = (m: MediaItem) => `[${tSell('Foto')}] ${m.title}: ${m.url}`;

type Screen =
  | { name: 'browse' }
  | { name: 'search' }
  | { name: 'product'; id: string }
  | { name: 'product-form'; id: string | null }
  | { name: 'folder-form'; id: string | null };

/** Rascunho temporário do produto em edição: sobrevive a recriação da janela pelo Android ao abrir a galeria/câmera. */
let activeProductDraft: {
  id: string | null;
  folderId: string;
  category: string;
  newCategoryName: string;
  title: string;
  price: string;
  desc: string;
  imageUrl: string;
  imageStoragePath?: string;
} | null = null;

export function ProductsTab({ folders, segment, onInsert, onSendImage, onShareWithCaption, onExpandedChange, onChanged }: Props) {
  /** Pasta aberta (null = lista de pastas). */
  const [folderId, setFolderId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>(() => {
    if (activeProductDraft) {
      return { name: 'product-form', id: activeProductDraft.id };
    }
    return { name: 'browse' };
  });

  const folder = folderId ? folders.find(f => f.id === folderId) : undefined;
  // Pasta excluída (aqui ou no app): volta para a lista
  useEffect(() => {
    if (folderId && !folder) setFolderId(null);
  }, [folderId, folder]);

  // Formulários e busca: o teclado de letras precisa da tela grande
  const editing = screen.name === 'product-form' || screen.name === 'folder-form' || screen.name === 'search';
  useEffect(() => {
    onExpandedChange(editing);
    if (!editing) return;
    // A galeria fecha o teclado; ao voltar, o Android o reabre no tamanho
    // normal: o formulário pede a tela grande de novo
    return KeyboardBridge.onKeyboardShow(() => onExpandedChange(true));
  }, [editing, onExpandedChange]);
  // Sair da aba com um formulário aberto: o teclado volta ao normal
  useEffect(() => () => onExpandedChange(false), [onExpandedChange]);

  const browse = () => setScreen({ name: 'browse' });
  /**
   * "Usar" e "Enviar": o produto numa mensagem só — a imagem com nome,
   * categoria, valor e descrição na legenda. Sem imagem, vai só o texto.
   */
  const useProduct = (p: Product, f: ProductFolder) => {
    const text = formatProductMessage(p, f, segment);
    const photo = p.photos[0]?.url;
    if (photo) onShareWithCaption([photo], text);
    else onInsert(text);
  };
  const locate = (productId: string) => folders.find(f => f.products.some(p => p.id === productId));

  if (screen.name === 'search') {
    return (
      <SearchPanel testID="products-search" placeholder={t('Buscar {items}', { items: segment.terms.items })} onClose={browse}>
        {query => {
          const hitFolders = folders.filter(f => matches(query, f.name, f.description));
          const hitProducts = folders
            .flatMap(f => f.products.map(p => ({ p, f })))
            .filter(({ p, f }) => matches(query, p.title, p.shortDescription, f.name, ...(p.attributes ?? []).map(a => a.value)))
            .slice(0, MAX_RESULTS);
          if (!hitFolders.length && !hitProducts.length) return <NoResults query={query} />;
          return (
            <>
              {hitFolders.length > 0 && <ResultsSection title={t('Categorias')} />}
              {hitFolders.map(f => (
                <ItemCard
                  key={f.id}
                  testID={`search-folder-${f.id}`}
                  title={f.name}
                  meta={f.products.length === 1 ? t('1 item') : t('{n} itens', { n: f.products.length })}
                  icon="pasta"
                  onPress={() => {
                    setFolderId(f.id);
                    browse();
                  }}
                />
              ))}
              {hitProducts.length > 0 && <ResultsSection title={segment.terms.catalog} />}
              {hitProducts.map(({ p, f }) => (
                <ItemCard
                  key={p.id}
                  testID={`search-product-${p.id}`}
                  title={p.title}
                  subtitle={f.name}
                  meta={formatPrice(p, segment)}
                  imageUri={p.photos[0]?.url}
                  icon={!p.photos[0]?.url ? 'foto' : undefined}
                  onPress={() => {
                    setFolderId(f.id);
                    setScreen({ name: 'product', id: p.id });
                  }}
                  trailing={
                    <UseButton
                      testID={`use-search-product-${p.id}`}
                      onPress={() => {
                        // Usou: fecha a busca e o teclado volta ao tamanho normal
                        browse();
                        useProduct(p, f);
                      }}
                    />
                  }
                />
              ))}
            </>
          );
        }}
      </SearchPanel>
    );
  }

  if (screen.name === 'folder-form') {
    const target = screen.id ? folders.find(f => f.id === screen.id) : undefined;
    return (
      <FolderForm
        folder={target}
        onCancel={browse}
        onSaved={id => {
          onChanged();
          setFolderId(id);
          browse();
        }}
        onDeleted={() => {
          if (target) deleteFolder(target);
          onChanged();
          setFolderId(null);
          browse();
        }}
      />
    );
  }

  if (screen.name === 'product-form') {
    const from = screen.id ? locate(screen.id) : undefined;
    const product = from?.products.find(p => p.id === screen.id);
    return (
      <ProductForm
        segment={segment}
        folders={folders}
        initial={product && from ? draftFromProduct(product, from.id) : emptyDraft(folder?.id ?? folders[0]?.id ?? '')}
        onCancel={() => {
          activeProductDraft = null;
          if (product) setScreen({ name: 'product', id: product.id });
          else browse();
        }}
        onSaved={(id, savedFolderId) => {
          activeProductDraft = null;
          onChanged();
          setFolderId(savedFolderId);
          setScreen({ name: 'product', id });
        }}
      />
    );
  }

  if (screen.name === 'product') {
    const from = locate(screen.id);
    const product = from?.products.find(p => p.id === screen.id);
    if (product && from) {
      return (
        <ProductDetail
          product={product}
          folder={from}
          segment={segment}
          onBack={browse}
          onInsert={onInsert}
          onSendImage={onSendImage}
          onUse={() => useProduct(product, from)}
          onEdit={() => setScreen({ name: 'product-form', id: product.id })}
          onDelete={() => {
            deleteProduct(from.id, product);
            onChanged();
            browse();
          }}
        />
      );
    }
  }

  return (
    <Browser
      folders={folders}
      folder={folder}
      segment={segment}
      onOpenFolder={setFolderId}
      onBack={() => setFolderId(null)}
      onOpenProduct={id => setScreen({ name: 'product', id })}
      onNewProduct={() => setScreen({ name: 'product-form', id: null })}
      onNewFolder={() => setScreen({ name: 'folder-form', id: null })}
      onEditFolder={() => folder && setScreen({ name: 'folder-form', id: folder.id })}
      onSearch={() => setScreen({ name: 'search' })}
      onUseProduct={useProduct}
    />
  );
}

// ── Lista de pastas / produtos ──────────────────────────────────────────

function Browser({
  folders,
  folder,
  segment,
  onOpenFolder,
  onBack,
  onOpenProduct,
  onNewProduct,
  onNewFolder,
  onEditFolder,
  onSearch,
  onUseProduct,
}: {
  folders: ProductFolder[];
  folder?: ProductFolder;
  segment: SegmentProfile;
  onOpenFolder: (id: string) => void;
  onBack: () => void;
  onOpenProduct: (id: string) => void;
  onNewProduct: () => void;
  onNewFolder: () => void;
  onEditFolder: () => void;
  onSearch: () => void;
  onUseProduct: (p: Product, f: ProductFolder) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  // Dentro de uma pasta, o "voltar" do celular volta para as pastas
  useKeyboardBack(onBack, !!folder);
  const { item, items } = segment.terms;
  return (
    <View style={styles.flex} testID="products-tab">
      <View style={styles.bar}>
        {folder ? (
          <Pressable testID="folder-back" accessibilityRole="button" accessibilityLabel={t('Voltar')} hitSlop={8} style={styles.barBack} onPress={onBack}>
            <Icon name="voltar" size={20} color={colors.textMuted} />
            <Text style={styles.barTitle} numberOfLines={1}>
              {folder.name}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.barTitle, styles.barTitleRoot]} numberOfLines={1}>
            {segment.terms.catalog}
          </Text>
        )}
        {folder ? (
          <BarButton testID="products-edit-folder" icon="editar" label={t('Editar pasta')} onPress={onEditFolder} />
        ) : (
          <BarButton testID="products-new-folder" icon="novaPasta" label={t('Nova pasta')} onPress={onNewFolder} />
        )}
        <BarButton testID="products-new" icon="adicionar" label={t('Novo {item}', { item })} primary onPress={onNewProduct} />
      </View>
      <SearchLauncher testID="products-search-open" placeholder={t('Buscar {items}', { items })} onPress={onSearch} />

      {folder ? (
        <FlatList
          data={folder.products}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={
            <Text style={styles.empty}>{t('Nenhum {item} nesta pasta. Toque em + para cadastrar.', { item })}</Text>
          }
          renderItem={({ item: p }) => (
            <ItemCard
              testID={`product-${p.id}`}
              title={p.title}
              subtitle={p.shortDescription}
              meta={formatPrice(p, segment)}
              imageUri={p.photos[0]?.url}
              icon={!p.photos[0]?.url ? 'foto' : undefined}
              onPress={() => onOpenProduct(p.id)}
              trailing={<UseButton testID={`use-product-${p.id}`} onPress={() => onUseProduct(p, folder)} />}
            />
          )}
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={f => f.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {t('Nada por aqui ainda. Toque em + para cadastrar seus {items} aqui mesmo, ou pelo app KEYCON.', { items })}
            </Text>
          }
          renderItem={({ item: f }) => (
            <ItemCard
              testID={`folder-${f.id}`}
              title={f.name}
              subtitle={f.description}
              meta={f.products.length === 1 ? t('1 item') : t('{n} itens', { n: f.products.length })}
              icon="pasta"
              onPress={() => onOpenFolder(f.id)}
            />
          )}
        />
      )}
    </View>
  );
}

// ── Produto aberto: enviar, editar, excluir ─────────────────────────────

function ProductDetail({
  product,
  folder,
  segment,
  onBack,
  onInsert,
  onSendImage,
  onUse,
  onEdit,
  onDelete,
}: {
  product: Product;
  folder: ProductFolder;
  segment: SegmentProfile;
  onBack: () => void;
  onInsert: (text: string) => void;
  onSendImage: (url: string, title: string) => void;
  /** O produto inteiro numa mensagem (imagem + ficha). */
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  useKeyboardBack(onBack);
  const [confirming, setConfirming] = useState(false);
  const photo = product.photos[0];
  return (
    <View style={styles.flex}>
      {/* Editar e excluir na barra: no teclado de tamanho normal, sempre à vista */}
      <View style={styles.bar}>
        <Pressable testID="product-back" accessibilityRole="button" accessibilityLabel={t('Voltar')} hitSlop={8} style={styles.barBack} onPress={onBack}>
          <Icon name="voltar" size={20} color={colors.textMuted} />
          <Text style={styles.barTitle} numberOfLines={1}>
            {product.title}
          </Text>
        </Pressable>
        <BarButton testID="product-edit" icon="editar" label={t('Editar')} onPress={onEdit} />
        <BarButton testID="product-delete" icon="lixeira" label={t('Excluir')} onPress={() => setConfirming(true)} />
      </View>
      <ScrollView contentContainerStyle={styles.details} keyboardShouldPersistTaps="always">
        {confirming && (
          <ConfirmDelete
            testID="product-delete-confirm"
            message={t('Excluir "{name}" do app e do teclado?', { name: product.title })}
            onCancel={() => setConfirming(false)}
            onConfirm={onDelete}
          />
        )}
        {photo?.url ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo.url }} style={styles.productPhoto} resizeMode="cover" />
            <Pressable
              style={styles.sendPhotoBtn}
              onPress={() => onSendImage(photo.url, photo.title)}
              onLongPress={() => onInsert(photoLink(photo))}>
              <Icon name="foto" size={18} color={colors.text} />
              <Text style={styles.sendPhotoBtnText}>{t('Enviar foto')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.cardInfo}>
          <Text style={styles.categoryBadge}>{folder.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(product, segment)}</Text>
          {product.shortDescription ? <Text style={styles.productDesc}>{product.shortDescription}</Text> : null}
        </View>

        <Pressable testID="product-insert" style={styles.actionBtn} onPress={onUse}>
          <CoralSheen radius={radius.sm} />
          <Text style={styles.actionBtnText}>
            {photo?.url ? t('Enviar {item} com a foto', { item: segment.terms.item }) : t('Inserir ficha do {item}', { item: segment.terms.item })}
          </Text>
        </Pressable>
        {photo?.url ? <Text style={styles.sendHint}>{t('A foto vai com nome, categoria, valor e descrição, numa mensagem só.')}</Text> : null}
      </ScrollView>
    </View>
  );
}

// ── Cadastro / edição do produto ────────────────────────────────────────

/** Opção "nova categoria" (cria uma pasta) na escolha de categoria. */
const NEW_FOLDER = '__new__';

function ProductForm({
  segment,
  folders,
  initial,
  onCancel,
  onSaved,
}: {
  segment: SegmentProfile;
  folders: ProductFolder[];
  initial: ProductDraft;
  onCancel: () => void;
  onSaved: (productId: string, folderId: string) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { item } = segment.terms;
  const market = currentMarketInfo();

  // "Voltar" do celular fecha o formulário voltando à tela anterior, sem resetar o teclado
  useKeyboardBack(onCancel);

  // Restaura rascunho em memória caso a tela tenha reaberto após a galeria/câmera
  const hasSavedDraft = activeProductDraft && activeProductDraft.id === initial.id;
  const baseCategory = hasSavedDraft
    ? activeProductDraft!.category
    : initial.folderId && folders.some(f => f.id === initial.folderId)
      ? initial.folderId
      : NEW_FOLDER;

  const [category, setCategory] = useState(baseCategory);
  const [image, setImage] = useState({
    url: hasSavedDraft ? activeProductDraft!.imageUrl : initial.imageUrl,
    storagePath: hasSavedDraft ? activeProductDraft!.imageStoragePath : initial.imageStoragePath,
  });
  const [error, setError] = useState<string | null>(null);
  const uploader = useUploader();

  // Mesma ordem do app: categoria, nome, preço, descrição (o ↵ segue essa ordem)
  const fields = useMemo<FormFieldSpec[]>(
    () => [
      ...(category === NEW_FOLDER ? [{ key: 'newCategoryName', label: 'Nome da nova categoria', placeholder: 'Toque e digite' }] : []),
      { key: 'title', label: 'Nome do produto', placeholder: segment.examples.itemTitle || 'Toque e digite' },
      {
        key: 'price',
        // Em ramos com preço opcional, em branco = "Sob consulta"
        label: segment.price.optional ? 'Preço (opcional)' : 'Preço',
        placeholder: formatMoney(0, market),
        kind: 'money',
        format: digits => formatMoney(moneyFromDigits(digits, market), market),
      },
      { key: 'desc', label: 'Descrição', placeholder: segment.examples.itemDescription || 'Opcional', kind: 'multiline' },
    ],
    [category, market, segment],
  );

  const initialValues = hasSavedDraft
    ? {
        title: activeProductDraft!.title,
        price: activeProductDraft!.price,
        desc: activeProductDraft!.desc,
        newCategoryName: activeProductDraft!.newCategoryName,
      }
    : { title: initial.title, price: initial.price, desc: initial.desc, newCategoryName: '' };

  const form = useKeyboardForm(fields, initialValues);
  const activeSpec = fields.find(f => f.key === form.active) ?? fields[0];

  // Mantém o rascunho em sincronia para o caso de o teclado recriar a janela
  useEffect(() => {
    activeProductDraft = {
      id: initial.id,
      folderId: category === NEW_FOLDER ? '' : category,
      category,
      newCategoryName: form.values.newCategoryName ?? '',
      title: form.values.title ?? '',
      price: form.values.price ?? '',
      desc: form.values.desc ?? '',
      imageUrl: image.url,
      imageStoragePath: image.storagePath,
    };
  }, [initial.id, category, form.values, image]);

  const field = (key: string) => {
    const spec = fields.find(f => f.key === key)!;
    return <KeyboardFormField key={key} spec={spec} value={form.values[key] ?? ''} active={form.active === key} onPress={() => form.setActive(key)} />;
  };

  const pickImage = (source: KeyboardPickSource) => {
    setError(null);
    uploader.run(
      () => KeyboardBridge.pickMedia(source),
      (uploaded, local) => {
        const finalUrl = uploaded.url || local.uri;
        setImage({ url: finalUrl, storagePath: uploaded.storagePath });
        if (activeProductDraft) {
          activeProductDraft.imageUrl = finalUrl;
          activeProductDraft.imageStoragePath = uploaded.storagePath;
        }
      },
    );
  };

  const save = () => {
    const result = saveProductDraft(
      {
        ...initial,
        folderId: category === NEW_FOLDER ? '' : category,
        newCategoryName: form.values.newCategoryName ?? '',
        title: form.values.title ?? '',
        price: form.values.price ?? '',
        desc: form.values.desc ?? '',
        imageUrl: image.url,
        imageStoragePath: image.storagePath,
      },
      segment,
      category === NEW_FOLDER,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    activeProductDraft = null;
    onSaved(result.product.id, result.folderId);
  };

  const categories = [
    ...folders.map(f => ({ value: f.id, label: f.name })),
    { value: NEW_FOLDER, label: `+ ${t('Nova categoria')}` },
  ];

  return (
    <View style={styles.flex}>
      <Header
        title={initial.id ? t('Editar {item}', { item }) : t('Novo {item}', { item })}
        onBack={onCancel}
        actionLabel={t('Salvar')}
        onAction={save}
        disabled={!!uploader.uploading}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="always">
        {error || uploader.error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Icon name="info" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error || uploader.error}</Text>
          </View>
        ) : null}
        <Text style={styles.section}>{t('Categoria')}</Text>
        <ChoiceRow
          options={categories}
          value={category}
          onChange={value => {
            setCategory(value);
            if (value === NEW_FOLDER) form.setActive('newCategoryName');
            // O campo da pasta nova sumiu: o teclado volta a escrever no nome
            else if (form.active === 'newCategoryName') form.setActive('title');
          }}
        />
        {category === NEW_FOLDER && field('newCategoryName')}
        {field('title')}
        {field('price')}
        {field('desc')}

        <Text style={styles.section}>{t('Imagem do produto')}</Text>
        <View style={styles.imageRow}>
          {image.url ? (
            <Image source={{ uri: image.url }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePreview, styles.imageEmpty]}>
              <Icon name="foto" size={22} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.imageActions}>
            {!KeyboardBridge.canPickMedia ? (
              <AppOnlyNote testID="product-image-app-only" text={t('No iPhone, escolha a foto do produto pelo app KEYCON.')} />
            ) : (
            <View style={styles.row}>
              <ActionButton
                testID="product-image-gallery"
                icon="galeria"
                label={t('Galeria')}
                disabled={!!uploader.uploading}
                onPress={() => pickImage('gallery-photo')}
              />
              <ActionButton
                testID="product-image-camera"
                icon="foto"
                label={t('Câmera')}
                disabled={!!uploader.uploading}
                onPress={() => pickImage('camera-photo')}
              />
            </View>
            )}
            {image.url ? (
              <ActionButton
                testID="product-image-remove"
                icon="lixeira"
                label={t('Remover')}
                // A foto antiga só sai da nuvem ao salvar (src/catalog)
                onPress={() => setImage({ url: '', storagePath: undefined })}
              />
            ) : null}
          </View>
        </View>
        <UploadStatus uploading={uploader.uploading} error={uploader.error} />
      </ScrollView>
      <KeyboardFormKeys sink={form.sink} activeKey={form.active} spec={activeSpec} />
    </View>
  );
}

// ── Pasta: criar, renomear, excluir ─────────────────────────────────────

const FOLDER_FIELDS: FormFieldSpec[] = [
  { key: 'name', label: 'Nome da pasta', placeholder: 'Toque e digite' },
  { key: 'description', label: 'Descrição', placeholder: 'Opcional' },
];

function FolderForm({
  folder,
  onCancel,
  onSaved,
  onDeleted,
}: {
  folder?: ProductFolder;
  onCancel: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const styles = useStyles();
  const form = useKeyboardForm(FOLDER_FIELDS, { name: folder?.name ?? '', description: folder?.description ?? '' });
  const [confirming, setConfirming] = useState(false);
  const name = (form.values.name ?? '').trim();
  const count = folder?.products.length ?? 0;
  return (
    <View style={styles.flex}>
      <Header
        title={folder ? t('Editar pasta') : t('Nova pasta')}
        onBack={onCancel}
        actionLabel={t('Salvar')}
        disabled={!name}
        onAction={() => {
          const result = saveFolder(folder?.id ?? null, form.values.name ?? '', form.values.description ?? '');
          if (result.ok) onSaved(result.id);
        }}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="always">
        {FOLDER_FIELDS.map(f => (
          <KeyboardFormField key={f.key} spec={f} value={form.values[f.key] ?? ''} active={form.active === f.key} onPress={() => form.setActive(f.key)} />
        ))}
        {folder &&
          (confirming ? (
            <ConfirmDelete
              testID="folder-delete-confirm"
              message={
                count > 0
                  ? t('Excluir a pasta "{name}" e os {n} itens dentro dela?', { name: folder.name, n: count })
                  : t('Excluir a pasta "{name}"?', { name: folder.name })
              }
              onCancel={() => setConfirming(false)}
              onConfirm={onDeleted}
            />
          ) : (
            <ActionButton testID="folder-delete" icon="lixeira" label={t('Excluir pasta')} onPress={() => setConfirming(true)} />
          ))}
      </ScrollView>
      <KeyboardFormKeys sink={form.sink} activeKey={form.active} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  list: { padding: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
  },
  barBack: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  barTitleRoot: { flex: 1, paddingLeft: spacing.xs },
  details: { padding: spacing.md, gap: spacing.md },
  photoContainer: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
    overflow: 'hidden',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  productPhoto: { width: '100%', height: 120, backgroundColor: colors.surfaceAlt },
  sendPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  sendPhotoBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  cardInfo: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  categoryBadge: { ...typography.overline, color: colors.primaryText, marginBottom: 2 },
  productPrice: { fontSize: 18, fontWeight: '700', color: colors.successText },
  productDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginTop: 4 },
  actionBtn: {
    backgroundColor: colors.primary,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.sm,
    alignItems: 'center',
    ...coralGlass(colors, { pill: false }),
  },
  sendHint: { fontSize: 12, lineHeight: 17, color: colors.textMuted, textAlign: 'center' },
  actionBtnText: { ...onCoralText, color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  form: { padding: spacing.sm, gap: spacing.sm },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.dangerBg },
  errorText: { flex: 1, fontSize: 13, color: colors.danger },
  imageRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  imagePreview: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  imageActions: { flex: 1, gap: spacing.sm },
}));
