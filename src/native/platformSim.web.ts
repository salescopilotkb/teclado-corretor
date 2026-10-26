/**
 * Versão web de testes: com "?ios" no endereço, o teclado se comporta como no
 * iPhone (sem galeria nem microfone no teclado, fotos copiadas para colar,
 * sem abrir o app). Serve para testar as telas do iPhone no navegador.
 */
const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';

export const IOS_SIMULATION = /[?&]ios(=|&|$)/.test(search);
