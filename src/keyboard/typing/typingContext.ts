/**
 * Cópia local do texto antes do cursor — de onde saem a palavra atual (para
 * as sugestões) e o "começo de frase" (para a maiúscula automática).
 *
 * Perguntar ao campo de texto a cada tecla seria lento (é uma chamada ao
 * sistema). Então o teclado atualiza a cópia sozinho a cada letra e só
 * relê o campo quando o cursor muda por fora: a pessoa tocou no meio do
 * texto, colou algo, enviou a mensagem, trocou de conversa...
 */
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { InputContext, SelectionChangeEvent } from '../../native/KeyboardBridge';

const MAX_CONTEXT = 200;
/** No iOS o aviso de mudança vem sem posição: relê depois de uma pausa. */
const RESYNC_DELAY_MS = 120;

const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

// Tipos de campo do Android (EditorInfo.inputType)
const CLASS_TEXT = 0x1;
const NO_ASSIST_VARIATIONS = new Set([0x10, 0x20, 0x80, 0x90, 0xb0, 0xd0, 0xe0]); // link, e-mail, busca, senhas
const FLAG_NO_SUGGESTIONS = 0x80000;
/** Campo de nome: cada palavra começa com maiúscula ("Joana Lima"). */
const FLAG_CAP_WORDS = 0x2000;

export class TypingContext {
  private before = '';
  private inputType = CLASS_TEXT;
  /** Muda a cada edição local: uma releitura antiga é descartada. */
  private version = 0;
  /** Posição conhecida do cursor (Android) e as posições que nossas edições ainda vão gerar. */
  private cursor: number | null = null;
  private expected: number[] = [];
  private resyncTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * `readContext`: de onde reler o texto (o campo do app em foco, por padrão,
   * ou um campo do próprio teclado — ver TextSink no TypingKeyboard).
   */
  constructor(
    private readonly onChange: () => void,
    private readonly readContext: () => Promise<InputContext> = () => KeyboardBridge.getInputContext(),
  ) {}

  /** Palavra que está sendo digitada (letras logo antes do cursor). */
  currentWord(): string {
    let i = this.before.length;
    while (i > 0 && (LETTER.test(this.before[i - 1]) || this.before[i - 1] === '-')) i--;
    return this.before.slice(i).replace(/^-+/, '');
  }

  /**
   * Palavra anterior à atual, em minúsculas, para o corretor entender a frase.
   * "^" quando a atual começa a frase (campo vazio, depois de . ! ? ou de uma
   * quebra de linha); undefined quando antes dela vem outra coisa (número, link).
   */
  previousWord(): string | undefined {
    const head = this.before.slice(0, this.before.length - this.currentWord().length);
    if (head.trim() === '' || /[.!?…]\s*$/.test(head) || /\n\s*$/.test(head)) return '^';
    const m = /([A-Za-zÀ-ÖØ-öø-ÿ]+(?:-[A-Za-zÀ-ÖØ-öø-ÿ]+)*)[\s,]+$/.exec(head);
    return m ? m[1].toLowerCase() : undefined;
  }

  /** A palavra atual começa a frase (maiúscula ali é só a automática, não um nome). */
  wordStartsSentence(): boolean {
    return this.previousWord() === '^';
  }

  /** O texto logo antes do cursor termina com `text`? */
  endsWith(text: string): boolean {
    return this.before.endsWith(text);
  }

  /** Último caractere antes do cursor ('' se o campo está vazio). */
  lastChar(): string {
    return this.before.slice(-1);
  }

  /**
   * Começo de mensagem, de linha ou de frase (depois de . ! ?) → maiúscula.
   * Em campo de nome, também o começo de cada palavra.
   */
  atSentenceStart(): boolean {
    if (!this.allowsAutoCapital()) return false;
    const b = this.before;
    if ((this.inputType & FLAG_CAP_WORDS) !== 0 && /(^|\s)$/.test(b)) return true;
    return b.trim() === '' || /[.!?…]\s+$/.test(b) || /\n\s*$/.test(b);
  }

  /** E-mail, link e senha não ganham maiúscula automática. */
  allowsAutoCapital(): boolean {
    const t = this.inputType;
    if (t === 0) return true;
    return (t & 0xf) === CLASS_TEXT && !NO_ASSIST_VARIATIONS.has(t & 0xff0);
  }

  allowsSuggestions(): boolean {
    return this.allowsAutoCapital() && (this.inputType & FLAG_NO_SUGGESTIONS) === 0;
  }

  // ── Edições feitas pelo próprio teclado ───────────────────────────────

  insert(text: string) {
    this.apply(this.before + text, text.length);
  }

  /** Apaga 1 caractere (um emoji inteiro conta como 1). */
  deleteOne() {
    const chars = Array.from(this.before);
    const removed = chars.pop() ?? '';
    this.apply(chars.join(''), -removed.length);
  }

  /** Troca os `count` caracteres antes do cursor por `text` (sugestão escolhida). */
  replace(count: number, text: string) {
    this.apply(this.before.slice(0, this.before.length - count) + text, text.length - count);
  }

  private apply(next: string, delta: number) {
    this.before = next.slice(-MAX_CONTEXT);
    this.version++;
    if (this.cursor !== null) {
      this.cursor += delta;
      this.expected.push(this.cursor);
    }
  }

  // ── Sincronização com o campo de texto ────────────────────────────────

  /** Relê o campo (teclado abriu, trocou de campo ou o cursor mudou por fora). */
  resync() {
    const asked = this.version;
    this.readContext()
      .then(ctx => {
        // Digitou enquanto a resposta vinha: a cópia local é mais nova
        if (this.version !== asked) return;
        this.before = (ctx.before ?? '').slice(-MAX_CONTEXT);
        this.inputType = ctx.inputType ?? CLASS_TEXT;
        this.onChange();
      })
      .catch(() => {});
  }

  /** Campo novo (o teclado abriu): esquece o que sabia do campo anterior. */
  reset() {
    this.before = '';
    this.cursor = null;
    this.expected = [];
    this.version++;
    this.resync();
  }

  /** Aviso do sistema de que o cursor mudou. */
  onSelectionChange(e: SelectionChangeEvent) {
    if (typeof e.start !== 'number') {
      this.scheduleResync();
      return;
    }
    const at = this.expected.indexOf(e.start);
    if (at >= 0) {
      // Foi uma edição nossa: nada a reler
      this.expected.splice(0, at + 1);
      return;
    }
    // Cursor andou por fora (toque no texto, colar, enviar a mensagem)
    this.cursor = e.start;
    this.expected = [];
    this.scheduleResync();
  }

  private scheduleResync() {
    if (this.resyncTimer) clearTimeout(this.resyncTimer);
    this.resyncTimer = setTimeout(() => {
      this.resyncTimer = null;
      this.resync();
    }, RESYNC_DELAY_MS);
  }

  dispose() {
    if (this.resyncTimer) clearTimeout(this.resyncTimer);
  }
}
