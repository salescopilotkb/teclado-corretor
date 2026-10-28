/* KEYCON · landing page */

// Versão dos arquivos: troque a cada publicação para o navegador não usar imagens antigas
// (a mesma usada no ?v= de index.html)
var ASSET_VERSION = '2026102808';

// ── Preencha aqui quando tiver os links ────────────────────────────────
// Enquanto um link das lojas estiver vazio, o botão mostra "Em breve".
// Sem e-mail, o botão "Fale com a gente" fica escondido.
var CONFIG = {
  googlePlayUrl: '',  // ex.: 'https://play.google.com/store/apps/details?id=com.keycon.app'
  appStoreUrl: '',    // ex.: 'https://apps.apple.com/app/idXXXXXXXXXX'
  contactEmail: '',   // ex.: 'contato@suaempresa.com'
  // Lista de espera: tabela "waitlist" do Supabase do app (supabase/schema.sql).
  // A chave "anon" é pública (a mesma do app) e só permite SE INSCREVER;
  // ninguém lê a lista pelo site. NUNCA coloque aqui a chave "service_role".
  waitlist: {
    url: 'https://ldobmaflbrqruqfalkvi.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkb2JtYWZsYnJxcnVxZmFsa3ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzEwOTEsImV4cCI6MjEwODEwNzA5MX0.k1WcYVSUeLarzNLIMC5lx0f-_8Citgajgu13KV2w1iw',
  },
};

// ── Textos em português e espanhol (o inglês está no próprio HTML) ─────
var I18N = {
  pt: {
    "skip": "Pular para o conteúdo",
    "nav.features": "Recursos",
    "nav.how": "Como funciona",
    "nav.faq": "Perguntas",
    "nav.cta": "Quero acesso antecipado",
    "hero.eyebrow": "Teclado inteligente para vender",
    "hero.title": "Seu negócio na ponta dos dedos.",
    "hero.lead": "O KEYCON é o teclado do seu celular com seus produtos, mensagens prontas e clientes dentro dele. Responda e envie tudo sem sair da conversa, no WhatsApp ou em qualquer app.",
    "store.soon": "Em breve na",
    "hero.note": "Para Android e iPhone. Em português, inglês e espanhol.",
    "strip.1a": "Funciona em qualquer app",
    "strip.1b": "de conversa, e-mail ou rede social",
    "strip.2a": "Um toque para enviar",
    "strip.2b": "produto, foto, áudio ou texto",
    "strip.3a": "Substitui o teclado do celular",
    "strip.3b": "com correção e sugestões de palavras",
    "feat.eyebrow": "Recursos",
    "feat.title": "Tudo o que você usa para vender, a um toque do teclado",
    "tab.products.t": "Produtos",
    "tab.products.d": "Seu catálogo com fotos, preço e descrição. Toque em Usar e a ficha vai para a conversa.",
    "tab.shortcuts.t": "Atalhos",
    "tab.shortcuts.d": "Respostas prontas em texto, áudio e link: Pix, horário, entrega, trocas.",
    "tab.crm.t": "Clientes (CRM)",
    "tab.crm.d": "Cada cliente numa etapa da venda, com notas, etiquetas e o botão Conversar.",
    "tab.translate.t": "Tradução",
    "tab.translate.d": "Escreva no seu idioma e a mensagem entra traduzida. A tradução roda no próprio celular.",
    "more.eyebrow": "E tem mais",
    "more.title": "Um teclado completo, pensado para o dia a dia de quem atende",
    "card.ai.t": "Respostas com IA",
    "card.ai.d": "Copie a mensagem do cliente e receba sugestões de resposta no tom do seu negócio.",
    "card.files.t": "Arquivos",
    "card.files.d": "Fotos, vídeos e áudios organizados em pastas, prontos para mandar.",
    "card.agenda.t": "Agenda",
    "card.agenda.d": "Visitas, reuniões e retornos marcados sem sair do teclado.",
    "card.spell.t": "Correção e sugestões",
    "card.spell.d": "Corretor ortográfico e sugestões de palavras em português, inglês e espanhol, para usar o dia todo.",
    "card.segment.t": "Do jeito do seu ramo",
    "card.segment.d": "Escolha seu ramo e o KEYCON ajusta os campos dos produtos, as etapas do CRM e o tom da IA.",
    "card.privacy.t": "Seus dados com você",
    "card.privacy.d": "O que você digita é processado no próprio celular. Catálogo, clientes e agenda ficam guardados no aparelho.",
    "seg.eyebrow": "Para quem vende",
    "seg.title": "Para qualquer produto ou serviço",
    "seg.retail": "Lojas e varejo",
    "seg.realestate": "Imobiliárias",
    "seg.insurance": "Seguros",
    "seg.food": "Restaurantes",
    "seg.beauty": "Beleza e estética",
    "seg.vehicles": "Veículos",
    "seg.legal": "Advocacia",
    "seg.general": "E qualquer outro negócio",
    "how.eyebrow": "Como funciona",
    "how.title": "Pronto em três passos",
    "how.1t": "Cadastre no app",
    "how.1d": "Crie sua conta, escolha seu ramo e cadastre produtos, fotos, atalhos e clientes.",
    "how.2t": "Ative o teclado",
    "how.2d": "O próprio app mostra o caminho para ligar o KEYCON nos ajustes do celular.",
    "how.3t": "Venda na conversa",
    "how.3d": "Abra qualquer conversa, toque no menu do teclado e envie o que o cliente pediu.",
    "faq.eyebrow": "Perguntas frequentes",
    "faq.title": "Dúvidas comuns",
    "faq.1q": "Funciona no WhatsApp?",
    "faq.1a": "Sim. O KEYCON é um teclado, então funciona em qualquer app em que você digita: WhatsApp, Instagram, Messenger, e-mail e outros.",
    "faq.2q": "Funciona no Android e no iPhone?",
    "faq.2a": "Sim. No iPhone, por regra da Apple, fotos e vídeos são copiados pelo teclado e você cola na conversa com um toque.",
    "faq.3q": "Preciso trocar o teclado do meu celular?",
    "faq.3a": "O KEYCON pode ser o seu teclado do dia a dia, com correção e sugestões. Se quiser, volte para o teclado do sistema a qualquer momento pelo botão do globo no menu.",
    "faq.4q": "O KEYCON lê o que eu digito?",
    "faq.4a": "Não. O que você digita é processado só no celular, para corrigir e sugerir palavras. Só vai para o servidor a mensagem que você copia e pede para a IA responder.",
    "faq.5q": "Em quais idiomas funciona?",
    "faq.5a": "O app e o teclado estão em português, inglês e espanhol. O tradutor do teclado também traduz para francês, italiano e alemão.",
    "cta.title": "Seu catálogo inteiro cabe no teclado.",
    "cta.lead": "O KEYCON chega em breve à Google Play e à App Store.",
    "cta.button": "Fale com a gente",
    "foot.privacy": "Política de Privacidade",
    "foot.terms": "Termos de Uso",
    "foot.note": "WhatsApp, Instagram e Messenger são marcas da Meta. O KEYCON não é afiliado à Meta.",
    "hero.alt": "Teclado KEYCON aberto numa conversa, com o menu de Arquivos, Produtos, Atalhos, Agenda e CRM acima das letras",
    "panel.products": "Aba Produtos do teclado com uma pasta de vestidos, preços e o botão Usar",
    "panel.shortcuts": "Aba Atalhos do teclado com respostas prontas de Pix, horário e entrega",
    "panel.crm": "CRM do teclado com clientes separados por etapa da venda",
    "panel.translate": "Tradutor do teclado: texto em português entra em inglês no campo da mensagem",
    "store.get": "Disponível no",
    "store.download": "Baixar na",
    "cta.leadLive": "Baixe o KEYCON e comece a vender pelo teclado.",
    "meta.title": "KEYCON · Teclado inteligente para vender",
    "nav.ctaLive": "Quero o KEYCON",
    "wl.platform": "Seu celular",
    "wl.emailLabel": "E-mail",
    "wl.placeholder": "voce@seunegocio.com.br",
    "wl.submit": "Avise-me",
    "wl.sending": "Enviando…",
    "wl.note": "Um e-mail quando o KEYCON chegar ao seu celular. Sem spam.",
    "wl.doneTitle": "Você está na lista.",
    "wl.doneText": "Vamos avisar em {email} quando o KEYCON chegar ao {platform}.",
    "wl.reset": "Usar outro e-mail",
    "wl.errEmail": "Digite um e-mail como nome@seunegocio.com.br.",
    "wl.errPlatform": "Escolha iPhone ou Android.",
    "wl.errNetwork": "Não deu para salvar seu e-mail. Confira a internet e tente de novo.",
    "story.1t": "O cliente pergunta",
    "story.1d": "no WhatsApp ou em qualquer app",
    "story.2t": "Toque em Produtos",
    "story.2d": "seu catálogo abre no teclado",
    "story.3t": "Toque em Usar e envie",
    "story.3d": "a foto vai com preço e detalhes",
    "story.alt1": "Uma cliente pede uma casa de 4 quartos com quintal na conversa, com o teclado KEYCON aberto",
    "story.alt2": "O teclado lista as casas à venda com foto, preço e o botão Usar",
    "story.alt3": "A foto da casa chega na conversa com o preço, o bairro, os quartos e os banheiros embaixo",
    "story.pause": "Pausar a demonstração",
    "story.play": "Reproduzir a demonstração",
    "nav.privacy": "Privacidade",
    "priv.title": "O que você digita fica no seu celular",
    "priv.lead": "Um teclado vê tudo o que você digita. Aqui está exatamente o que sai do seu celular e o que nunca sai.",
    "priv.stayT": "Fica no seu celular",
    "priv.stay1": "Tudo o que você digita. É processado no celular para corrigir palavras e sugerir as próximas, e nunca é guardado nem enviado.",
    "priv.stay2": "Seus produtos, atalhos, clientes, agenda e pastas de arquivos.",
    "priv.stay3": "As traduções, que rodam no próprio celular.",
    "priv.goT": "Vai para os nossos servidores",
    "priv.go1": "Sua conta e seu perfil: e-mail, nome, nome do negócio, WhatsApp e ramo.",
    "priv.go2": "Fotos, vídeos e áudios que você envia, guardados como links públicos para poderem ir nas conversas.",
    "priv.go3": "Só quando você pede uma resposta à IA: a mensagem do cliente que você copiou, com o nome do seu negócio e os produtos relacionados.",
    "priv.iosT": "No iPhone, por que o Acesso Total?",
    "priv.iosD": "O iOS pede Acesso Total a todo teclado que usa a internet e avisa que ele poderia enviar o que você digita. O KEYCON precisa dele para as respostas com IA, para ler seu catálogo do app e para copiar fotos para você colar. O que você digita continua sendo processado só no celular.",
    "priv.sell": "Nós nunca vendemos seus dados.",
    "priv.link": "Ler a Política de Privacidade",
    "faq.6q": "Quanto custa?",
    "faq.6a": "O KEYCON será uma assinatura mensal. Os preços serão anunciados no lançamento.",
    "intro.t1": "Teclado inteligente.",
    "intro.t2": "Vendas organizadas.",
    "intro.next": "Veja como funciona",
  },
  es: {
    "skip": "Ir al contenido",
    "nav.features": "Funciones",
    "nav.how": "Cómo funciona",
    "nav.faq": "Preguntas",
    "nav.cta": "Quiero acceso anticipado",
    "hero.eyebrow": "Teclado inteligente para vender",
    "hero.title": "Tu negocio en la punta de los dedos.",
    "hero.lead": "KEYCON es el teclado de tu celular con tus productos, mensajes listos y clientes dentro. Responde y envía todo sin salir de la conversación, en WhatsApp o en cualquier app.",
    "hero.note": "Para Android y iPhone. En español, portugués e inglés.",
    "hero.alt": "Teclado KEYCON abierto en una conversación, con el menú de Archivos, Productos, Atajos, Agenda y CRM sobre las letras",
    "store.soon": "Muy pronto en",
    "store.get": "Disponible en",
    "store.download": "Descárgalo en",
    "strip.1a": "Funciona en cualquier app",
    "strip.1b": "de chat, correo o redes sociales",
    "strip.2a": "Un toque para enviar",
    "strip.2b": "producto, foto, audio o texto",
    "strip.3a": "Reemplaza el teclado del celular",
    "strip.3b": "con corrector y sugerencias de palabras",
    "feat.eyebrow": "Funciones",
    "feat.title": "Todo lo que usas para vender, a un toque del teclado",
    "tab.products.t": "Productos",
    "tab.products.d": "Tu catálogo con fotos, precio y descripción. Toca Usar y la ficha va a la conversación.",
    "tab.shortcuts.t": "Atajos",
    "tab.shortcuts.d": "Respuestas listas en texto, audio y enlace: pago, horario, entrega, cambios.",
    "tab.crm.t": "Clientes (CRM)",
    "tab.crm.d": "Cada cliente en una etapa de la venta, con notas, etiquetas y el botón Conversar.",
    "tab.translate.t": "Traducción",
    "tab.translate.d": "Escribe en tu idioma y el mensaje entra traducido. La traducción funciona en el propio celular.",
    "panel.products": "Pestaña Productos del teclado con una carpeta de vestidos, precios y el botón Usar",
    "panel.shortcuts": "Pestaña Atajos del teclado con respuestas listas",
    "panel.crm": "CRM del teclado con clientes separados por etapa de la venta",
    "panel.translate": "Traductor del teclado: el texto escrito en español entra en inglés en el mensaje",
    "more.eyebrow": "Y hay más",
    "more.title": "Un teclado completo, pensado para el día a día de quien atiende clientes",
    "card.ai.t": "Respuestas con IA",
    "card.ai.d": "Copia el mensaje del cliente y recibe sugerencias de respuesta con el tono de tu negocio.",
    "card.files.t": "Archivos",
    "card.files.d": "Fotos, videos y audios organizados en carpetas, listos para enviar.",
    "card.agenda.t": "Agenda",
    "card.agenda.d": "Visitas, reuniones y seguimientos agendados sin salir del teclado.",
    "card.spell.t": "Corrector y sugerencias",
    "card.spell.d": "Corrector ortográfico y sugerencias de palabras en español, portugués e inglés, para usar todo el día.",
    "card.segment.t": "A la medida de tu rubro",
    "card.segment.d": "Elige tu rubro y KEYCON ajusta los campos de los productos, las etapas del CRM y el tono de la IA.",
    "card.privacy.t": "Tus datos contigo",
    "card.privacy.d": "Lo que escribes se procesa en el propio celular. Catálogo, clientes y agenda se guardan en el dispositivo.",
    "seg.eyebrow": "Para quien vende",
    "seg.title": "Para cualquier producto o servicio",
    "seg.retail": "Tiendas y comercio",
    "seg.realestate": "Inmobiliarias",
    "seg.insurance": "Seguros",
    "seg.food": "Restaurantes",
    "seg.beauty": "Belleza y estética",
    "seg.vehicles": "Vehículos",
    "seg.legal": "Abogados",
    "seg.general": "Y cualquier otro negocio",
    "how.eyebrow": "Cómo funciona",
    "how.title": "Listo en tres pasos",
    "how.1t": "Configura en la app",
    "how.1d": "Crea tu cuenta, elige tu rubro y agrega productos, fotos, atajos y clientes.",
    "how.2t": "Activa el teclado",
    "how.2d": "La propia app te muestra cómo activar KEYCON en los ajustes del celular.",
    "how.3t": "Vende en la conversación",
    "how.3d": "Abre cualquier conversación, toca el menú del teclado y envía lo que el cliente pidió.",
    "faq.eyebrow": "Preguntas frecuentes",
    "faq.title": "Dudas comunes",
    "faq.1q": "¿Funciona en WhatsApp?",
    "faq.1a": "Sí. KEYCON es un teclado, así que funciona en cualquier app donde escribes: WhatsApp, Instagram, Messenger, correo y otras.",
    "faq.2q": "¿Funciona en Android y en iPhone?",
    "faq.2a": "Sí. En iPhone, por reglas de Apple, las fotos y los videos se copian desde el teclado y los pegas en la conversación con un toque.",
    "faq.3q": "¿Tengo que cambiar el teclado de mi celular?",
    "faq.3a": "KEYCON puede ser tu teclado de todos los días, con corrector y sugerencias. Puedes volver al teclado del sistema cuando quieras con el botón del globo en el menú.",
    "faq.4q": "¿KEYCON lee lo que escribo?",
    "faq.4a": "No. Lo que escribes se procesa solo en el celular, para corregir y sugerir palabras. Solo va al servidor el mensaje que copias y pides que la IA responda.",
    "faq.5q": "¿En qué idiomas funciona?",
    "faq.5a": "La app y el teclado están en español, portugués e inglés. El traductor del teclado también traduce al francés, italiano y alemán.",
    "cta.title": "Todo tu catálogo cabe en el teclado.",
    "cta.lead": "KEYCON llega muy pronto a Google Play y App Store.",
    "cta.leadLive": "Descarga KEYCON y empieza a vender desde el teclado.",
    "cta.button": "Habla con nosotros",
    "foot.privacy": "Política de Privacidad",
    "foot.terms": "Términos de Uso",
    "foot.note": "WhatsApp, Instagram y Messenger son marcas de Meta. KEYCON no está afiliado a Meta.",
    "meta.title": "KEYCON · Teclado inteligente para vender",
    "nav.ctaLive": "Quiero KEYCON",
    "wl.platform": "Tu celular",
    "wl.emailLabel": "Correo",
    "wl.placeholder": "tu@tunegocio.com",
    "wl.submit": "Avísame",
    "wl.sending": "Enviando…",
    "wl.note": "Un correo cuando KEYCON llegue a tu celular. Sin spam.",
    "wl.doneTitle": "Ya estás en la lista.",
    "wl.doneText": "Te avisaremos en {email} cuando KEYCON llegue a {platform}.",
    "wl.reset": "Usar otro correo",
    "wl.errEmail": "Escribe un correo como nombre@tunegocio.com.",
    "wl.errPlatform": "Elige iPhone o Android.",
    "wl.errNetwork": "No pudimos guardar tu correo. Revisa tu conexión e inténtalo de nuevo.",
    "story.1t": "El cliente pregunta",
    "story.1d": "en WhatsApp o en cualquier app",
    "story.2t": "Toca Productos",
    "story.2d": "tu catálogo se abre en el teclado",
    "story.3t": "Toca Usar y envía",
    "story.3d": "la foto va con precio y detalles",
    "story.alt1": "Una clienta pide una casa de 4 habitaciones con jardín en la conversación, con el teclado KEYCON abierto",
    "story.alt2": "El teclado muestra las casas en venta con foto, precio y el botón Usar",
    "story.alt3": "La foto de la casa llega a la conversación con el precio, el barrio, las habitaciones y los baños debajo",
    "story.pause": "Pausar la demostración",
    "story.play": "Reproducir la demostración",
    "nav.privacy": "Privacidad",
    "priv.title": "Lo que escribes se queda en tu celular",
    "priv.lead": "Un teclado ve todo lo que escribes. Esto es exactamente lo que sale de tu celular y lo que nunca sale.",
    "priv.stayT": "Se queda en tu celular",
    "priv.stay1": "Todo lo que escribes. Se procesa en el celular para corregir palabras y sugerir las siguientes, y nunca se guarda ni se envía.",
    "priv.stay2": "Tus productos, atajos, clientes, agenda y carpetas de archivos.",
    "priv.stay3": "Las traducciones, que funcionan en el propio celular.",
    "priv.goT": "Va a nuestros servidores",
    "priv.go1": "Tu cuenta y tu perfil: correo, nombre, nombre del negocio, WhatsApp y rubro.",
    "priv.go2": "Las fotos, videos y audios que subes, guardados como enlaces públicos para poder enviarlos en las conversaciones.",
    "priv.go3": "Solo cuando pides una respuesta a la IA: el mensaje del cliente que copiaste, con el nombre de tu negocio y los productos relacionados.",
    "priv.iosT": "En iPhone, ¿por qué el Acceso Total?",
    "priv.iosD": "iOS pide Acceso Total a todo teclado que usa internet y avisa que podría enviar lo que escribes. KEYCON lo necesita para las respuestas con IA, para leer tu catálogo desde la app y para copiar fotos que luego pegas. Lo que escribes se sigue procesando solo en el celular.",
    "priv.sell": "Nunca vendemos tus datos.",
    "priv.link": "Leer la Política de Privacidad",
    "faq.6q": "¿Cuánto cuesta?",
    "faq.6a": "KEYCON será una suscripción mensual. Los precios se anunciarán en el lanzamiento.",
    "intro.t1": "Teclado inteligente.",
    "intro.t2": "Ventas organizadas.",
    "intro.next": "Mira cómo funciona",
  },
};
// Textos em inglês que só aparecem quando os links forem preenchidos
var EN_EXTRA = {
  'store.get': 'Get it on', 'store.download': 'Download on the', 'cta.leadLive': 'Download KEYCON and start selling from the keyboard.',
  'nav.ctaLive': 'Get KEYCON', 'wl.sending': 'Sending…',
  'story.play': 'Play the demo',
  'wl.doneText': 'We’ll email {email} when KEYCON is ready for {platform}.',
  'wl.errEmail': 'Enter an email like name@yourbusiness.com.',
  'wl.errPlatform': 'Choose iPhone or Android.',
  'wl.errNetwork': 'We couldn’t save your email. Check your connection and try again.',
};

(function () {
  // Chamada final: cópia da inscrição do topo (formulário e confirmação), com ids próprios
  var slot = document.querySelector('[data-waitlist-slot]');
  if (slot) {
    ['[data-waitlist]', '[data-waitlist-done]'].forEach(function (sel) {
      var copy = document.querySelector('#baixar ' + sel).cloneNode(true);
      copy.querySelectorAll('[id]').forEach(function (el) { el.id += '-fim'; });
      copy.querySelectorAll('label[for]').forEach(function (el) { el.htmlFor += '-fim'; });
      copy.querySelectorAll('input[name="platform"]').forEach(function (el) { el.name = 'platform-fim'; });
      slot.appendChild(copy);
    });
  }

  var LANGS = ['en', 'pt', 'es'];
  var HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es' };
  var textEls = document.querySelectorAll('[data-i18n]:not([data-store] small)');
  var altEls = document.querySelectorAll('[data-i18n-alt]');
  var placeholderEls = document.querySelectorAll('[data-i18n-placeholder]');

  var shotEls = document.querySelectorAll('img[data-shot]');

  // O inglês é o próprio HTML: guarda para poder voltar a ele
  var en = Object.assign({ 'meta.title': document.title }, EN_EXTRA);
  document.querySelectorAll('[data-i18n]').forEach(function (el) { en[el.dataset.i18n] = en[el.dataset.i18n] || el.textContent; });
  altEls.forEach(function (el) { en[el.dataset.i18nAlt] = el.alt; });
  placeholderEls.forEach(function (el) { en[el.dataset.i18nPlaceholder] = el.placeholder; });
  I18N.en = en;

  var current = 'en';
  var afterApply = [];
  var tr = function (key) { return (I18N[current] && I18N[current][key]) || en[key] || ''; };

  // Lojas: com link, o selo vira um link para a loja; sem link, fica só o "Em breve"
  var stores = { play: CONFIG.googlePlayUrl, appstore: CONFIG.appStoreUrl };
  document.querySelectorAll('span[data-store]').forEach(function (badge) {
    var url = stores[badge.dataset.store];
    if (!url) return;
    var link = document.createElement('a');
    link.className = badge.className; link.dataset.store = badge.dataset.store;
    link.href = url; link.target = '_blank'; link.rel = 'noopener';
    link.innerHTML = badge.innerHTML;
    link.querySelector('small').dataset.i18n = badge.dataset.store === 'play' ? 'store.get' : 'store.download';
    badge.replaceWith(link);
  });
  function applyStores() {
    document.querySelectorAll('[data-store] small').forEach(function (label) {
      label.textContent = tr(label.dataset.i18n);
    });
    var lead = document.querySelector('[data-i18n="cta.lead"], [data-i18n="cta.leadLive"]');
    if (lead && (stores.play || stores.appstore)) lead.dataset.i18n = 'cta.leadLive';
    if (lead) lead.textContent = tr(lead.dataset.i18n);
  }

  function apply(lang) {
    current = LANGS.indexOf(lang) >= 0 ? lang : 'en';
    textEls.forEach(function (el) { el.textContent = tr(el.dataset.i18n); });
    altEls.forEach(function (el) { el.alt = tr(el.dataset.i18nAlt); });
    placeholderEls.forEach(function (el) { el.placeholder = tr(el.dataset.i18nPlaceholder); });
    // Telas do teclado no idioma escolhido (img/<idioma>/<tela>.webp)
    shotEls.forEach(function (img) { img.src = 'img/' + current + '/' + img.dataset.shot + '.webp?v=' + ASSET_VERSION; });
    document.title = tr('meta.title');
    document.documentElement.lang = HTML_LANG[current];
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === current)); });
    document.querySelectorAll('a[href*=".html"]').forEach(function (a) {
      a.href = a.getAttribute('href').split('?')[0] + (current === 'en' ? '' : '?lang=' + current);
    });
    applyStores();
    renderWaitlist();
    afterApply.forEach(function (fn) { fn(); });
    try { localStorage.setItem('keycon.lang', current); } catch (e) {}
  }

  // ── Lista de espera ───────────────────────────────────────────────────
  // Aparece enquanto o app não está nas duas lojas. Sem a lista configurada
  // (ou sem JavaScript), ficam só os selos das lojas.
  var anyLive = !!(stores.play || stores.appstore);
  var bothLive = !!(stores.play && stores.appstore);
  var wl = CONFIG.waitlist || {};
  var waitlistOn = !bothLive && !!(wl.url && wl.anonKey);
  var forms = document.querySelectorAll('[data-waitlist]');
  var dones = document.querySelectorAll('[data-waitlist-done]');
  var SAVED_KEY = 'keycon.waitlist';
  var renderHooks = [];
  var PLATFORM_NAME = { iphone: 'iPhone', android: 'Android' };
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var joined = null;
  try { joined = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); } catch (e) {}
  if (!joined || !joined.email || !PLATFORM_NAME[joined.platform]) joined = null;

  var ctas = document.querySelectorAll('[data-cta]');
  if (anyLive) ctas.forEach(function (c) { c.dataset.i18n = 'nav.ctaLive'; });

  // Celular da pessoa já marcado quando dá para saber pelo navegador
  var ua = navigator.userAgent;
  var guess = /iPhone|iPad|iPod/.test(ua) ? 'iphone' : /Android/.test(ua) ? 'android' : '';
  if (guess) forms.forEach(function (f) { f.querySelector('input[value="' + guess + '"]').checked = true; });

  function showError(form, key, field) {
    var box = form.querySelector('.wl-error');
    box.dataset.key = key || '';
    box.textContent = key ? tr(key) : '';
    form.querySelector('.email').setAttribute('aria-invalid', String(key === 'wl.errEmail'));
    if (field) field.focus();
  }

  function renderWaitlist() {
    forms.forEach(function (f) {
      f.hidden = !waitlistOn || !!joined;
      var box = f.querySelector('.wl-error');
      if (box.dataset.key) box.textContent = tr(box.dataset.key);
      f.querySelector('button[type="submit"] span').textContent = tr(f.dataset.sending ? 'wl.sending' : 'wl.submit');
    });
    renderHooks.forEach(function (fn) { fn(); });
    dones.forEach(function (d) {
      d.hidden = !waitlistOn || !joined;
      if (joined) d.querySelector('[data-wl-done-text]').textContent = tr('wl.doneText').replace('{email}', joined.email).replace('{platform}', PLATFORM_NAME[joined.platform]);
    });
  }

  function setSending(form, on) {
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
    if (on) form.dataset.sending = '1'; else delete form.dataset.sending;
    renderWaitlist();
  }

  function finish(form, entry) {
    joined = entry;
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(entry)); } catch (e) {}
    renderWaitlist();
    // Leva o foco para a confirmação do mesmo bloco (leitor de tela e teclado)
    form.parentNode.querySelector('[data-waitlist-done]').focus();
  }

  forms.forEach(function (form) {
    var email = form.querySelector('.email');
    var errorKey = function () { return form.querySelector('.wl-error').dataset.key; };
    email.addEventListener('input', function () { if (errorKey() === 'wl.errEmail') showError(form, ''); });
    form.querySelectorAll('.platform input').forEach(function (r) {
      r.addEventListener('change', function () { if (errorKey() === 'wl.errPlatform') showError(form, ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.dataset.sending) return;
      var value = email.value.trim();
      var picked = form.querySelector('.platform input:checked');
      if (value.length > 254 || !EMAIL_RE.test(value)) return showError(form, 'wl.errEmail', email);
      if (!picked) return showError(form, 'wl.errPlatform', form.querySelector('.platform input'));
      showError(form, '');
      var entry = { email: value, platform: picked.value };
      // Robô preencheu o campo-isca: finge que deu certo e não envia nada
      if (form.querySelector('.hp').value) return finish(form, entry);

      setSending(form, true);
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      fetch(wl.url + '/rest/v1/waitlist', {
        method: 'POST',
        headers: { apikey: wl.anonKey, Authorization: 'Bearer ' + wl.anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ email: value, platform: picked.value, language: current }),
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function (res) {
        clearTimeout(timer);
        setSending(form, false);
        // 409 = e-mail já inscrito: para a pessoa, é o mesmo que dar certo
        if (res.ok || res.status === 409) return finish(form, entry);
        showError(form, 'wl.errNetwork');
      }, function () {
        clearTimeout(timer);
        setSending(form, false);
        showError(form, 'wl.errNetwork');
      });
    });
  });

  document.querySelectorAll('[data-wl-reset]').forEach(function (b) {
    b.addEventListener('click', function () {
      joined = null;
      try { localStorage.removeItem(SAVED_KEY); } catch (e) {}
      renderWaitlist();
      var email = b.closest('.signup').querySelector('.email');
      email.value = '';
      email.focus();
    });
  });

  // O botão do cabeçalho leva à inscrição e já põe o cursor no e-mail
  ctas.forEach(function (c) {
    c.addEventListener('click', function () {
      if (!waitlistOn || joined) return;
      var email = document.querySelector('#baixar .email');
      setTimeout(function () { email.focus({ preventScroll: true }); }, 450);
    });
  });

  // Celular: botão fixo embaixo enquanto nenhuma inscrição está na tela.
  // Some com a inscrição à vista, depois de se inscrever e em telas maiores.
  var bar = document.querySelector('[data-mobile-cta]');
  var small = window.matchMedia('(max-width: 640px)');
  var inView = new Set();
  var updateBar = function () {
    var hero = document.getElementById('baixar');
    var passedHero = hero.getBoundingClientRect().top < 0;
    bar.hidden = !small.matches || inView.size > 0 || !passedHero || (waitlistOn && !!joined) || (!waitlistOn && !anyLive);
  };
  if ('IntersectionObserver' in window) {
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target); });
      updateBar();
    });
    watch.observe(document.getElementById('baixar'));
    watch.observe(document.querySelector('[data-waitlist-slot]'));
    if (small.addEventListener) small.addEventListener('change', updateBar);
    renderHooks.push(updateBar);
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { apply(b.dataset.setLang); });
  });

  // Idioma inicial: ?lang=, o último escolhido ou o do navegador
  var saved = null;
  try { saved = localStorage.getItem('keycon.lang'); } catch (e) {}
  var query = new URLSearchParams(location.search).get('lang');
  var browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  apply([query, saved, browser].filter(function (l) { return LANGS.indexOf(l) >= 0; })[0] || 'en');

  // ── Abertura: teclado 3D que segue o mouse, digitação e linhas no fundo ──
  // Tudo para quando a abertura sai da tela, com a aba escondida ou quando a
  // pessoa prefere menos movimento (aí fica a imagem parada).
  var intro = document.getElementById('inicio');
  if (intro) {
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var kb = intro.querySelector('[data-kb3d]');
    var canvas = intro.querySelector('[data-intro-lines]');
    var ctx = canvas.getContext && canvas.getContext('2d');
    var introOn = true;
    var kbStyle = getComputedStyle(kb);
    var BASE_RX = parseFloat(kbStyle.getPropertyValue('--rx')) || 40;
    var BASE_RY = parseFloat(kbStyle.getPropertyValue('--ry')) || 0;
    var BASE_RZ = parseFloat(kbStyle.getPropertyValue('--rz')) || 0;
    var tilt = { x: 0, y: 0 }, aim = { x: 0, y: 0 }, mouseAt = 0, raf = 0, t0 = performance.now();

    // Mouse: o teclado inclina na direção do cursor, de leve (até ~8° para cada lado)
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      aim.x = e.clientX / innerWidth - .5;
      aim.y = e.clientY / innerHeight - .5;
      mouseAt = performance.now();
    }, { passive: true });

    // Linhas entrelaçadas: fitas de seno que se cruzam, devagar
    var W = 0, H = 0, DPR = 1;
    var size = function () {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = intro.clientWidth; H = intro.clientHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    };
    var LINES = [
      { hue: 'rgba(241, 120, 96, ', amp: .16, freq: 1.3, speed: .22, phase: 0, y: .62, w: 1.6, a: .55 },
      { hue: 'rgba(124, 147, 230, ', amp: .14, freq: 1.1, speed: -.18, phase: 2.1, y: .6, w: 1.4, a: .5 },
      { hue: 'rgba(255, 177, 153, ', amp: .1, freq: 1.8, speed: .3, phase: 4.2, y: .66, w: 1, a: .35 },
      { hue: 'rgba(241, 120, 96, ', amp: .2, freq: .8, speed: -.12, phase: 1.3, y: .7, w: 1, a: .28 },
      { hue: 'rgba(124, 147, 230, ', amp: .22, freq: .7, speed: .1, phase: 3.4, y: .52, w: 1, a: .25 },
      { hue: 'rgba(255, 255, 255, ', amp: .12, freq: 1.5, speed: -.26, phase: 5.1, y: .58, w: .8, a: .14 },
    ];
    var drawLines = function (t) {
      if (!ctx) return;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      LINES.forEach(function (L) {
        var grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, L.hue + '0)');
        grad.addColorStop(.25, L.hue + L.a + ')');
        grad.addColorStop(.75, L.hue + L.a + ')');
        grad.addColorStop(1, L.hue + '0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = L.w;
        ctx.beginPath();
        for (var x = 0; x <= W + 8; x += 8) {
          var u = x / W;
          // Duas ondas somadas: a fita sobe e desce e cruza as outras
          var y = H * L.y + Math.sin(u * Math.PI * 2 * L.freq + t * L.speed + L.phase) * H * L.amp
                + Math.sin(u * Math.PI * 4.3 - t * L.speed * .7 + L.phase) * H * L.amp * .25;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
    };

    var frame = function (now) {
      var t = (now - t0) / 1000;
      // Sem mouse há 3 s (ou no toque): flutua sozinho, bem devagar
      var idle = now - mouseAt > 3000;
      var gx = idle ? Math.sin(t * .45) * .22 : aim.x;
      var gy = idle ? Math.sin(t * .33) * .18 : aim.y;
      tilt.x += (gx - tilt.x) * .06;
      tilt.y += (gy - tilt.y) * .06;
      kb.style.setProperty('--ry', (BASE_RY + tilt.x * 16).toFixed(2) + 'deg');
      kb.style.setProperty('--rx', (BASE_RX - tilt.y * 10).toFixed(2) + 'deg');
      kb.style.setProperty('--rz', (BASE_RZ + tilt.x * -2).toFixed(2) + 'deg');
      kb.style.setProperty('--lift', (Math.sin(t * 1.1) * 6).toFixed(1) + 'px');
      drawLines(t);
      raf = requestAnimationFrame(frame);
    };
    var run = function () {
      cancelAnimationFrame(raf);
      if (!still && introOn && !document.hidden) raf = requestAnimationFrame(frame);
    };

    // Digitação: o teclado "escreve" KEYCON, uma tecla de cada vez, e recomeça
    var WORD = ['k', 'e', 'y', 'c', 'o', 'n', 'enter'];
    var typeAt = 0, typeTimer = 0;
    var typeNext = function () {
      clearTimeout(typeTimer);
      if (still || !introOn || document.hidden) return;
      var el = kb.querySelector('[data-k="' + WORD[typeAt] + '"]');
      if (el) {
        el.classList.add('is-hit');
        setTimeout(function () { el.classList.remove('is-hit'); }, 210);
      }
      typeAt = (typeAt + 1) % WORD.length;
      typeTimer = setTimeout(typeNext, typeAt === 0 ? 1800 : 260);
    };

    size();
    window.addEventListener('resize', function () { size(); if (still) drawLines(0); });
    if (still) drawLines(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        introOn = entries[0].isIntersecting;
        run(); typeNext();
      }).observe(intro);
    }
    document.addEventListener('visibilitychange', function () { run(); typeNext(); });
    run();
    setTimeout(typeNext, 900);
  }

  // Topo: a venda em 3 quadros (pergunta, Produtos, ficha enviada). Avança
  // sozinho; para com o mouse ou o foco em cima, fora da tela, com a aba
  // escondida, no botão de pausa ou quando a pessoa prefere menos movimento.
  var story = document.querySelector('[data-story]');
  if (story) {
    var STEP_MS = 3400;
    var frames = story.querySelectorAll('.story-frame');
    var steps = story.querySelectorAll('[data-step]');
    var toggle = story.querySelector('[data-story-toggle]');
    var toggleLabel = toggle.querySelector('[data-i18n]');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var at = 0, timer = null, paused = reduce, onScreen = true, held = false;
    story.style.setProperty('--step-ms', STEP_MS + 'ms');

    var playing = function () { return !paused && onScreen && !held && !document.hidden; };
    var show = function (i) {
      at = i;
      frames.forEach(function (f, k) { f.classList.toggle('is-active', k === i); f.setAttribute('aria-hidden', String(k !== i)); });
      steps.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    };
    var schedule = function () {
      clearTimeout(timer);
      // Reinicia a barra do passo atual
      story.classList.remove('is-playing');
      void story.offsetWidth;
      if (!playing()) return;
      story.classList.add('is-playing');
      timer = setTimeout(function () { show((at + 1) % frames.length); schedule(); }, STEP_MS);
    };
    var setPaused = function (on) {
      paused = on;
      toggle.setAttribute('aria-pressed', String(on));
      toggleLabel.dataset.i18n = on ? 'story.play' : 'story.pause';
      toggleLabel.textContent = tr(toggleLabel.dataset.i18n);
      schedule();
    };

    steps.forEach(function (b, k) { b.addEventListener('click', function () { show(k); schedule(); }); });
    toggle.addEventListener('click', function () { setPaused(!paused); });
    story.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { held = true; schedule(); } });
    story.addEventListener('pointerleave', function () { if (held) { held = false; schedule(); } });
    story.addEventListener('focusin', function () { held = true; schedule(); });
    story.addEventListener('focusout', function (e) { if (!story.contains(e.relatedTarget)) { held = false; schedule(); } });
    document.addEventListener('visibilitychange', schedule);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe(story);
    }
    setPaused(reduce);
  }

  // Abas dos recursos (setas do teclado também trocam)
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var caption = document.querySelector('[data-tab-caption]');
  var showCaption = function () {
    var on = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
    caption.textContent = on ? on.querySelector('small').textContent : '';
  };
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    showCaption();
    // Faixa de abas que rola no celular: a aba escolhida fica inteira à vista
    var strip = tab.parentNode;
    if (strip.scrollWidth > strip.clientWidth) {
      var left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
    if (focus) tab.focus({ preventScroll: true });
  }
  showCaption();
  afterApply.push(showCaption);
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  // Contato
  var contact = document.getElementById('contato');
  if (CONFIG.contactEmail) {
    contact.href = 'mailto:' + CONFIG.contactEmail + '?subject=KEYCON';
    contact.hidden = false;
  }

  document.getElementById('ano').textContent = new Date().getFullYear();
})();
