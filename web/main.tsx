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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import App from '../src/app/App';
import CorretorKeyboard from '../src/keyboard/CorretorKeyboard';
import { WebKeyboardHost } from '../src/native/KeyboardBridge.web';
import { Repo } from '../src/storage/storage';

if (!Repo.isLoggedIn()) {
  Repo.setAuthToken('test-web-token');
}

type Screen = 'app' | 'chat';

interface Message {
  id: number;
  from: 'client' | 'seller';
  text: string;
  time: string;
}

const now = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Chat({ visible }: { visible: boolean }) {
  // Conversa de teste vazia: nada de exemplo pronto
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  /** CRM e Agenda: teclado em tela grande (como no celular). */
  /** Tamanho do teclado pedido pelo KEYCON: normal, intermediário (Atalhos) ou tela grande. */
  const [heightMode, setHeightMode] = useState<'normal' | 'tall' | 'expanded'>('normal');
  useEffect(() => WebKeyboardHost.onExpandedChange(setHeightMode), []);
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
        textBeforeCursor() {
          return draftRef.current.slice(0, Math.min(caret.current, draftRef.current.length));
        },
      }),
    [update],
  );

  return (
    <div className="chat" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="chat-header">
        <div className="avatar">T</div>
        <div>
          <div className="contact">Conversa de teste</div>
          <div className="status">toque no campo para abrir o teclado</div>
        </div>
      </div>

      <div className="messages" ref={listRef}>
        {messages.map(m => (
          <div key={m.id} className={`bubble ${m.from}`}>
            {m.text}
            <span className="time">{m.time}</span>
          </div>
        ))}
      </div>

      <div className="input-bar">
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Mensagem"
          value={draft}
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
          Enviar
        </button>
      </div>

      <div className={heightMode === 'normal' ? 'keyboard' : `keyboard ${heightMode}`}>
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

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>KEYCON</h1>
          <p>Versão de testes no navegador</p>
        </div>
        <nav>
          <button className={screen === 'app' ? 'active' : ''} onClick={() => setScreen('app')}>
            App
          </button>
          <button className={screen === 'chat' ? 'active' : ''} onClick={() => setScreen('chat')}>
            WhatsApp + Teclado
          </button>
        </nav>
      </header>

      <div className="phone">
        {screen === 'app' && (
          <div className="screen">
            <View style={{ flex: 1 }}>
              <App />
            </View>
          </div>
        )}
        <Chat visible={screen === 'chat'} />
      </div>

      <p className="note">
        Demonstração: o teclado escreve na conversa de teste. Fotos e áudios são enviados como link; envio de arquivos e a
        troca para outros teclados funcionam só no aplicativo Android.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TestSite />);
