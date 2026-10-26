/**
 * "Voltar" do celular (botão ou gesto de arrastar da borda): volta uma tela
 * em vez de fechar o app ou o teclado.
 *
 * Cada tela que tem para onde voltar se registra com useAppBack / useKeyboardBack,
 * passando o que o botão "Voltar" dela já faz. O "voltar" do celular chama a
 * tela aberta por último (a de cima); sem nenhuma, o sistema faz o normal
 * (fecha o app ou o teclado).
 *
 * Duas pilhas separadas: no Android o app e o teclado rodam no mesmo JavaScript,
 * mas o "voltar" de um não pode mexer nas telas do outro.
 */
import { useEffect, useRef } from 'react';

interface Entry {
  handler: () => void;
  enabled: boolean;
}

export interface BackStack {
  /** Chama a tela de cima que tem para onde voltar. false = ninguém voltou. */
  handle(): boolean;
  /** Alguma tela tem para onde voltar agora? */
  isEnabled(): boolean;
  /** Avisa quando passa a ter (ou deixa de ter) para onde voltar. */
  onChange(cb: (enabled: boolean) => void): () => void;
  register(entry: Entry): () => void;
  refresh(): void;
}

function createBackStack(): BackStack {
  const entries: Entry[] = [];
  const listeners = new Set<(enabled: boolean) => void>();
  let last = false;
  const isEnabled = () => entries.some(e => e.enabled);
  const refresh = () => {
    const now = isEnabled();
    if (now === last) return;
    last = now;
    listeners.forEach(cb => cb(now));
  };
  return {
    handle() {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].enabled) {
          entries[i].handler();
          return true;
        }
      }
      return false;
    },
    isEnabled,
    onChange(cb) {
      listeners.add(cb);
      cb(isEnabled());
      return () => {
        listeners.delete(cb);
      };
    },
    register(entry) {
      entries.push(entry);
      return () => {
        const i = entries.indexOf(entry);
        if (i >= 0) entries.splice(i, 1);
        refresh();
      };
    },
    refresh,
  };
}

export const appBack = createBackStack();
export const keyboardBack = createBackStack();

/**
 * Registra a tela na pilha: a ordem é a de quando ela abriu (a mais recente
 * fica em cima). `enabled` liga e desliga sem mudar a posição.
 */
function useBackIn(stack: BackStack, handler: (() => void) | undefined, enabled: boolean) {
  const entry = useRef<Entry>({ handler: () => {}, enabled: false });
  entry.current.handler = handler ?? (() => {});
  useEffect(() => stack.register(entry.current), [stack]);
  useEffect(() => {
    entry.current.enabled = enabled && !!handler;
    stack.refresh();
  });
}

/** Tela do app com para onde voltar (o "voltar" do celular faz o mesmo que o botão Voltar dela). */
export function useAppBack(handler: (() => void) | undefined, enabled = true) {
  useBackIn(appBack, handler, enabled);
}

/** Tela do teclado com para onde voltar (subtela, busca, formulário, painel). */
export function useKeyboardBack(handler: (() => void) | undefined, enabled = true) {
  useBackIn(keyboardBack, handler, enabled);
}
