/**
 * Páginas públicas do Locker (abrem SEM login), servidas pela função "locker-public":
 *   /f/<código>                → um arquivo: a prévia e o botão Baixar
 *   /d/<código>[?pasta=<id>]   → uma pasta compartilhada "com o link" ou "pública"
 * São os links que o app e o teclado mandam para os clientes.
 */
import React, { useEffect, useState } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/config/supabase';
import { formatBytes } from '../../src/files/limits';
import { getLanguage, t } from '../../src/i18n';
import { fileType, lockerLink } from './data';
import type { LockerFile } from './data';
import { Icon, TypeIcon } from './icons';
import { LanguagePicker } from './LanguagePicker';
import { Preview } from './Preview';
import { demoPublic, PREVIEW } from './demo';

/** Rota pública do endereço atual (null = não é página pública). */
export function publicRoute(): { kind: 'f' | 'd'; token: string } | null {
  const m = /^\/(f|d)\/([a-f0-9]{32})\/?$/.exec(location.pathname);
  return m ? { kind: m[1] as 'f' | 'd', token: m[2] } : null;
}

type PublicFileInfo = { name: string; kind: string; mime: string; size: number; createdAt: string; url: string; download: string };
type PublicFolderInfo = {
  folder: { id: string; name: string; root: { name: string } };
  path: Array<{ id: string; name: string }>;
  folders: Array<{ id: string; name: string }>;
  files: Array<PublicFileInfo & { link: string }>;
};

async function callPublic<T>(query: string): Promise<T | 'not_found' | 'error'> {
  if (PREVIEW) return demoPublic(query) as T;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/locker-public?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (res.status === 404) return 'not_found';
    if (!res.ok) return 'error';
    return (await res.json()) as T;
  } catch {
    return 'error';
  }
}

/** O formato do Locker para reaproveitar a prévia (só leitura). */
function asLockerFile(f: PublicFileInfo, token: string): LockerFile {
  return {
    id: token,
    user_id: '',
    folder_id: null,
    name: f.name,
    kind: f.kind,
    mime: f.mime,
    size_bytes: f.size,
    storage: 'link',
    object_key: '',
    url: f.url,
    duration: null,
    position: 0,
    in_keyboard: true,
    starred: false,
    trashed_at: null,
    created_at: f.createdAt,
    updated_at: f.createdAt,
    share_token: token,
  };
}

/** Baixa pelo link com o nome do arquivo (o navegador salva direto). */
function downloadFrom(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copy(text: string, onDone: (msg: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    onDone(t('Link copiado'));
  } catch {
    onDone(t('Não foi possível copiar. Selecione o link e copie à mão.'));
  }
}

export function PublicPage({ route }: { route: { kind: 'f' | 'd'; token: string } }) {
  return route.kind === 'f' ? <PublicFile token={route.token} /> : <PublicFolder token={route.token} />;
}

// -----------------------------------------------------------------------------
// Moldura: marca KEYCON em cima, o conteúdo, e o convite discreto embaixo
// -----------------------------------------------------------------------------
function Shell({ title, actions, children, toast }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; toast?: string }) {
  return (
    <div className="pub">
      <header className="pub-top">
        <a className="brand" href="https://keyconapp.com" target="_blank" rel="noreferrer">
          <img src="/k-mark.png" alt="" width={32} height={32} />
          <span>Locker</span>
        </a>
        {title ? <h1 className="pub-title">{title}</h1> : <span className="pub-title" />}
        <div className="pub-actions">
          {actions}
        </div>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot muted">
        <LanguagePicker compact />
        <br />
        {t('Compartilhado pelo Locker da KEYCON.')}{' '}
        <a href="https://keyconapp.com" target="_blank" rel="noreferrer">
          keyconapp.com
        </a>
      </footer>
      {toast ? (
        <div className="toast" role="status">
          <span className="toast-text">{toast}</span>
        </div>
      ) : null}
    </div>
  );
}

function Gone() {
  return (
    <div className="empty">
      <Icon name="link" size={44} />
      <p>{t('Este link não existe mais ou foi desativado por quem compartilhou.')}</p>
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty">
      <Icon name="cloudOff" size={44} />
      <p>{t('Não foi possível abrir agora. Confira a internet e tente de novo.')}</p>
      <button className="btn" onClick={onRetry}>
        {t('Tentar de novo')}
      </button>
    </div>
  );
}

function useToast(): [string, (msg: string) => void] {
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return [toast, setToast];
}

// -----------------------------------------------------------------------------
// /f/<código>: um arquivo
// -----------------------------------------------------------------------------
function PublicFile({ token }: { token: string }) {
  const [info, setInfo] = useState<PublicFileInfo | 'not_found' | 'error' | null>(null);
  const [toast, setToast] = useToast();
  const load = () => {
    setInfo(null);
    callPublic<PublicFileInfo>(`f=${token}&info=1`).then(setInfo);
  };
  useEffect(load, [token]);

  if (!info) {
    return (
      <Shell>
        <div className="splash inline">
          <span className="spinner" />
        </div>
      </Shell>
    );
  }
  if (info === 'not_found') return <Shell>{<Gone />}</Shell>;
  if (info === 'error') return <Shell>{<Failed onRetry={load} />}</Shell>;

  document.title = `${info.name} · Locker`;
  const type = fileType({ mime: info.mime, kind: info.kind, name: info.name });
  const actions = (
    <>
      <button className="icon-btn" aria-label={t('Copiar link')} title={t('Copiar link')} onClick={() => copy(lockerLink('f', token), setToast)}>
        <Icon name="link" />
      </button>
      <button className="btn primary pub-download" onClick={() => downloadFrom(info.download)}>
        <Icon name="download" size={18} />
        <span>{t('Baixar')}</span>
      </button>
    </>
  );
  return (
    <Shell title={info.name} actions={actions} toast={toast}>
      <div className="pub-file">
        {type === 'image' ? (
          <img className="pub-media" src={info.url} alt={info.name} />
        ) : type === 'video' ? (
          <video className="pub-media" src={info.url} controls playsInline />
        ) : type === 'audio' ? (
          <div className="pv-audio">
            <TypeIcon type="audio" size={64} />
            <span className="pv-audio-name">{info.name}</span>
            <audio src={info.url} controls />
          </div>
        ) : type === 'pdf' || info.mime.startsWith('text/') ? (
          <iframe className="pub-frame" src={info.url} title={info.name} />
        ) : (
          <div className="pv-none">
            <TypeIcon type={type} size={56} />
            <p>{t('Este tipo de arquivo não tem prévia.')}</p>
            <button className="btn primary" onClick={() => downloadFrom(info.download)}>
              <Icon name="download" size={18} />
              {t('Baixar')}
            </button>
          </div>
        )}
        <p className="pub-meta muted">
          {info.name} · {formatBytes(info.size, getLanguage())}
        </p>
      </div>
    </Shell>
  );
}

// -----------------------------------------------------------------------------
// /d/<código>: uma pasta (e as subpastas dela)
// -----------------------------------------------------------------------------
function PublicFolder({ token }: { token: string }) {
  const [sub, setSub] = useState<string | null>(() => new URLSearchParams(location.search).get('pasta'));
  const [data, setData] = useState<PublicFolderInfo | 'not_found' | 'error' | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useToast();

  const load = () => {
    setData(null);
    callPublic<PublicFolderInfo>(`d=${token}${sub ? `&sub=${encodeURIComponent(sub)}` : ''}`).then(setData);
  };
  useEffect(load, [token, sub]);

  // Voltar do navegador entre as subpastas
  useEffect(() => {
    const onPop = () => setSub(new URLSearchParams(location.search).get('pasta'));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const open = (id: string | null) => {
    history.pushState(null, '', id ? `?pasta=${encodeURIComponent(id)}` : location.pathname);
    setSub(id);
  };

  if (!data) {
    return (
      <Shell>
        <div className="splash inline">
          <span className="spinner" />
        </div>
      </Shell>
    );
  }
  if (data === 'not_found') return <Shell>{<Gone />}</Shell>;
  if (data === 'error') return <Shell>{<Failed onRetry={load} />}</Shell>;

  document.title = `${data.folder.root.name} · Locker`;
  const files = data.files.map(f => asLockerFile(f, f.link.replace(/^f\//, '')));
  const downloads = new Map(data.files.map(f => [f.link.replace(/^f\//, ''), f.download || f.url]));
  const lang = getLanguage();

  return (
    <Shell
      title={data.folder.root.name}
      toast={toast}
      actions={
        <button className="icon-btn" aria-label={t('Copiar link')} title={t('Copiar link')} onClick={() => copy(lockerLink('d', token), setToast)}>
          <Icon name="link" />
        </button>
      }>
      <div className="pub-folder">
        {data.path.length ? (
          <ol className="crumbs" aria-label={t('Caminho')}>
            <li>
              <button className="crumb" onClick={() => open(null)}>
                {data.folder.root.name}
              </button>
            </li>
            {data.path.map((p, i) => (
              <li key={p.id}>
                <Icon name="chevron" size={18} className="crumb-sep" />
                <button className={`crumb ${i === data.path.length - 1 ? 'current' : ''}`} onClick={() => open(p.id)}>
                  {p.name || t('Sem nome')}
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {!data.folders.length && !data.files.length ? (
          <div className="empty">
            <Icon name="drive" size={44} />
            <p>{t('Esta pasta está vazia.')}</p>
          </div>
        ) : null}

        {data.folders.length ? (
          <section aria-label={t('Pastas')}>
            <h2 className="group-title">{t('Pastas')}</h2>
            <div className="folder-grid">
              {data.folders.map(f => (
                <button key={f.id} className="folder-card item" onClick={() => open(f.id)}>
                  <TypeIcon type="folder" size={22} />
                  <span className="name">{f.name || t('Sem nome')}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {files.length ? (
          <section aria-label={t('Arquivos')}>
            <h2 className="group-title">{t('Arquivos')}</h2>
            <div className="file-grid">
              {files.map(f => {
                const type = fileType(f);
                return (
                  <button key={f.id} className="file-card item" onClick={() => setPreview(f.id)}>
                    <span className="file-card-head">
                      <TypeIcon type={type} size={18} />
                      <span className="name">{f.name}</span>
                    </span>
                    {type === 'image' ? (
                      <img className="thumb" src={f.url} alt="" loading="lazy" />
                    ) : type === 'video' ? (
                      <video className="thumb" src={`${f.url}#t=0.5`} preload="metadata" muted playsInline />
                    ) : (
                      <span className="thumb thumb-icon">
                        <TypeIcon type={type} size={48} />
                      </span>
                    )}
                    <span className="pub-card-meta muted">{formatBytes(Number(f.size_bytes) || 0, lang)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      {preview ? (
        <Preview
          files={files}
          startId={preview}
          onClose={() => setPreview(null)}
          onDownload={f => downloadFrom(downloads.get(f.id) ?? f.url)}
          onCopyLink={f => copy(lockerLink('f', f.share_token), setToast)}
          onShare={f =>
            navigator.share
              ? navigator.share({ title: f.name, url: lockerLink('f', f.share_token) }).catch(() => undefined)
              : copy(lockerLink('f', f.share_token), setToast)
          }
        />
      ) : null}
    </Shell>
  );
}
