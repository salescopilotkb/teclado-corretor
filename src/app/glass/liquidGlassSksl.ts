/**
 * Liquid glass em SkSL (shaders do Skia), adaptado do componente <liquid-glass> de
 * zerowing — https://github.com/MuhammadaliMS/liquid-glass (MIT © zerowing), v1.1.1:
 * src/core/scene.frag (a aurora do fundo) e src/core/glass.frag (o vidro).
 *
 * O web component traça todas as peças num só canvas WebGL sobre uma textura do
 * fundo. No app cada peça de vidro tem o próprio canvas Skia e o fundo é calculado
 * no próprio shader (a mesma aurora, nas cores do KEYCON), então a peça "vê" o fundo
 * exato que está atrás dela, sem textura e sem ler a tela:
 *  - BACKDROP_SKSL desenha a aurora na tela inteira (atrás de tudo);
 *  - GLASS_SKSL desenha uma peça: cada pixel lança um raio que entra na placa de
 *    vidro (retângulo arredondado com a face abaulada), refrata, atravessa,
 *    reflete por dentro se não puder sair, refrata de novo e cai na aurora atrás.
 *    Por isso o fundo aumenta, vira e se curva na borda.
 *
 * Diferenças do original: uma peça por shader; sem textura (o "fosco" usa a aurora
 * sem as linhas de contorno); sem lente, puxão para o ponteiro e brilho com som.
 */

/** A aurora: quatro manchas de cor dobradas por ruído, com linhas de contorno finas
 *  (são elas que dão "bordas" para o vidro entortar). Cores em sRGB, 0–1. */
const AURORA = `
uniform float2 uScene;   // tamanho da cena (pt)
uniform float uTime;     // fase da aurora (fixa no app: não fica redesenhando)
uniform float3 uBase;
uniform float3 uC0;
uniform float3 uC1;
uniform float3 uC2;
uniform float3 uC3;
uniform float uLines;    // força das linhas de contorno (0–0.6)
uniform float uDim;      // escurece o fundo (0–0.9)

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), f.x), mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), f.x), f.y);
}

float fbm(float2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) { value += amplitude * noise(p); p = p * 2.03 + 11.7; amplitude *= 0.5; }
  return value;
}

float3 spot(float3 color, float3 tint, float2 p, float fi, float t, float2 aspect) {
  float2 center = float2(0.6 + 1.1 * sin(t * (1.0 + fi * 0.37) + fi * 1.9), 0.55 + 0.75 * cos(t * (0.8 + fi * 0.29) + fi * 2.6));
  center *= aspect;
  float reach = exp(-dot(p - center, p - center) * 1.15);
  return mix(color, tint, clamp(reach * 1.25, 0.0, 1.0));
}

// lines = 1: com as linhas de contorno; 0: só as cores (o fundo "fosco")
float3 aurora(float2 pixel, float lines) {
  float2 q = pixel / max(uScene.x, uScene.y) * 2.4;
  float t = uTime * 0.045;
  float2 warp = float2(fbm(q + float2(t, -t * 0.7)), fbm(q + float2(-t * 0.6, t) + 5.2));
  float2 p = q + warp * 1.35;
  float2 aspect = float2(max(uScene.x / uScene.y, 1.0), max(uScene.y / uScene.x, 1.0)) * 1.2;
  float3 color = uBase;
  color = spot(color, uC0, p, 0.0, t, aspect);
  color = spot(color, uC1, p, 1.0, t, aspect);
  color = spot(color, uC2, p, 2.0, t, aspect);
  color = spot(color, uC3, p, 3.0, t, aspect);
  if (lines > 0.5 && uLines > 0.001) {
    float height = fbm(p * 1.6 + t);
    float band = abs(fract(height * 14.0) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.07, band);
    color = mix(color, color * 1.35 + 0.06, line * uLines);
  }
  return color * (1.0 - uDim);
}
`;

export const BACKDROP_SKSL = `${AURORA}
half4 main(float2 xy) {
  return half4(half3(clamp(aurora(xy, 1.0), 0.0, 1.0)), 1.0);
}
`;

export const GLASS_SKSL = `${AURORA}
uniform float2 uOrigin;   // canto de cima do canvas da peça, nas coordenadas da cena
uniform float2 uCenter;   // centro da peça, na cena
uniform float2 uHalf;     // meia largura, meia altura
uniform float uRadius;    // raio dos cantos
uniform float uFrost;     // 0 limpo, 1 fosco
uniform float uChroma;    // separação de cor
uniform float4 uTint;     // rgb + força
uniform float4 uProfile;  // meia espessura, arredondamento da borda, domo, índice de refração
uniform float2 uLight;    // posição da luz, na cena
uniform float uShadow;    // sombra 0–1
uniform float uPress;     // brilho extra ao tocar 0–1
uniform float uDpr;       // pixels por ponto (borda sem serrilhado)

const float CAMERA = 780.0;
const float BACKGROUND = -190.0;

float3 sceneColor(float2 pixel, float frost) {
  float3 clear = pow(clamp(aurora(pixel, 1.0), 0.0, 1.0), float3(2.2));
  if (frost < 0.01) return clear;
  float3 blurred = pow(clamp(aurora(pixel, 0.0), 0.0, 1.0), float3(2.2));
  return mix(clear, blurred, clamp(frost, 0.0, 1.0));
}

float box(float2 p, float2 halfSize, float radius) {
  float2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float outline(float2 p) {
  return box(p, uHalf, min(uRadius, min(uHalf.x, uHalf.y)));
}

float3 field(float2 p) {
  float d = outline(p);
  float2 e = float2(0.5, 0.0);
  float2 n = float2(outline(p + e.xy) - outline(p - e.xy), outline(p + e.yx) - outline(p - e.yx));
  return float3(d, normalize(n + 1e-6));
}

// Extrusão arredondada com a face abaulada; o gradiente é do mesmo sólido.
float4 solid(float3 p) {
  float3 boundary = field(p.xy);
  float2 radius = max(uHalf, float2(20.0));
  float dome = uProfile.z * exp(-1.5 * dot(p.xy / radius, p.xy / radius));
  float2 domeGradient = -3.0 * dome * p.xy / (radius * radius);
  float rounding = uProfile.y;
  float2 q = float2(boundary.x + rounding, abs(p.z) - uProfile.x - dome + rounding);
  float2 outside = max(q, 0.0);
  float outsideLength = length(outside);
  float2 weights = outsideLength > 0.0001 ? outside / outsideLength : (q.x > q.y ? float2(1.0, 0.0) : float2(0.0, 1.0));
  float distance = min(max(q.x, q.y), 0.0) + outsideLength - rounding;
  float3 gradient = weights.x * float3(boundary.yz, 0.0) + weights.y * float3(-domeGradient, sign(p.z));
  return float4(distance, gradient);
}

bool enterSolid(float3 origin, float3 direction, out float3 hit) {
  hit = origin;
  float3 bounds = float3(uHalf + 6.0, uProfile.x + uProfile.z + 10.0);
  float3 inverseRay = 1.0 / (direction + float3(0.000001));
  float3 a = (-bounds - origin) * inverseRay;
  float3 b = (bounds - origin) * inverseRay;
  float3 nearBox = min(a, b);
  float3 farBox = max(a, b);
  float nearDistance = max(max(nearBox.x, nearBox.y), nearBox.z);
  float farDistance = min(min(farBox.x, farBox.y), farBox.z);
  float travel = max(0.0, nearDistance);
  if (farDistance < travel) return false;
  for (int i = 0; i < 56; i++) {
    hit = origin + direction * travel;
    float distance = solid(hit).x;
    if (distance < 0.12) return true;
    travel += max(0.06, distance * 0.74);
    if (travel > farDistance) return false;
  }
  return false;
}

float3 exitSolid(float3 origin, float3 direction, out float traveled) {
  float travel = 0.6;
  float3 point = origin + direction * travel;
  float limit = 2.0 * (uHalf.x + uHalf.y) + 2.0 * uProfile.x;
  for (int i = 0; i < 48; i++) {
    point = origin + direction * travel;
    float distance = -solid(point).x;
    if (i > 1 && distance < 0.12) break;
    travel += max(0.10, distance * 0.74);
    if (travel > limit) break;
  }
  traveled = travel;
  return point;
}

float3 environment(float3 direction, float2 pixel) {
  float2 reflectedPixel = uScene * 0.5 + direction.xy * uScene * 0.42;
  float3 reflectedScene = sceneColor(reflectedPixel, 0.9);
  float softbox = exp(-pow((direction.x + 0.42) / 0.16, 2.0) - pow((direction.y + 0.58) / 0.28, 4.0));
  float fill = exp(-pow((direction.x - 0.7) / 0.10, 2.0) - pow(direction.y / 0.55, 4.0));
  return mix(reflectedScene, sceneColor(pixel, 0.65), 0.20) + float3(0.96, 0.98, 1.0) * (softbox * 1.65 + fill * 0.32);
}

half4 main(float2 fragCoord) {
  float2 pixel = uOrigin + fragCoord;
  float2 local = pixel - uCenter;
  float radius = min(uRadius, min(uHalf.x, uHalf.y));
  float nearest = box(local, uHalf, radius);

  // Sombra da peça sobre o fundo (preto translúcido por cima da aurora)
  float lift = min(uHalf.y, 40.0);
  float s = box(local - float2(2.0, lift * 0.22), uHalf, radius);
  float shade = (1.0 - smoothstep(-lift * 0.3, lift * 0.8, s)) * uShadow * 0.16;
  if (nearest > 2.0) return half4(0.0, 0.0, 0.0, shade);

  float3 origin = float3(0.0, 0.0, CAMERA);
  float3 viewRay = normalize(float3(local, -CAMERA));
  float3 direction = viewRay;
  float3 front;
  if (!enterSolid(origin, direction, front)) {
    float contact = (1.0 - smoothstep(-2.0, 13.0, outline(local - float2(2.0, 7.0)))) * 0.045;
    return half4(0.0, 0.0, 0.0, 1.0 - (1.0 - shade) * (1.0 - contact));
  }
  float3 normal = normalize(solid(front).yzw);
  float ior = uProfile.w;
  float3 inside = refract(direction, normal, 1.0 / ior);
  float pathLength;
  float3 rear = exitSolid(front, inside, pathLength);
  float3 rearNormal = normalize(solid(rear).yzw);
  float3 outgoing = refract(inside, -rearNormal, ior);
  // Um reflexo interno em vez de uma faixa escura onde a primeira saída reflete toda a luz
  if (dot(outgoing, outgoing) < 0.01) {
    inside = reflect(inside, rearNormal);
    float secondLength;
    rear = exitSolid(rear, inside, secondLength);
    pathLength += secondLength;
    rearNormal = normalize(solid(rear).yzw);
    outgoing = refract(inside, -rearNormal, ior);
    if (dot(outgoing, outgoing) < 0.01) outgoing = reflect(inside, rearNormal);
  }
  float3 reflected = environment(reflect(viewRay, normal), pixel);
  float3 transmitted;
  if (outgoing.z < -0.045) {
    float distance = (BACKGROUND - rear.z) / outgoing.z;
    float2 backgroundPoint = (rear.xy + outgoing.xy * distance) * CAMERA / (CAMERA - BACKGROUND);
    float2 rayPixel = uCenter + backgroundPoint;
    float2 displacement = clamp(rayPixel - pixel, float2(-180.0), float2(180.0));
    float grazing = 1.0 - max(dot(normal, -viewRay), 0.0);
    float filtering = clamp(grazing * grazing * 1.6 + length(displacement) / 300.0 + uFrost, 0.02, 0.92);
    float3 green = sceneColor(pixel + displacement, filtering);
    if (uChroma > 0.0005) {
      float3 red = sceneColor(pixel + displacement * (1.0 - uChroma), filtering);
      float3 blue = sceneColor(pixel + displacement * (1.0 + uChroma), filtering);
      transmitted = float3(red.r, green.g, blue.b);
    } else {
      transmitted = green;
    }
  } else {
    transmitted = environment(outgoing, pixel);
  }
  transmitted *= exp(-float3(0.00032, 0.00015, 0.00007) * min(pathLength, 250.0));
  transmitted = mix(transmitted, pow(uTint.rgb, float3(2.2)), uTint.a);

  float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(normal, -viewRay), 0.0), 5.0);
  float3 color = mix(transmitted, reflected, fresnel);
  float3 toLight = normalize(float3(uLight - uCenter - front.xy, 500.0));
  float3 halfVector = normalize(toLight - viewRay);
  color += float3(0.97, 0.985, 1.0) * pow(max(dot(normal, halfVector), 0.0), 160.0) * (0.04 + uPress * 0.10);
  color *= 1.0 + uPress * 0.06;

  float coverage = max(clamp(0.5 - nearest * uDpr, 0.0, 1.0), step(nearest, -1.0));
  float3 srgb = pow(clamp(color, 0.0, 1.0), float3(1.0 / 2.2));
  return half4(half3(srgb * coverage), coverage + (1.0 - coverage) * shade);
}
`;

/** Espessura, arredondamento e domo de uma peça (as mesmas contas do original). */
export function glassProfile(width: number, height: number, opts: { depth?: number; dome?: number; ior?: number } = {}) {
  const half = Math.min(width, height) / 2;
  const depth = Math.min(44, Math.max(half * 0.36, Math.min(half * 0.7, 14))) * (opts.depth ?? 1);
  return {
    depth,
    rounding: Math.min(depth * 0.73, half * 0.9),
    dome: depth * 0.48 * (opts.dome ?? 1),
    ior: opts.ior ?? 1.38,
  };
}
