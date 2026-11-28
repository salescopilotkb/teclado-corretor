/**
 * Skia carregado só quando o app desenha o vidro. O bundle JS é o mesmo do teclado
 * (index.js registra os dois): importar o Skia no topo faria o teclado carregá-lo
 * também. Se o módulo nativo faltar ou o shader não compilar, devolve null e as
 * peças voltam ao vidro desenhado (LiquidSheen).
 */
import { BACKDROP_SKSL, GLASS_SKSL } from './liquidGlassSksl';

type SkiaModule = typeof import('@shopify/react-native-skia');
type Effect = NonNullable<ReturnType<SkiaModule['Skia']['RuntimeEffect']['Make']>>;

export interface GlassSkia {
  skia: SkiaModule;
  backdrop: Effect;
  glass: Effect;
}

let loaded: GlassSkia | null | undefined;

export function loadGlassSkia(): GlassSkia | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  try {
    const skia: SkiaModule = require('@shopify/react-native-skia');
    const backdrop = skia.Skia.RuntimeEffect.Make(BACKDROP_SKSL);
    const glass = skia.Skia.RuntimeEffect.Make(GLASS_SKSL);
    if (backdrop && glass) loaded = { skia, backdrop, glass };
    else console.warn('[liquid glass] o shader não compilou; usando o vidro desenhado');
  } catch (e) {
    console.warn('[liquid glass] Skia indisponível; usando o vidro desenhado', e);
  }
  return loaded;
}
