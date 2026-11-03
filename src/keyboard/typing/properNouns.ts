/**
 * Mapeamento e regras linguísticas avançadas para o corretor do KEYCON:
 *  - Nomes próprios de pessoas comuns (Brasil, EUA e hispânicos)
 *  - Nomes de marcas famosas, apps e serviços (WhatsApp, Instagram, Pix, etc.)
 *  - Palavras com capitalização obrigatória (Deus/God/Dios; dias e meses em inglês)
 *  - Frases coladas por falha da barra de espaço (split de duas palavras)
 *  - Fonética em pt-BR e coligações contextuais n-gram (português, inglês e espanhol).
 */
import type { Lang } from '../../i18n';
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


// ── Inglês e espanhol (mercado dos EUA) ─────────────────────────────────────

/** Inglês: Deus, dias, meses, feriados, idiomas e lugares sempre com maiúscula. */
const ALWAYS_CAPITALIZED_EN: Record<string, string> = {
  god: "God",
  jesus: "Jesus",
  christ: "Christ",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
  january: "January",
  february: "February",
  april: "April",
  june: "June",
  july: "July",
  august: "August",
  september: "September",
  october: "October",
  november: "November",
  december: "December",
  christmas: "Christmas",
  easter: "Easter",
  thanksgiving: "Thanksgiving",
  halloween: "Halloween",
  english: "English",
  spanish: "Spanish",
  portuguese: "Portuguese",
  french: "French",
  german: "German",
  italian: "Italian",
  chinese: "Chinese",
  japanese: "Japanese",
  american: "American",
  mexican: "Mexican",
  brazilian: "Brazilian",
  canadian: "Canadian",
  america: "America",
  usa: "USA",
  texas: "Texas",
  florida: "Florida",
  california: "California",
};

/** Nomes de pessoas populares nos EUA (sem os que são palavras comuns: Will, Mark, Rose...). */
const PEOPLE_NAMES_EN: Record<string, string> = {
  james: "James",
  john: "John",
  robert: "Robert",
  michael: "Michael",
  david: "David",
  william: "William",
  richard: "Richard",
  joseph: "Joseph",
  thomas: "Thomas",
  christopher: "Christopher",
  charles: "Charles",
  daniel: "Daniel",
  matthew: "Matthew",
  anthony: "Anthony",
  andrew: "Andrew",
  joshua: "Joshua",
  kevin: "Kevin",
  brian: "Brian",
  steven: "Steven",
  ryan: "Ryan",
  jacob: "Jacob",
  nicholas: "Nicholas",
  eric: "Eric",
  jonathan: "Jonathan",
  justin: "Justin",
  brandon: "Brandon",
  tyler: "Tyler",
  aaron: "Aaron",
  adam: "Adam",
  nathan: "Nathan",
  kyle: "Kyle",
  liam: "Liam",
  noah: "Noah",
  oliver: "Oliver",
  elijah: "Elijah",
  lucas: "Lucas",
  ethan: "Ethan",
  logan: "Logan",
  jackson: "Jackson",
  aiden: "Aiden",
  sebastian: "Sebastian",
  benjamin: "Benjamin",
  samuel: "Samuel",
  alexander: "Alexander",
  jason: "Jason",
  jeffrey: "Jeffrey",
  mary: "Mary",
  patricia: "Patricia",
  jennifer: "Jennifer",
  linda: "Linda",
  elizabeth: "Elizabeth",
  barbara: "Barbara",
  susan: "Susan",
  jessica: "Jessica",
  sarah: "Sarah",
  karen: "Karen",
  nancy: "Nancy",
  lisa: "Lisa",
  betty: "Betty",
  sandra: "Sandra",
  ashley: "Ashley",
  kimberly: "Kimberly",
  emily: "Emily",
  donna: "Donna",
  michelle: "Michelle",
  melissa: "Melissa",
  stephanie: "Stephanie",
  rebecca: "Rebecca",
  laura: "Laura",
  amanda: "Amanda",
  nicole: "Nicole",
  emma: "Emma",
  olivia: "Olivia",
  sophia: "Sophia",
  isabella: "Isabella",
  mia: "Mia",
  charlotte: "Charlotte",
  amelia: "Amelia",
  evelyn: "Evelyn",
  abigail: "Abigail",
  madison: "Madison",
  chloe: "Chloe",
  natalie: "Natalie",
  hannah: "Hannah",
  samantha: "Samantha",
  rachel: "Rachel",
  megan: "Megan",
  lauren: "Lauren",
  jasmine: "Jasmine",
  victoria: "Victoria",
};

/** Espanhol: Deus e países sempre com maiúscula (dias e meses são minúsculos em espanhol). */
const ALWAYS_CAPITALIZED_ES: Record<string, string> = {
  dios: "Dios",
  jesus: "Jesús",
  navidad: "Navidad",
  mexico: "México",
  espana: "España",
  colombia: "Colombia",
  argentina: "Argentina",
  peru: "Perú",
  venezuela: "Venezuela",
  ecuador: "Ecuador",
  guatemala: "Guatemala",
  cuba: "Cuba",
  honduras: "Honduras",
  texas: "Texas",
  florida: "Florida",
  california: "California",
};

/** Nomes de pessoas populares entre hispânicos (sem os que são palavras comuns). */
const PEOPLE_NAMES_ES: Record<string, string> = {
  jose: "José",
  juan: "Juan",
  luis: "Luis",
  carlos: "Carlos",
  jorge: "Jorge",
  miguel: "Miguel",
  antonio: "Antonio",
  francisco: "Francisco",
  javier: "Javier",
  alejandro: "Alejandro",
  fernando: "Fernando",
  ricardo: "Ricardo",
  eduardo: "Eduardo",
  diego: "Diego",
  andres: "Andrés",
  manuel: "Manuel",
  pedro: "Pedro",
  pablo: "Pablo",
  sergio: "Sergio",
  raul: "Raúl",
  roberto: "Roberto",
  daniel: "Daniel",
  david: "David",
  mateo: "Mateo",
  santiago: "Santiago",
  sebastian: "Sebastián",
  nicolas: "Nicolás",
  gabriel: "Gabriel",
  emiliano: "Emiliano",
  leonardo: "Leonardo",
  rodrigo: "Rodrigo",
  gustavo: "Gustavo",
  hector: "Héctor",
  maria: "María",
  guadalupe: "Guadalupe",
  carmen: "Carmen",
  ana: "Ana",
  laura: "Laura",
  isabel: "Isabel",
  patricia: "Patricia",
  elena: "Elena",
  lucia: "Lucía",
  sofia: "Sofía",
  valentina: "Valentina",
  camila: "Camila",
  gabriela: "Gabriela",
  daniela: "Daniela",
  fernanda: "Fernanda",
  mariana: "Mariana",
  andrea: "Andrea",
  alejandra: "Alejandra",
  paula: "Paula",
  natalia: "Natalia",
  veronica: "Verónica",
  adriana: "Adriana",
  claudia: "Claudia",
  monica: "Mónica",
  carolina: "Carolina",
  ximena: "Ximena",
  regina: "Regina",
  valeria: "Valeria",
  isabella: "Isabella",
  marisol: "Marisol",
  yesenia: "Yesenia",
};

/** Marcas conhecidas nos EUA (sem as que são palavras comuns: "face", "target", "visa"...). */
const GLOBAL_BRAND_NAMES: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  twitter: "Twitter",
  telegram: "Telegram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  reddit: "Reddit",
  gmail: "Gmail",
  icloud: "iCloud",
  facetime: "FaceTime",
  google: "Google",
  iphone: "iPhone",
  ipad: "iPad",
  macbook: "MacBook",
  airpods: "AirPods",
  android: "Android",
  microsoft: "Microsoft",
  samsung: "Samsung",
  motorola: "Motorola",
  xiaomi: "Xiaomi",
  sony: "Sony",
  lenovo: "Lenovo",
  nvidia: "Nvidia",
  playstation: "PlayStation",
  ps5: "PS5",
  xbox: "Xbox",
  nintendo: "Nintendo",
  paypal: "PayPal",
  venmo: "Venmo",
  zelle: "Zelle",
  cashapp: "Cash App",
  mastercard: "Mastercard",
  amex: "American Express",
  amazon: "Amazon",
  ebay: "eBay",
  etsy: "Etsy",
  walmart: "Walmart",
  costco: "Costco",
  shein: "Shein",
  aliexpress: "AliExpress",
  uber: "Uber",
  lyft: "Lyft",
  doordash: "DoorDash",
  instacart: "Instacart",
  airbnb: "Airbnb",
  netflix: "Netflix",
  spotify: "Spotify",
  hulu: "Hulu",
  disney: "Disney",
  hbo: "HBO",
  starbucks: "Starbucks",
  mcdonalds: "McDonald's",
  cocacola: "Coca-Cola",
  pepsi: "Pepsi",
  nike: "Nike",
  adidas: "Adidas",
  zara: "Zara",
  toyota: "Toyota",
  honda: "Honda",
  hyundai: "Hyundai",
  chevrolet: "Chevrolet",
  volkswagen: "Volkswagen",
  tesla: "Tesla",
  bmw: "BMW",
  audi: "Audi",
  chatgpt: "ChatGPT",
  keycon: "KEYCON",
};

/** Marcas do mundo hispânico. */
const BRAND_NAMES_ES: Record<string, string> = {
  mercadolibre: "Mercado Libre",
  bbva: "BBVA",
  oxxo: "OXXO",
  telcel: "Telcel",
  movistar: "Movistar",
};

/** Inglês: expressões coladas por falha do espaço. */
const COMMON_SPLIT_PHRASES_EN: Record<string, string> = {
  goodmorning: "good morning",
  goodafternoon: "good afternoon",
  goodevening: "good evening",
  thankyou: "thank you",
  thanku: "thank you",
  thanksalot: "thanks a lot",
  howareyou: "how are you",
  seeyou: "see you",
  seeyousoon: "see you soon",
  letme: "let me",
  letmeknow: "let me know",
  ofcourse: "of course",
  alot: "a lot",
  atleast: "at least",
  rightnow: "right now",
  noproblem: "no problem",
  aswell: "as well",
  eachother: "each other",
  talktoyou: "talk to you",
  haveaniceday: "have a nice day",
  haveagreatday: "have a great day",
  creditcard: "credit card",
  debitcard: "debit card",
  phonenumber: "phone number",
  emailaddress: "email address",
  iam: "I am",
  iwill: "I will",
  ican: "I can",
};

/** Espanhol: expressões coladas por falha do espaço. */
const COMMON_SPLIT_PHRASES_ES: Record<string, string> = {
  buenosdias: "buenos días",
  buendia: "buen día",
  buenastardes: "buenas tardes",
  buenasnoches: "buenas noches",
  comoestas: "cómo estás",
  comoesta: "cómo está",
  quetal: "qué tal",
  muchasgracias: "muchas gracias",
  porfavor: "por favor",
  denada: "de nada",
  hastaluego: "hasta luego",
  hastapronto: "hasta pronto",
  hastamanana: "hasta mañana",
  nosvemos: "nos vemos",
  estabien: "está bien",
  todobien: "todo bien",
  alomejor: "a lo mejor",
  sinembargo: "sin embargo",
  otravez: "otra vez",
  congusto: "con gusto",
  tarjetadecredito: "tarjeta de crédito",
  tarjetadedebito: "tarjeta de débito",
  mercadolibre: "Mercado Libre",
};

/** Grafia certa de cada idioma (nomes, marcas e palavras com maiúscula). */
const PROPER_FORMS_BY_LANG: Record<Lang, Array<Record<string, string>>> = {
  pt: [ALWAYS_CAPITALIZED, BRAND_NAMES, PEOPLE_NAMES],
  en: [ALWAYS_CAPITALIZED_EN, GLOBAL_BRAND_NAMES, PEOPLE_NAMES_EN],
  es: [ALWAYS_CAPITALIZED_ES, GLOBAL_BRAND_NAMES, BRAND_NAMES_ES, PEOPLE_NAMES_ES],
};

/** Nomes, marcas e palavras com maiúscula do idioma (entram no dicionário com boa relevância). */
export function properEntriesFor(lang: Lang): string[] {
  return PROPER_FORMS_BY_LANG[lang].flatMap(map => Object.values(map));
}

const SPLIT_BY_LANG: Record<Lang, Record<string, string>> = {
  pt: COMMON_SPLIT_PHRASES,
  en: COMMON_SPLIT_PHRASES_EN,
  es: COMMON_SPLIT_PHRASES_ES,
};

/** Expressões coladas conhecidas do idioma ("bomdia", "thankyou", "buenosdias"). */
export function splitPhrasesFor(lang: Lang): Record<string, string> {
  return SPLIT_BY_LANG[lang];
}

/**
 * Retorna a forma canônica de escrita no idioma (ex: "deus" -> "Deus", "whatsapp" -> "WhatsApp",
 * "james" -> "James", "jose" -> "José").
 */
export function getProperDisplayForm(lang: Lang, word: string): string | undefined {
  const k = toKey(word);
  for (const map of PROPER_FORMS_BY_LANG[lang]) if (map[k]) return map[k];
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
export function getCollocationBoost(lang: Lang, contextWords: string[] | undefined, candidateWord: string): number {
  if (!contextWords || contextWords.length === 0) return 0;
  if (lang === 'en') return collocationEn(contextWords, candidateWord);
  if (lang === 'es') return collocationEs(contextWords, candidateWord);
  return collocationPt(contextWords, candidateWord);
}

/** Inglês: saudações, cortesia, "credit card", sujeito e verbo ("I am", "you are"). */
function collocationEn(contextWords: string[], candidateWord: string): number {
  const cand = toKey(candidateWord);
  const n = contextWords.length;
  const last = contextWords[n - 1].toLowerCase();
  const last2 = n >= 2 ? `${contextWords[n - 2].toLowerCase()} ${last}` : '';
  if (last === 'good' && ['morning', 'afternoon', 'evening', 'night', 'luck'].includes(cand)) return 20;
  if (last === 'thank' && cand === 'you') return 22;
  if (last === 'thanks' && ['for', 'again'].includes(cand)) return 10;
  if (last === 'see' && cand === 'you') return 18;
  if (last === 'let' && cand === 'me') return 18;
  if (last2 === 'let me' && cand === 'know') return 20;
  if ((last2 === 'have a' || last2 === 'have a nice') && ['nice', 'great', 'good', 'day', 'weekend'].includes(cand)) return 14;
  if ((last === 'credit' || last === 'debit') && cand === 'card') return 22;
  if (last === 'phone' && cand === 'number') return 18;
  if (last2 === 'looking forward' && cand === 'to') return 20;
  if (last2 === 'talk to' && cand === 'you') return 16;
  if (last === 'of' && cand === 'course' && n >= 2) return 6;
  if (last === 'oh' && cand === 'god') return 14;
  if (last === 'thank' && cand === 'god') return 10;
  // Sujeito e verbo
  if (last === 'i' && ['am', 'have', 'will', 'can', 'think', 'want', 'need', 'know'].includes(cand)) return 4;
  if (['you', 'we', 'they'].includes(last) && ['are', 'have', 'were', 'can', 'will'].includes(cand)) return 4;
  if (['he', 'she', 'it'].includes(last) && ['is', 'has', 'was', 'can', 'will'].includes(cand)) return 4;
  return 0;
}

/** Espanhol: saudações, cortesia, "tarjeta de crédito", sujeito e verbo ("yo soy", "tú eres"). */
function collocationEs(contextWords: string[], candidateWord: string): number {
  const cand = toKey(candidateWord);
  const n = contextWords.length;
  const last = toKey(contextWords[n - 1]);
  const last2 = n >= 2 ? `${toKey(contextWords[n - 2])} ${last}` : '';
  if (last === 'buenos' && cand === 'dias') return 22;
  if (last === 'buen' && ['dia', 'viaje', 'trabajo'].includes(cand)) return 16;
  if (last === 'buenas' && ['tardes', 'noches'].includes(cand)) return 22;
  if (last === 'muchas' && cand === 'gracias') return 22;
  if (last === 'por' && cand === 'favor') return 20;
  if (last === 'hasta' && ['luego', 'pronto', 'manana'].includes(cand)) return 18;
  if (last === 'como' && ['estas', 'esta', 'estan'].includes(cand)) return 16;
  if (last === 'que' && cand === 'tal') return 12;
  if (last === 'todo' && ['bien', 'bueno'].includes(cand)) return 16;
  if (last === 'con' && cand === 'gusto') return 16;
  if (last === 'nos' && cand === 'vemos') return 16;
  if (last2 === 'gracias a' && cand === 'dios') return 25;
  if (last2 === 'tarjeta de' && ['credito', 'debito'].includes(cand)) return 22;
  if (last2 === 'sin embargo' || (last === 'sin' && cand === 'embargo')) return 12;
  // Sujeito e verbo
  if (last === 'yo' && ['soy', 'estoy', 'tengo', 'quiero', 'puedo', 'voy', 'se', 'creo'].includes(cand)) return 4;
  if (['tu', 'vos'].includes(last) && ['eres', 'estas', 'tienes', 'quieres', 'puedes', 'vas'].includes(cand)) return 4;
  if (['el', 'ella', 'usted'].includes(last) && ['es', 'esta', 'tiene', 'quiere', 'puede', 'va'].includes(cand)) return 4;
  return 0;
}

/** Português: Deus, Pix, cortesia, concordância e sujeito e verbo. */
function collocationPt(contextWords: string[], candidateWord: string): number {
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
export function getContextualNextPredictions(lang: Lang, contextWords: string[] | undefined): string[] {
  if (!contextWords || contextWords.length === 0) return [];
  if (lang === 'en') return nextPredictionsEn(contextWords);
  if (lang === 'es') return nextPredictionsEs(contextWords);
  return nextPredictionsPt(contextWords);
}

/** Inglês: a próxima palavra depois de "good", "thank", "let me", "credit"... */
function nextPredictionsEn(contextWords: string[]): string[] {
  const n = contextWords.length;
  const last = contextWords[n - 1].toLowerCase();
  const last2 = n >= 2 ? `${contextWords[n - 2].toLowerCase()} ${last}` : '';
  if (last2 === 'let me') return ['know'];
  if (last2 === 'have a') return ['great', 'nice', 'good'];
  if (last2 === 'talk to') return ['you'];
  if (last2 === 'looking forward') return ['to'];
  if (last === 'good') return ['morning', 'afternoon', 'night'];
  if (last === 'thank') return ['you', 'God'];
  if (last === 'thanks') return ['for', 'again', 'so'];
  if (last === 'see') return ['you'];
  if (last === 'let') return ['me', 'us'];
  if (last === 'how') return ['are', 'much', 'is'];
  if (last === 'credit' || last === 'debit') return ['card'];
  if (last === 'phone') return ['number'];
  return [];
}

/** Espanhol: a próxima palavra depois de "buenos", "muchas", "por", "hasta"... */
function nextPredictionsEs(contextWords: string[]): string[] {
  const n = contextWords.length;
  const last = toKey(contextWords[n - 1]);
  const last2 = n >= 2 ? `${toKey(contextWords[n - 2])} ${last}` : '';
  if (last2 === 'gracias a') return ['Dios'];
  if (last2 === 'tarjeta de') return ['crédito', 'débito'];
  if (last === 'buenos') return ['días'];
  if (last === 'buen') return ['día', 'viaje', 'trabajo'];
  if (last === 'buenas') return ['tardes', 'noches'];
  if (last === 'muchas') return ['gracias'];
  if (last === 'por') return ['favor', 'eso', 'supuesto'];
  if (last === 'hasta') return ['luego', 'pronto', 'mañana'];
  if (last === 'como') return ['estás', 'está', 'te'];
  if (last === 'que') return ['tal'];
  if (last === 'todo') return ['bien'];
  if (last === 'con') return ['gusto'];
  if (last === 'nos') return ['vemos'];
  return [];
}

/** Português: Deus, Pix, cortesia e "cartão de crédito". */
function nextPredictionsPt(contextWords: string[]): string[] {
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
