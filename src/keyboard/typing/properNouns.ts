/**
 * Mapeamento e regras linguísticas avançadas para o corretor do KEYCON:
 *  - Nomes próprios de pessoas brasileiras (comuns)
 *  - Nomes de marcas famosas, apps e serviços (WhatsApp, Instagram, Pix, etc.)
 *  - Palavras com capitalização obrigatória (Deus com D maiúsculo)
 *  - Frases coladas por falha da barra de espaço (split de duas palavras)
 *  - Fonética em pt-BR e coligações contextuais n-gram.
 */
import { toKey } from './lexicon';

/** Palavras com capitalização obrigatória. */
export const ALWAYS_CAPITALIZED: Record<string, string> = {
  deus: 'Deus',
  deuses: 'Deuses',
};

/** Marcas famosas, apps, serviços e redes sociais com grafia oficial. */
export const BRAND_NAMES: Record<string, string> = {
  // Mensagens e Redes Sociais
  whatsapp: 'WhatsApp',
  zap: 'Zap',
  wpp: 'Wpp',
  instagram: 'Instagram',
  insta: 'Insta',
  facebook: 'Facebook',
  face: 'Face',
  tiktok: 'TikTok',
  twitter: 'Twitter',
  telegram: 'Telegram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  reddit: 'Reddit',
  discord: 'Discord',
  twitch: 'Twitch',
  threads: 'Threads',

  // Tecnologia e Dispositivos
  google: 'Google',
  apple: 'Apple',
  iphone: 'iPhone',
  ipad: 'iPad',
  ipod: 'iPod',
  macbook: 'MacBook',
  airpods: 'AirPods',
  android: 'Android',
  microsoft: 'Microsoft',
  windows: 'Windows',
  samsung: 'Samsung',
  motorola: 'Motorola',
  xiaomi: 'Xiaomi',
  sony: 'Sony',
  lg: 'LG',
  dell: 'Dell',
  lenovo: 'Lenovo',
  asus: 'Asus',
  acer: 'Acer',
  hp: 'HP',
  intel: 'Intel',
  amd: 'AMD',
  nvidia: 'Nvidia',
  playstation: 'PlayStation',
  ps4: 'PS4',
  ps5: 'PS5',
  xbox: 'Xbox',
  nintendo: 'Nintendo',

  // Finanças, Bancos e Meios de Pagamento
  pix: 'Pix',
  nubank: 'Nubank',
  nu: 'Nu',
  inter: 'Inter',
  picpay: 'PicPay',
  mercadopago: 'Mercado Pago',
  pagseguro: 'PagSeguro',
  c6: 'C6 Bank',
  c6bank: 'C6 Bank',
  bradesco: 'Bradesco',
  itau: 'Itaú',
  santander: 'Santander',
  caixa: 'Caixa',
  bb: 'Banco do Brasil',
  bancodobrasil: 'Banco do Brasil',
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  hipercard: 'Hipercard',
  amex: 'American Express',
  paypal: 'PayPal',

  // Comércio, Apps e Serviços
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  shein: 'Shein',
  amazon: 'Amazon',
  magalu: 'Magalu',
  magazineluiza: 'Magazine Luiza',
  americanas: 'Americanas',
  aliexpress: 'AliExpress',
  ifood: 'iFood',
  uber: 'Uber',
  rappi: 'Rappi',
  netflix: 'Netflix',
  spotify: 'Spotify',
  prime: 'Prime Video',
  disney: 'Disney',
  hbo: 'HBO',
  max: 'Max',
  globo: 'Globo',
  globoplay: 'Globoplay',

  // Operadoras
  claro: 'Claro',
  vivo: 'Vivo',
  tim: 'Tim',
  oi: 'Oi',

  // Moda, Beleza e Consumo
  nike: 'Nike',
  adidas: 'Adidas',
  puma: 'Puma',
  zara: 'Zara',
  renner: 'Renner',
  riachuelo: 'Riachuelo',
  cea: 'C&A',
  natura: 'Natura',
  boticario: 'Boticário',
  oboticario: 'O Boticário',
  avon: 'Avon',
  jequiti: 'Jequiti',
  eudora: 'Eudora',
  cocacola: 'Coca-Cola',
  pepsi: 'Pepsi',
  ambev: 'Ambev',
  heineken: 'Heineken',
  mcdonalds: "McDonald's",
  burgerking: 'Burger King',
  outback: 'Outback',
  subway: 'Subway',
  cacaushow: 'Cacau Show',
  havan: 'Havan',

  // Veículos
  chevrolet: 'Chevrolet',
  volkswagen: 'Volkswagen',
  fiat: 'Fiat',
  ford: 'Ford',
  toyota: 'Toyota',
  honda: 'Honda',
  hyundai: 'Hyundai',
  renault: 'Renault',
  jeep: 'Jeep',
  bmw: 'BMW',
  mercedes: 'Mercedes',
  audi: 'Audi',
  byd: 'BYD',

  // KEYCON
  keycon: 'KEYCON',
};

/** Nomes de pessoas populares no Brasil. */
export const PEOPLE_NAMES: Record<string, string> = {
  // Masculinos
  lucas: 'Lucas',
  gabriel: 'Gabriel',
  matheus: 'Matheus',
  mateus: 'Mateus',
  rafael: 'Rafael',
  rodrigo: 'Rodrigo',
  leonardo: 'Leonardo',
  guilherme: 'Guilherme',
  felipe: 'Felipe',
  gustavo: 'Gustavo',
  pedro: 'Pedro',
  joao: 'João',
  thiago: 'Thiago',
  tiago: 'Tiago',
  bruno: 'Bruno',
  marcelo: 'Marcelo',
  daniel: 'Daniel',
  eduardo: 'Eduardo',
  henrique: 'Henrique',
  diego: 'Diego',
  vinicius: 'Vinícius',
  caio: 'Caio',
  vitor: 'Vitor',
  victor: 'Victor',
  andre: 'André',
  alexandre: 'Alexandre',
  carlos: 'Carlos',
  fernando: 'Fernando',
  luiz: 'Luiz',
  luis: 'Luís',
  renan: 'Renan',
  arthur: 'Arthur',
  artur: 'Artur',
  igor: 'Igor',
  samuel: 'Samuel',
  bernardo: 'Bernardo',
  murilo: 'Murilo',
  heitor: 'Heitor',
  davi: 'Davi',
  david: 'David',
  lorenzo: 'Lorenzo',
  miguel: 'Miguel',
  benjamin: 'Benjamin',
  enzo: 'Enzo',
  theo: 'Theo',
  caua: 'Cauã',
  breno: 'Breno',
  yuri: 'Yuri',
  otavio: 'Otávio',
  alex: 'Alex',
  jorge: 'Jorge',
  paulo: 'Paulo',
  marcos: 'Marcos',
  marcio: 'Márcio',
  roberto: 'Roberto',
  antonio: 'Antônio',
  jose: 'José',
  francisco: 'Francisco',
  manoel: 'Manoel',
  manuel: 'Manuel',
  sergio: 'Sérgio',
  ricardo: 'Ricardo',
  fabio: 'Fábio',
  cristiano: 'Cristiano',
  anderson: 'Anderson',
  leandro: 'Leandro',
  renato: 'Renato',
  wesley: 'Wesley',
  danilo: 'Danilo',
  denis: 'Denis',
  douglas: 'Douglas',
  everton: 'Everton',
  robson: 'Robson',
  wallace: 'Wallace',
  washington: 'Washington',
  wellington: 'Wellington',
  willian: 'Willian',
  william: 'William',
  jonathan: 'Jonathan',
  jhonatan: 'Jhonatan',
  alan: 'Alan',
  allan: 'Allan',
  alison: 'Alison',
  alisson: 'Alisson',
  hugo: 'Hugo',
  cassio: 'Cássio',
  claudio: 'Cláudio',
  mauricio: 'Maurício',
  cesar: 'César',
  edilson: 'Edilson',
  gilberto: 'Gilberto',
  raul: 'Raul',
  nelson: 'Nelson',
  rogerio: 'Rogério',
  flavio: 'Flávio',
  wilson: 'Wilson',
  vicente: 'Vicente',
  valdir: 'Valdir',
  geraldo: 'Geraldo',
  sebastiao: 'Sebastião',
  raimundo: 'Raimundo',
  severino: 'Severino',
  reginaldo: 'Reginaldo',
  ronaldo: 'Ronaldo',
  romario: 'Romário',
  neymar: 'Neymar',
  martinez: 'Martinez',

  // Femininos
  maria: 'Maria',
  ana: 'Ana',
  juliana: 'Juliana',
  beatriz: 'Beatriz',
  mariana: 'Mariana',
  larissa: 'Larissa',
  camila: 'Camila',
  fernanda: 'Fernanda',
  gabriela: 'Gabriela',
  jessica: 'Jéssica',
  amanda: 'Amanda',
  leticia: 'Letícia',
  bruna: 'Bruna',
  caroline: 'Caroline',
  carolina: 'Carolina',
  vanessa: 'Vanessa',
  luana: 'Luana',
  rafaela: 'Rafaela',
  natalia: 'Natália',
  nathalia: 'Nathalia',
  isabela: 'Isabela',
  isabella: 'Isabella',
  isabelle: 'Isabelle',
  julia: 'Júlia',
  laura: 'Laura',
  sophia: 'Sophia',
  sofia: 'Sofia',
  manuela: 'Manuela',
  manoela: 'Manoela',
  alice: 'Alice',
  heloisa: 'Heloísa',
  valentina: 'Valentina',
  giovanna: 'Giovanna',
  giovana: 'Giovana',
  eduarda: 'Eduarda',
  nicole: 'Nicole',
  helena: 'Helena',
  lorena: 'Lorena',
  yasmin: 'Yasmin',
  vitoria: 'Vitória',
  clarice: 'Clarice',
  clara: 'Clara',
  cecilia: 'Cecília',
  livia: 'Lívia',
  rebeca: 'Rebeca',
  brenda: 'Brenda',
  bianca: 'Bianca',
  debora: 'Débora',
  daniela: 'Daniela',
  danielle: 'Danielle',
  priscila: 'Priscila',
  patricia: 'Patrícia',
  paula: 'Paula',
  aline: 'Aline',
  renata: 'Renata',
  michele: 'Michele',
  michelle: 'Michelle',
  tatiana: 'Tatiana',
  tatiane: 'Tatiane',
  fabiana: 'Fabiana',
  sabrina: 'Sabrina',
  kelly: 'Kelly',
  carla: 'Carla',
  cristiane: 'Cristiane',
  simone: 'Simone',
  adriana: 'Adriana',
  eliane: 'Eliane',
  sandra: 'Sandra',
  luciana: 'Luciana',
  claudia: 'Cláudia',
  rita: 'Rita',
  regina: 'Regina',
  marcia: 'Márcia',
  elisabete: 'Elisabete',
  elizabeth: 'Elizabeth',
  denise: 'Denise',
  solange: 'Solange',
  rosana: 'Rosana',
  marta: 'Marta',
  celia: 'Célia',
  marlene: 'Marlene',
  teresa: 'Teresa',
  tereza: 'Tereza',
  aparecida: 'Aparecida',

  // Sobrenomes comuns
  silva: 'Silva',
  santos: 'Santos',
  oliveira: 'Oliveira',
  souza: 'Souza',
  sousa: 'Sousa',
  rodrigues: 'Rodrigues',
  ferreira: 'Ferreira',
  alves: 'Alves',
  pereira: 'Pereira',
  lima: 'Lima',
  gomes: 'Gomes',
  costa: 'Costa',
  ribeiro: 'Ribeiro',
  martins: 'Martins',
  carvalho: 'Carvalho',
  almeida: 'Almeida',
  lopes: 'Lopes',
  soares: 'Soares',
  fernandes: 'Fernandes',
  vieira: 'Vieira',
  barbosa: 'Barbosa',
  rocha: 'Rocha',
  dias: 'Dias',
  nascimento: 'Nascimento',
  andrade: 'Andrade',
  moreira: 'Moreira',
  nunes: 'Nunes',
  marques: 'Marques',
  machado: 'Machado',
  mendes: 'Mendes',
  freitas: 'Freitas',
  cardoso: 'Cardoso',
  ramos: 'Ramos',
  goncalves: 'Gonçalves',
  santana: 'Santana',
  teixeira: 'Teixeira',
};

/**
 * Frases comuns coladas por falha de tecla de espaço.
 * Mapeia a forma colada para as palavras separadas corretas.
 */
export const COMMON_SPLIT_PHRASES: Record<string, string> = {
  // Saudações e gentilezas
  bomdia: 'bom dia',
  bndia: 'bom dia',
  bodia: 'bom dia',
  boatarde: 'boa tarde',
  btarde: 'boa tarde',
  boanoite: 'boa noite',
  bnoite: 'boa noite',
  comovai: 'como vai',
  cmvai: 'como vai',
  comovc: 'como você',
  comovcs: 'como vocês',
  tudobem: 'tudo bem',
  tudobm: 'tudo bem',
  tdbem: 'tudo bem',
  tdbom: 'tudo bom',
  tudobom: 'tudo bom',
  tudocerto: 'tudo certo',
  tdcerto: 'tudo certo',
  porfavor: 'por favor',
  pfavor: 'por favor',
  muitoobrigado: 'muito obrigado',
  muitoobrigada: 'muito obrigada',
  muitobom: 'muito bom',
  muitoboa: 'muito boa',
  muitobem: 'muito bem',
  valeuamigo: 'valeu amigo',
  valeuamgo: 'valeu amigo',
  valeuamiga: 'valeu amiga',
  valeuamga: 'valeu amiga',
  obrigadodeus: 'obrigado Deus',
  deusemais: 'Deus é mais',
  deusefiel: 'Deus é fiel',
  meuamigo: 'meu amigo',
  minhaamiga: 'minha amiga',

  // Expressões comuns e fé
  comcerteza: 'com certeza',
  concerteza: 'com certeza',
  deacordo: 'de acordo',
  derepente: 'de repente',
  derrepente: 'de repente',
  porisso: 'por isso',
  porissoque: 'por isso que',
  oquefazer: 'o que fazer',
  oquefoi: 'o que foi',
  oquedeu: 'o que deu',
  oquehouve: 'o que houve',
  oqueprecisar: 'o que precisar',
  oqueacha: 'o que acha',
  oqueachou: 'o que achou',
  naosei: 'não sei',
  naoquer: 'não quero',
  naoquero: 'não quero',
  naovai: 'não vai',
  naotem: 'não tem',
  naoda: 'não dá',
  naopode: 'não pode',
  vaidar: 'vai dar',
  vaidarcerto: 'vai dar certo',
  vaicomdeus: 'vai com Deus',
  ficacomdeus: 'fica com Deus',
  fiquedeus: 'fique com Deus',
  deusteabencoe: 'Deus te abençoe',
  deusteabençoe: 'Deus te abençoe',
  deusabençoe: 'Deus abençoe',
  deusabencoe: 'Deus abençoe',
  gracasadeus: 'graças a Deus',
  graçasadeus: 'graças a Deus',
  sedeusquiser: 'se Deus quiser',
  pelamordedeus: 'pelo amor de Deus',
  pelamordeus: 'pelo amor de Deus',
  aiomeudeus: 'ai meu Deus',
  meudeus: 'meu Deus',

  // Negociação, conversa e comércio
  querover: 'quero ver',
  depoisvejo: 'depois vejo',
  depoisfalo: 'depois falo',
  jafalo: 'já falo',
  javejo: 'já vejo',
  jatovendo: 'já tô vendo',
  qualovalor: 'qual o valor',
  qualopreco: 'qual o preço',
  qualopreço: 'qual o preço',
  qualohorario: 'qual o horário',
  qualoseu: 'qual o seu',
  qualasua: 'qual a sua',
  quantoesta: 'quanto está',
  quantocusta: 'quanto custa',
  quantofica: 'quanto fica',
  chavepix: 'chave Pix',
  cartaodecredito: 'cartão de crédito',
  cartaodedebito: 'cartão de débito',
  mercadolivre: 'Mercado Livre',
  mercadopago: 'Mercado Pago',
};

/**
 * Retorna a forma canônica de escrita (ex: "deus" -> "Deus", "whatsapp" -> "WhatsApp", "lucas" -> "Lucas").
 */
export function getProperDisplayForm(word: string): string | undefined {
  const k = toKey(word);
  if (ALWAYS_CAPITALIZED[k]) return ALWAYS_CAPITALIZED[k];
  if (BRAND_NAMES[k]) return BRAND_NAMES[k];
  if (PEOPLE_NAMES[k]) return PEOPLE_NAMES[k];
  return undefined;
}

/**
 * Chave fonética simplificada para pt-BR para capturar erros severos de escrita.
 */
export function getPhoneticKey(word: string): string {
  let s = toKey(word);
  // Remove silent h
  s = s.replace(/^h+/, '').replace(/(.)h+/g, '$1');
  // c, ç, ss, sc, xc, z -> s (quando soa como s)
  s = s.replace(/ss|sc|sç|xc|ç/g, 's');
  s = s.replace(/c(?=[eiy])/g, 's');
  s = s.replace(/c(?=[aou])/g, 'k');
  s = s.replace(/qu(?=[eiy])/g, 'k');
  s = s.replace(/ch/g, 'x');
  s = s.replace(/g(?=[eiy])/g, 'j');
  s = s.replace(/z/g, 's');
  s = s.replace(/m(?=[pb])/g, 'n');
  // Vogais no final comuns em fala informal
  s = s.replace(/i$/g, 'e').replace(/u$/g, 'o');
  // Remove consoantes dobradas
  s = s.replace(/(.)\1+/g, '$1');
  return s;
}

/**
 * Avalia o contexto de múltiplas palavras antes do cursor para dar bônus a candidatos coerentes.
 */
export function getCollocationBoost(contextWords: string[] | undefined, candidateWord: string): number {
  if (!contextWords || contextWords.length === 0) return 0;
  const candKey = toKey(candidateWord);
  const n = contextWords.length;
  const last = contextWords[n - 1];
  const last2 = n >= 2 ? `${contextWords[n - 2]} ${last}` : '';
  const last3 = n >= 3 ? `${contextWords[n - 3]} ${last2}` : '';

  // 1. Fé e Deus
  if (candKey === 'deus') {
    if (last2 === 'graças a' || last2 === 'gracas a') return 25;
    if (last === 'com' || last === 'em' || last === 'por') return 12;
    if (last2 === 'vai com' || last2 === 'fica com' || last2 === 'fique com') return 25;
    if (last2 === 'se deus' || last === 'se') return 15;
    if (last === 'meu' || last2 === 'ai meu') return 18;
    if (last2 === 'amor de') return 18;
  }
  if (candKey === 'quiser' && (last === 'deus' || last2 === 'se deus')) return 20;
  if (candKey === 'abencoe' && (last === 'deus' || last2 === 'deus te')) return 20;

  // 2. Pagamento / Pix
  if (candKey === 'pix') {
    if (last === 'chave' || last === 'via' || last === 'pelo' || last === 'no') return 25;
    if (last2 === 'pagamento via' || last2 === 'pagar no') return 25;
  }

  // 3. Cortesia e saudações
  if (candKey === 'dia' && last === 'bom') return 20;
  if ((candKey === 'tarde' || candKey === 'noite') && last === 'boa') return 20;
  if ((candKey === 'obrigado' || candKey === 'obrigada') && last === 'muito') return 18;
  if (candKey === 'favor' && last === 'por') return 20;
  if ((candKey === 'bem' || candKey === 'certo') && last === 'tudo') return 20;
  if (candKey === 'vai' && last === 'como') return 18;
  if (candKey === 'certeza' && last === 'com') return 20;

  // 4. Concordância de gênero com artigos e pronomes anteriores
  const mascArticles = ['o', 'um', 'meu', 'seu', 'nosso', 'este', 'esse', 'aquele'];
  const femArticles = ['a', 'uma', 'minha', 'sua', 'nossa', 'esta', 'essa', 'aquela'];
  if (mascArticles.includes(last)) {
    if (candidateWord.endsWith('o') || candidateWord.endsWith('os') || candidateWord.endsWith('or')) return 2.0;
  } else if (femArticles.includes(last)) {
    if (candidateWord.endsWith('a') || candidateWord.endsWith('as') || candidateWord.endsWith('ão')) return 2.0;
  }

  // 5. Sujeito e Verbo
  const firstPersonVerbs = ['sei', 'quero', 'posso', 'vou', 'tenho', 'vi', 'fiz', 'sou', 'estou', 'acho', 'consigo', 'entendi'];
  const thirdPersonVerbs = ['sabe', 'quer', 'pode', 'vai', 'tem', 'viu', 'fez', 'é', 'está', 'acha', 'consegue', 'entendeu'];
  if (last === 'eu' || last2 === 'eu nao' || last2 === 'eu não') {
    if (firstPersonVerbs.includes(candidateWord)) return 4.0;
  } else if (['voce', 'você', 'ele', 'ela'].includes(last) || ['voce nao', 'você não'].includes(last2)) {
    if (thirdPersonVerbs.includes(candidateWord)) return 4.0;
  }

  return 0;
}

/**
 * Previsões contextuais para quando o usuário acabou de digitar espaço.
 */
export function getContextualNextPredictions(contextWords: string[] | undefined): string[] {
  if (!contextWords || contextWords.length === 0) return [];
  const n = contextWords.length;
  const last = contextWords[n - 1];
  const last2 = n >= 2 ? `${contextWords[n - 2]} ${last}` : '';

  if (last2 === 'graças a' || last2 === 'gracas a') return ['Deus'];
  if (last2 === 'se deus' || last2 === 'se Deus') return ['quiser'];
  if (last2 === 'vai com' || last2 === 'fica com' || last2 === 'fique com') return ['Deus'];
  if (last2 === 'deus te' || last2 === 'Deus te') return ['abençoe', 'ajude'];
  if (last === 'chave') return ['Pix'];
  if (last === 'bom') return ['dia', 'trabalho'];
  if (last === 'boa') return ['tarde', 'noite', 'viagem'];
  if (last === 'muito') return ['obrigado', 'obrigada', 'bom', 'bem'];
  if (last === 'por') return ['favor', 'isso', 'enquanto'];
  if (last === 'como') return ['vai', 'está', 'você'];
  if (last === 'tudo') return ['bem', 'certo', 'bom'];
  if (last === 'com') return ['certeza', 'você', 'Deus'];
  if (last === 'qual' && contextWords.includes('o')) return ['valor', 'preço', 'prazo'];
  if (last === 'cartão' && contextWords.includes('de')) return ['crédito', 'débito'];

  return [];
}
