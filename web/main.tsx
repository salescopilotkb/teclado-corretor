/**
 * KEYCON — versão web de testes.
 *
 * Roda o código REAL do app e do teclado (react-native-web), com o login real
 * do Supabase. Duas telas, como no celular:
 *   • App: login, catálogo, atalhos e conta;
 *   • WhatsApp + Teclado: conversa de teste com o teclado KEYCON embaixo.
 * Os dados ficam salvos no navegador (localStorage), separados do celular.
 */
import './alertPolyfill';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import App from '../src/app/App';
import CorretorKeyboard from '../src/keyboard/CorretorKeyboard';
import { WebKeyboardHost } from '../src/native/KeyboardBridge.web';
import { appBack } from '../src/navigation/back';
import logoUrl from '../assets/logo-transp-without-slogan.png';
import qrUrl from './qr-keyconapp.svg';

// "Voltar" do celular na página de teste: tecla Esc (teclado na conversa; senão, o app)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!WebKeyboardHost.pressBack()) appBack.handle();
  });
}
import { Repo } from '../src/storage/storage';

if (!Repo.isLoggedIn()) {
  Repo.setAuthToken('test-web-token');
}

const initialSeller = Repo.getSeller();
if (!initialSeller.name || initialSeller.name === 'Alex Morgan') {
  Repo.setSeller({ ...initialSeller, name: 'Rafael Martinez', business: initialSeller.business || 'KEYCON Demo' });
}

type Screen = 'app' | 'chat';

/** *negrito* e _itálico_ como o WhatsApp mostra. */
function formatWhatsApp(text: string): React.ReactNode[] {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) =>
    /^\*[^*]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : /^_[^_]+_$/.test(part) ? <i key={i}>{part.slice(1, -1)}</i> : part,
  );
}

/** Foto da mensagem; se não abrir como imagem, mostra como vídeo. */
function MediaView({ url }: { url: string }) {
  const [video, setVideo] = useState(/\.(mp4|mov|webm|m4v)(\?|$)/i.test(url));
  return video ? <video src={url} controls playsInline /> : <img src={url} alt="" onError={() => setVideo(true)} />;
}

interface Message {
  id: number;
  from: 'client' | 'seller';
  text: string;
  time: string;
  /** Fotos/vídeos da mensagem (a legenda vai em text). */
  media?: string[];
}

const now = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Cliente de exemplo: uma conversa curta de compra, para a apresentação parecer real.
 * As 2 primeiras chegam ao abrir a conversa; cada outra responde a uma mensagem do vendedor.
 */
const BOT_NAME = 'Jessica Miller';
const BOT_OPENING = ['Hi! I saw your products on Instagram 😊', 'Do you have anything available this week?'];
const BOT_REPLIES = ['Nice! Can you send me a photo and the price?', 'Love it! How can I pay?', "Perfect, I'll take it. Thanks! 🙌"];

function Chat({ visible }: { visible: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  /** Cliente de exemplo "digitando…" (mostrado no topo, como no WhatsApp). */
  const [typing, setTyping] = useState(false);
  const botStep = useRef(0);
  const botTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** A cliente digita por um instante e manda a mensagem. */
  const botSay = useCallback((text: string, delay: number) => {
    botTimers.current.push(
      setTimeout(() => setTyping(true), delay),
      setTimeout(() => {
        setTyping(false);
        setMessages(m => [...m, { id: Date.now() + Math.random(), from: 'client', text, time: now() }]);
      }, delay + 1300),
    );
  }, []);
  // Ao abrir a conversa pela 1ª vez: as mensagens de abertura
  const opened = useRef(false);
  useEffect(() => {
    if (!visible || opened.current) return;
    opened.current = true;
    BOT_OPENING.forEach((text, i) => botSay(text, 600 + i * 1700));
  }, [visible, botSay]);
  // Depois de cada mensagem do vendedor, a próxima resposta do roteiro
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.from !== 'seller' || botStep.current >= BOT_REPLIES.length) return;
    botSay(BOT_REPLIES[botStep.current++], 900);
  }, [messages, botSay]);
  useEffect(() => () => botTimers.current.forEach(clearTimeout), []);
  const [draft, setDraft] = useState('');
  /** CRM e Agenda: teclado em tela grande (como no celular). */
  /** Tamanho do teclado pedido pelo KEYCON: normal, intermediário (Atalhos) ou tela grande. */
  const [heightMode, setHeightMode] = useState<'normal' | 'tall' | 'expanded' | 'translate'>('normal');
  useEffect(() => WebKeyboardHost.onExpandedChange(setHeightMode), []);
  /** Altura exata pedida pelo teclado (barrinha de puxar, tradução que cresce); 0 = a do modo. */
  const [customHeight, setCustomHeight] = useState(0);
  const keyboardRef = useRef<HTMLDivElement>(null);
  /** Como no celular: no mínimo o teclado normal (o CSS: 330 px em tela estreita), no máximo a tela grande. */
  const keyboardHeights = useCallback(() => {
    const normal = window.matchMedia('(max-width: 480px)').matches ? 330 : 350;
    const screenHeight = keyboardRef.current?.parentElement?.clientHeight ?? 800;
    return { normal, max: Math.max(normal, screenHeight * 0.97 - 128) };
  }, []);
  useEffect(() => WebKeyboardHost.onCustomHeight(setCustomHeight, keyboardHeights), [keyboardHeights]);
  const customStyle = useMemo(() => {
    if (!customHeight) return undefined;
    const { normal, max } = keyboardHeights();
    return { height: Math.min(Math.max(customHeight, normal), max) };
  }, [customHeight, keyboardHeights]);
  const draftRef = useRef('');
  const caret = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const update = useCallback((value: string, pos: number) => {
    draftRef.current = value;
    caret.current = pos;
    setDraft(value);
  }, []);

  // Mantém o cursor do campo onde o teclado escreveu
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
  }, [draft]);

  const send = useCallback(() => {
    const text = draftRef.current.trim();
    if (!text) return;
    setMessages(m => [...m, { id: Date.now(), from: 'seller', text, time: now() }]);
    update('', 0);
    // Campo vazio de novo: o teclado volta a começar com maiúscula
    WebKeyboardHost.selectionChanged();
  }, [update]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Conecta o campo de mensagem ao teclado KEYCON
  useEffect(
    () =>
      WebKeyboardHost.attach({
        insert(text) {
          const v = draftRef.current;
          const p = Math.min(caret.current, v.length);
          update(v.slice(0, p) + text + v.slice(p), p + text.length);
        },
        deleteBackward() {
          const v = draftRef.current;
          const p = Math.min(caret.current, v.length);
          if (p === 0) return false;
          // Array.from separa por caractere real (emoji inteiro)
          const before = Array.from(v.slice(0, p));
          before.pop();
          const head = before.join('');
          update(head + v.slice(p), head.length);
          return true;
        },
        // No WhatsApp do Android, Enter pula linha; o envio é pelo botão
        enter() {
          this.insert('\n');
        },
        sendMedia(urls, caption) {
          setMessages(m => [...m, { id: Date.now(), from: 'seller', text: caption ?? '', time: now(), media: urls }]);
        },
        textBeforeCursor() {
          return draftRef.current.slice(0, Math.min(caret.current, draftRef.current.length));
        },
      }),
    [update],
  );

  return (
    <div className="chat" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="chat-header">
        <div className="avatar">J</div>
        <div>
          <div className="contact">{BOT_NAME}</div>
          <div className="status">{typing ? 'typing…' : 'online'}</div>
        </div>
      </div>

      <div className="messages" ref={listRef}>
        {messages.map(m => (
          <div key={m.id} className={`bubble ${m.from}${m.media?.length ? ' photo' : ''}`}>
            {m.media?.map((url, i) => <MediaView key={i} url={url} />)}
            {m.text ? <div className="cap">{formatWhatsApp(m.text)}</div> : null}
            <span className="time">{m.time}</span>
          </div>
        ))}
      </div>

      <div className="input-bar">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Message"
          value={draft}
          onFocus={() => {
            WebKeyboardHost.focusDeviceField();
            WebKeyboardHost.selectionChanged();
          }}
          onClick={() => {
            WebKeyboardHost.focusDeviceField();
            WebKeyboardHost.selectionChanged();
          }}
          // Só clique e foco contam como "tocou no campo" (o teclado volta às letras);
          // digitar ou mover o cursor apenas atualiza o contexto
          onChange={e => {
            update(e.target.value, e.target.selectionStart);
            WebKeyboardHost.selectionChanged();
          }}
          onSelect={e => {
            caret.current = e.currentTarget.selectionStart;
            WebKeyboardHost.selectionChanged();
          }}
        />
        <button type="button" onClick={send}>
          Send
        </button>
      </div>

      <div ref={keyboardRef} className={heightMode === 'normal' ? 'keyboard' : `keyboard ${heightMode}`} style={customStyle}>
        <View style={{ flex: 1 }}>
          <CorretorKeyboard />
        </View>
      </div>
    </div>
  );
}

function TestSite() {
  const [screen, setScreen] = useState<Screen>('chat');

  useEffect(() => {
    WebKeyboardHost.onOpenApp(() => setScreen('app'));
  }, []);

  // Ao abrir a conversa o teclado "aparece": recarrega catálogo, atalhos e login
  useEffect(() => {
    Repo.setAuthToken('test-web-token');
    if (screen === 'chat') WebKeyboardHost.show();
    else WebKeyboardHost.hide();
  }, [screen]);

  // Celular no tamanho real (tela 440 x 956), reduzido por inteiro para caber na janela
  useEffect(() => {
    const fit = () => {
      const phone = document.querySelector<HTMLElement>('.iphone');
      if (!phone) return;
      if (window.innerWidth <= 480) {
        phone.style.removeProperty('zoom');
        return;
      }
      const k = Math.min(1, (window.innerHeight - 200) / 982, (window.innerWidth - 32) / 466);
      phone.style.setProperty('zoom', String(Math.max(0.45, k)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="page">
      <header className="top">
        <div>
          <img className="brand-logo" src={logoUrl} alt="KEYCON" />
          <h1>
            Smart keyboard. <span>Organized sales.</span>
          </h1>
        </div>
        <nav>
          <button className={screen === 'app' ? 'active' : ''} onClick={() => setScreen('app')}>
            App
          </button>
          <button className={screen === 'chat' ? 'active' : ''} onClick={() => setScreen('chat')}>
            WhatsApp + Keyboard
          </button>
        </nav>
      </header>

      {/* iPhone 17 Pro Max (laranja cósmico): carcaça com espessura, botões e Dynamic Island */}
      <div className="iphone">
        <i className="btn-action" />
        <i className="btn-vol-up" />
        <i className="btn-vol-down" />
        <i className="btn-power" />
        <i className="btn-camera" />
        <div className="bezel">
      <div className="phone">
        <div className="statusbar" aria-hidden="true">
          <span className="sb-time">9:41</span>
          <span className="island" />
          <span className="sb-icons">
            <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
            <svg viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.2A10.6 10.6 0 0 0 8 .5 10.6 10.6 0 0 0 .5 3.5l1.2 1.2A9 9 0 0 1 8 2.2Zm0 3.4c1.5 0 2.9.6 3.9 1.5l1.2-1.2A7.2 7.2 0 0 0 8 3.9c-2 0-3.8.8-5.1 2l1.2 1.2c1-.9 2.4-1.5 3.9-1.5Zm0 3.4c.6 0 1.2.2 1.6.6L8 11.2 6.4 9.6c.4-.4 1-.6 1.6-.6Z" /></svg>
            <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="20" height="8" rx="2" /><path d="M25 4v4a2 2 0 0 0 0-4Z" opacity=".45" /></svg>
          </span>
        </div>
        {screen === 'app' && (
          <div className="screen">
            <View style={{ flex: 1 }}>
              <App />
            </View>
          </div>
        )}
        <Chat visible={screen === 'chat'} />
        {/* Faixa inferior do iPhone com a barra de início: o teclado não encosta na curva da tela */}
        <div className="homebar" aria-hidden="true" />
      </div>
        </div>
      </div>

      {/* Para a plateia da apresentação: QR Code para a landing (keyconapp.com) */}
      <aside className="qr-card" aria-label="Download KEYCON">
        <b>Download KEYCON for free</b>
        <small>Point your phone camera here</small>
        <img src={qrUrl} width={174} height={174} alt="QR code to keyconapp.com" />
        <div className="qr-url">keyconapp.com</div>
      </aside>

      <p className="note">
        Demo: the keyboard types and sends into this test chat, like on WhatsApp. Nothing is saved: reloading the page
        starts over.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TestSite />);
