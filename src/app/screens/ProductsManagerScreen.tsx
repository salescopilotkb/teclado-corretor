import { t } from '../../i18n';
import { useAppBack } from '../../navigation/back';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { capitalize, getSegment } from '../../segments/segments';
import { Repo } from '../../storage/storage';
import type { Product, ProductFolder } from '../../types';
import { formatPrice, normalizeUrl } from '../../utils/formatters';
import { currentMarketInfo, formatMoney, moneyFromDigits } from '../../i18n/markets';
import { deleteFolder, deleteProduct, draftFromProduct, emptyDraft, saveFolder, saveProductDraft } from '../../catalog/catalog';
import type { ProductDraft } from '../../catalog/catalog';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { Icon, IconTile } from '../../keyboard/components/Icon';
import { CoralSheen, EmptyState } from '../components/ui';
import { SourceButtons, UploadStatus, useUploader } from '../components/MediaUpload';
import { canUseCamera, captureWithCamera, pickFromGallery } from '../../native/MediaPicker';
import { deleteUploadedMedia } from '../../services/mediaUpload';

/** Formulário de pasta (categoria): id null = criando uma pasta nova. */
interface FolderForm {
  id: string | null;
  name: string;
  description: string;
}

/** Formulário de produto (mesmo do teclado, ver src/catalog). */
type ProductForm = ProductDraft;

const productToForm = draftFromProduct;

/**
 * Preço em formato de valor na moeda de quem vende: a pessoa digita só os
 * números e o valor se monta como em maquininha (18990 → R$ 189,90).
 */
function MoneyInput({ digits, onChange }: { digits: string; onChange: (digits: string) => void }) {
  const colors = useColors();
  const styles = useStyles();
  const market = currentMarketInfo();
  const shown = digits ? formatMoney(moneyFromDigits(digits, market), market) : '';
  return (
    <TextInput
      testID="price-input"
      style={styles.input}
      placeholder={formatMoney(0, market)}
      placeholderTextColor={colors.textMuted}
      keyboardType="number-pad"
      value={shown}
      onChangeText={text => {
        let next = text.replace(/\D/g, '').replace(/^0+/, '');
        // Apagou o símbolo ou um separador (ex.: "€" no fim): apaga o último dígito
        if (text.length < shown.length && next === digits) next = digits.slice(0, -1);
        onChange(next.slice(0, 13));
      }}
    />
  );
}

function confirmDelete(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: t('Cancelar'), style: 'cancel' },
    { text: t('Excluir'), style: 'destructive', onPress: onConfirm },
  ]);
}

export function ProductsManagerScreen({ onBack }: { onBack?: () => void } = {}) {
  const colors = useColors();
  const styles = useStyles();
  const [segment] = useState(() => getSegment(Repo.getSegment()));
  const market = currentMarketInfo();
  const { item, items } = segment.terms;
  const [folders, setFolders] = useState<ProductFolder[]>(() => Repo.getFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [folderForm, setFolderForm] = useState<FolderForm | null>(null);
  const [productForm, setProductForm] = useState<ProductForm | null>(null);

  // Controle de imagem e categoria no formulário de produto
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState('');

  const uploader = useUploader();

  const refreshFolders = () => {
    setFolders(Repo.getFolders());
  };

  const folder = folders.find(f => f.id === selectedFolderId);
  const product = folder?.products.find(p => p.id === selectedProductId);

  const openFolder = (id: string | null) => {
    setSelectedFolderId(id);
    setFolderForm(null);
    setProductForm(null);
  };

  const openProduct = (id: string | null) => {
    setSelectedProductId(id);
    setProductForm(null);
  };

  // "Voltar" do celular: sai do cadastro, do produto ou da pasta (como os botões Voltar)
  useAppBack(
    () => {
      if (productForm) {
        if (productForm.imageStoragePath && !productForm.id) deleteUploadedMedia(productForm.imageStoragePath);
        setProductForm(null);
      } else if (product) openProduct(null);
      else openFolder(null);
    },
    !!(productForm || product || folder),
  );

  const makeEmptyProductForm = (defaultFolderId?: string): ProductForm => emptyDraft(defaultFolderId ?? (folders[0]?.id || ''));

  const startCreateProduct = (defaultFolderId?: string) => {
    setFolderForm(null);
    setIsCreatingNewCategory(folders.length === 0);
    setShowLinkInput(false);
    setLinkInputUrl('');
    setProductForm(makeEmptyProductForm(defaultFolderId));
  };

  const startEditProduct = (p: Product, folderId: string) => {
    setIsCreatingNewCategory(false);
    setShowLinkInput(false);
    setLinkInputUrl('');
    setProductForm(productToForm(p, folderId));
  };

  // ---------------------------------------------------------------------
  // Pastas (Categorias)
  // ---------------------------------------------------------------------

  const handleSaveFolder = () => {
    if (!folderForm) return;
    const result = saveFolder(folderForm.id, folderForm.name, folderForm.description);
    if (!result.ok) {
      Alert.alert(t('Atenção'), result.error);
      return;
    }
    refreshFolders();
    setFolderForm(null);
    Alert.alert(t('Sucesso'), folderForm.id ? t('Pasta atualizada!') : t('Pasta criada e sincronizada com o teclado!'));
  };

  const handleDeleteFolder = (f: ProductFolder) => {
    const count = f.products.length;
    confirmDelete(
      'Excluir pasta',
      count > 0
        ? `A pasta "${f.name}" e ${count === 1 ? `o ${item}` : `os ${count} ${items}`} dentro dela serão excluídos. Deseja continuar?`
        : `Deseja excluir a pasta "${f.name}"?`,
      () => {
        deleteFolder(f);
        refreshFolders();
        openFolder(null);
      },
    );
  };

  // ---------------------------------------------------------------------
  // Imagem do Produto antes de salvar
  // ---------------------------------------------------------------------

  const pickProductImage = (from: 'gallery' | 'camera') => {
    setShowLinkInput(false);
    uploader.run(
      () => (from === 'gallery' ? pickFromGallery('image') : captureWithCamera('image')),
      (uploaded, local) => {
        // Fallback local.uri para testes locais caso o Supabase não esteja conectado
        const finalUrl = uploaded.url || local.uri;
        setProductForm(f => (f ? { ...f, imageUrl: finalUrl, imageStoragePath: uploaded.storagePath } : null));
      },
    );
  };

  const applyLinkImage = () => {
    const url = normalizeUrl(linkInputUrl);
    if (!url) {
      Alert.alert(t('Atenção'), t('Cole um link válido de imagem.'));
      return;
    }
    setProductForm(f => (f ? { ...f, imageUrl: url, imageStoragePath: undefined } : null));
    setShowLinkInput(false);
    setLinkInputUrl('');
  };

  const removeProductImage = () => {
    if (!productForm) return;
    if (productForm.imageStoragePath) {
      deleteUploadedMedia(productForm.imageStoragePath);
    }
    setProductForm({ ...productForm, imageUrl: '', imageStoragePath: undefined });
  };

  // ---------------------------------------------------------------------
  // Salvar Produto (Novo ou Edição)
  // ---------------------------------------------------------------------

  const handleSaveProduct = () => {
    if (!productForm) return;
    // Mesma regra do teclado (src/catalog): mantém fotos extras, vídeos e link de antes
    const result = saveProductDraft(productForm, segment, isCreatingNewCategory);
    if (!result.ok) {
      Alert.alert(t('Atenção'), result.error);
      return;
    }
    refreshFolders();
    setSelectedFolderId(result.folderId);
    setProductForm(null);
    Alert.alert(
      t('Sucesso'),
      result.created ? t('Produto criado e sincronizado com o teclado!') : t('Produto atualizado com sucesso!'),
    );
  };

  const handleDeleteProduct = (p: Product) => {
    if (!selectedFolderId) return;
    const folderId = selectedFolderId;
    confirmDelete(`Excluir ${item}`, `Deseja excluir "${p.title}"?`, () => {
      deleteProduct(folderId, p);
      refreshFolders();
      openProduct(null);
    });
  };

  // ---------------------------------------------------------------------
  // Formulário de Pasta (Categoria)
  // ---------------------------------------------------------------------

  const renderFolderForm = (form: FolderForm) => (
    <View style={styles.newFolderBox}>
      <Text style={styles.sectionTitle}>{form.id ? t('Editar Pasta') : t('Criar Nova Pasta')}</Text>
      <Text style={styles.label}>{t('Nome da Pasta')}</Text>
      <TextInput
        style={styles.input}
        placeholder={segment.examples.folderName}
        placeholderTextColor={colors.textMuted}
        value={form.name}
        onChangeText={name => setFolderForm({ ...form, name })}
      />
      <Text style={styles.label}>{t('Descrição (opcional)')}</Text>
      <TextInput
        style={styles.input}
        placeholder={segment.examples.folderDescription}
        placeholderTextColor={colors.textMuted}
        value={form.description}
        onChangeText={description => setFolderForm({ ...form, description })}
      />
      <View style={styles.formBtnsRow}>
        <Pressable style={styles.cancelBtn} onPress={() => setFolderForm(null)}>
          <Text style={styles.cancelBtnText}>{t('Cancelar')}</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={handleSaveFolder}>
          <CoralSheen />
          <Text style={styles.saveBtnText}>{form.id ? t('Salvar Pasta') : t('Criar Pasta')}</Text>
        </Pressable>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------
  // Tela de Criação / Edição do Produto
  // (Tela dedicada com ScrollView completo, botões nunca cortados)
  // ---------------------------------------------------------------------

  if (productForm) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable
            style={styles.headerBack}
            hitSlop={8}
            onPress={() => {
              if (productForm.imageStoragePath && !productForm.id) {
                deleteUploadedMedia(productForm.imageStoragePath);
              }
              setProductForm(null);
            }}>
            <Icon name="voltar" size={18} color={colors.textMuted} />
            <Text style={styles.backBtnText}>{t('Voltar')}</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {productForm.id ? t('Editar {item}', { item }) : t('Novo {item}', { item })}
          </Text>
          <Pressable style={styles.saveHeaderBtn} onPress={handleSaveProduct}>
            <CoralSheen />
            <Text style={styles.saveHeaderBtnText}>{t('Salvar')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled">

          {/* 1. Categoria */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>{t('Categoria')}</Text>
            {folders.length > 0 ? (
              <View style={styles.categoryChipsRow}>
                {folders.map(f => {
                  const isSelected = productForm.folderId === f.id && !isCreatingNewCategory;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        setIsCreatingNewCategory(false);
                        setProductForm({ ...productForm, folderId: f.id });
                      }}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}>
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                        {f.name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setIsCreatingNewCategory(true)}
                  style={[styles.categoryChip, isCreatingNewCategory && styles.categoryChipSelected]}>
                  <Icon name="adicionar" size={14} color={isCreatingNewCategory ? colors.primaryText : colors.textMuted} />
                  <Text style={[styles.categoryChipText, isCreatingNewCategory && styles.categoryChipTextSelected]}>
                    {t('Nova categoria')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {(isCreatingNewCategory || folders.length === 0) && (
              <TextInput
                style={[styles.input, folders.length > 0 && { marginTop: spacing.sm }]}
                placeholder={t('Nome da nova categoria (ex: Roupas, Imóveis...)')}
                placeholderTextColor={colors.textMuted}
                value={productForm.newCategoryName}
                onChangeText={newCategoryName => setProductForm({ ...productForm, newCategoryName })}
              />
            )}
          </View>

          {/* 2. Nome */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>{t('Nome do {item}', { item })}</Text>
            <TextInput
              style={styles.input}
              placeholder={segment.examples.itemTitle || t('Nome do produto')}
              placeholderTextColor={colors.textMuted}
              value={productForm.title}
              onChangeText={title => setProductForm({ ...productForm, title })}
            />
          </View>

          {/* 3. Preço */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>
              {segment.price.label} ({market.symbol}){segment.price.optional ? t(' — opcional') : ''}
            </Text>
            <MoneyInput digits={productForm.price} onChange={price => setProductForm({ ...productForm, price })} />
            {segment.price.optional && <Text style={styles.hint}>{t('Em branco, a ficha mostra "Sob consulta".')}</Text>}
          </View>

          {/* 4. Descrição */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>{t('Descrição')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={segment.examples.itemDescription || t('Descreva os detalhes do produto...')}
              placeholderTextColor={colors.textMuted}
              multiline
              value={productForm.desc}
              onChangeText={desc => setProductForm({ ...productForm, desc })}
            />
          </View>

          {/* 5. Imagem do produto */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>{t('Imagem do produto')}</Text>

            {productForm.imageUrl ? (
              <View style={styles.imagePreviewBox}>
                <Image source={{ uri: productForm.imageUrl }} style={styles.imagePreview} resizeMode="cover" />
                <View style={styles.imageActionsRow}>
                  <Pressable style={styles.imageActionBtn} onPress={() => pickProductImage('gallery')}>
                    <Icon name="foto" size={16} color={colors.text} />
                    <Text style={styles.imageActionBtnText}>{t('Alterar foto')}</Text>
                  </Pressable>
                  <Pressable style={[styles.imageActionBtn, styles.imageDeleteBtn]} onPress={removeProductImage}>
                    <Icon name="fechar" size={16} color={colors.danger} />
                    <Text style={styles.imageDeleteBtnText}>{t('Remover')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.uploadArea}>
                <SourceButtons
                  disabled={!!uploader.uploading}
                  options={[
                    { key: 'gallery', icon: 'foto', label: t('Galeria'), onPress: () => pickProductImage('gallery') },
                    ...(canUseCamera
                      ? [{ key: 'camera', icon: 'adicionar' as const, label: t('Tirar foto'), onPress: () => pickProductImage('camera') }]
                      : []),
                    { key: 'link', icon: 'compartilhar' as const, label: t('Colar link'), onPress: () => setShowLinkInput(v => !v) },
                  ]}
                />
                <UploadStatus uploading={uploader.uploading} error={uploader.error} />

                {showLinkInput && (
                  <View style={styles.linkRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder={t('Cole o link da imagem (.jpg, .png...)')}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={linkInputUrl}
                      onChangeText={setLinkInputUrl}
                    />
                    <Pressable style={styles.applyLinkBtn} onPress={applyLinkImage}>
                      <Text style={styles.applyLinkBtnText}>{t('Adicionar')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Botões Cancelar e Salvar no fim do formulário com margem e padding seguros */}
          <View style={styles.formBtnsRow}>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => {
                if (productForm.imageStoragePath && !productForm.id) {
                  deleteUploadedMedia(productForm.imageStoragePath);
                }
                setProductForm(null);
              }}>
              <Text style={styles.cancelBtnText}>{t('Cancelar')}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSaveProduct}>
              <CoralSheen />
              <Text style={styles.saveBtnText}>
                {productForm.id ? t('Salvar alterações') : t('Salvar produto')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // 1. Visão de Detalhes do Produto
  // ---------------------------------------------------------------------

  if (folder && product) {
    const photo = product.photos[0];
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => openProduct(null)}>
          <Icon name="voltar" size={18} color={colors.textMuted} />
          <Text style={styles.backBtnText}>{t('Voltar aos {items} de {name}', { items, name: folder.name })}</Text>
        </Pressable>

        <View style={styles.card}>
          {photo?.url ? (
            <Image source={{ uri: photo.url }} style={styles.detailImage} resizeMode="cover" />
          ) : null}

          <Text style={styles.badge}>{folder.name}</Text>
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>{formatPrice(product, segment)}</Text>
          {product.shortDescription ? <Text style={styles.desc}>{product.shortDescription}</Text> : null}

          <View style={styles.formBtnsRow}>
            <Pressable style={styles.cancelBtn} onPress={() => startEditProduct(product, folder.id)}>
              <Text style={styles.cancelBtnText}>{t('Editar')}</Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={() => handleDeleteProduct(product)}>
              <Text style={styles.dangerBtnText}>{t('Excluir')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------
  // 2. Visão de Produtos dentro de uma Pasta (Categoria)
  // ---------------------------------------------------------------------

  if (folder) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Pressable style={styles.headerBack} hitSlop={8} onPress={() => openFolder(null)}>
            <Icon name="voltar" size={18} color={colors.textMuted} />
            <Text style={styles.backBtnText}>{t('Pastas')}</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{folder.name}</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => startCreateProduct(folder.id)}>
            <CoralSheen />
            <Icon name="adicionar" size={18} color={colors.onPrimary} />
            <Text style={styles.addBtnText}>{t('Novo {item}', { item })}</Text>
          </Pressable>
        </View>

        <View style={styles.folderActions}>
          <Pressable
            hitSlop={6}
            onPress={() => {
              setFolderForm({ id: folder.id, name: folder.name, description: folder.description ?? '' });
            }}>
            <Text style={styles.linkText}>{t('Editar pasta')}</Text>
          </Pressable>
          <Pressable hitSlop={6} onPress={() => handleDeleteFolder(folder)}>
            <Text style={styles.deleteText}>{t('Excluir pasta')}</Text>
          </Pressable>
        </View>

        {folderForm && renderFolderForm(folderForm)}

        <FlatList
          data={folder.products}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="arquivos"
              title={t('Nenhum {item} nesta pasta', { item })}
              text={t('Toque em "Novo {item}" e cadastre com preço, descrição e foto.', { item })}
            />
          }
          renderItem={({ item: p }) => (
            <Pressable
              style={styles.itemCard}
              onPress={() => openProduct(p.id)}>
              {p.photos[0]?.url ? (
                <Image source={{ uri: p.photos[0].url }} style={styles.itemThumb} resizeMode="cover" />
              ) : (
                <IconTile name="foto" size={40} />
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{p.title}</Text>
                <Text style={styles.itemSub} numberOfLines={2}>
                  {formatPrice(p, segment)}{p.shortDescription ? ` • ${p.shortDescription}` : ''}
                </Text>
              </View>
              <Icon name="avancar" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // 3. Visão Principal: Lista de Pastas (Categorias)
  // ---------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Voltar')}
              style={({ pressed }) => [styles.headerBackBtn, pressed && styles.pressed]}
              onPress={onBack}
              hitSlop={8}>
              <Icon name="voltar" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          <View>
            <Text style={styles.badge}>{t('Catálogo')}</Text>
            <Text style={styles.headerTitle}>{segment.terms.catalog}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.addBtn}
            onPress={() => startCreateProduct()}>
            <CoralSheen />
            <Icon name="adicionar" size={18} color={colors.onPrimary} />
            <Text style={styles.addBtnText}>{t('Novo {item}', { item })}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryHeaderBtn}
            onPress={() => setFolderForm({ id: null, name: '', description: '' })}>
            <Icon name="novaPasta" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {folderForm && renderFolderForm(folderForm)}

      <FlatList
        data={folders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          folderForm ? null : (
            <EmptyState
              icon="novaPasta"
              title={t('Comece pela primeira pasta')}
              text={t('As pastas organizam seus {items}. {folderName}.', { items, folderName: segment.examples.folderName })}
              actionLabel={t('Criar pasta')}
              onAction={() => setFolderForm({ id: null, name: '', description: '' })}
            />
          )
        }
        renderItem={({ item: f }) => (
          <Pressable
            style={styles.itemCard}
            onPress={() => openFolder(f.id)}>
            <IconTile name="pasta" size={40} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{f.name}</Text>
              <Text style={styles.itemSub}>
                {f.description ? `${f.description} • ` : ''}
                {f.products.length} {f.products.length === 1 ? item : items}
              </Text>
            </View>
            <Icon name="avancar" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: {
    flexShrink: 1,
    ...typography.h2,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    ...typography.overline,
    color: colors.primaryText,
    marginBottom: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.md,
    ...coralGlass(colors),
  },
  addBtnText: {
    ...onCoralText,
    color: colors.onPrimary,
    ...typography.button,
  },
  secondaryHeaderBtn: {
    width: touchTarget,
    height: touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder(colors),
  },
  saveHeaderBtn: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    ...coralGlass(colors),
  },
  saveHeaderBtnText: {
    ...onCoralText,
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  folderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  linkText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.md, minHeight: 32 },
  backBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xs,
  },
  title: { ...typography.h2, color: colors.text },
  price: { fontSize: 18, fontWeight: '700', color: colors.successText },
  desc: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  itemCard: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.md,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  newFolderBox: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: spacing.lg,
    paddingBottom: 60,
    gap: spacing.md,
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: touchTarget,
    fontSize: 15,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder(colors),
  },
  categoryChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  uploadArea: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  imagePreviewBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  imageActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.sm,
  },
  imageActionBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  imageDeleteBtn: {
    backgroundColor: colors.dangerBg,
  },
  imageDeleteBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  applyLinkBtn: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  applyLinkBtnText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  formBtnsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text, ...typography.button },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.md,
    alignItems: 'center',
    ...coralGlass(colors),
  },
  saveBtnText: { color: colors.onPrimary, ...typography.button, ...onCoralText },
  dangerBtn: {
    flex: 1,
    backgroundColor: colors.dangerBg,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dangerBtnText: { color: colors.danger, ...typography.button },
}));
