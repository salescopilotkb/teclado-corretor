/**
 * Termos de Uso e Política de Privacidade do KEYCON (pt, en, es).
 *
 * Os textos descrevem o que o app faz hoje: conta e perfil na nuvem
 * (Supabase), arquivos enviados em links públicos, catálogo/atalhos/clientes/
 * agenda/arquivos (a lista) só no aparelho, lista de espera do site (e-mail,
 * celular e idioma), teclado que processa o que é
 * digitado só no aparelho, IA que envia a mensagem copiada ao servidor.
 * Mudou algo disso no app? Atualize aqui e a data em LEGAL_UPDATED.
 *
 * ⚠️ Antes de publicar: preencha LEGAL_INFO com os dados da empresa e revise
 * com um advogado.
 */
import type { Lang } from '../i18n';

/** Dados de quem oferece o app (aparecem nos textos). */
export const LEGAL_INFO = {
  company: '7STUDIO DIGITAL MARKETING CORP.',
  // Florida Profit Corporation (EIN fica fora dos textos públicos)
  address: '5256 International Drive, Apt 561, Orlando, FL 32819, United States',
  email: 'contact@keyconapp.com',
  city: 'Orange County, Florida',
};

/** Data da última atualização dos textos (AAAA-MM-DD). */
export const LEGAL_UPDATED = '2026-10-30';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  sections: LegalSection[];
}

type Docs = Record<Lang, LegalDocument>;

/** Troca {company}, {address}, {email} e {city} pelos dados de LEGAL_INFO. */
export function fillLegal(text: string): string {
  return text.replace(/\{(company|address|email|city)\}/g, (_, k: keyof typeof LEGAL_INFO) => LEGAL_INFO[k]);
}

// ── Termos de Uso ───────────────────────────────────────────────────────

export const TERMS: Docs = {
  pt: {
    title: 'Termos de Uso',
    sections: [
      {
        title: '1. Aceitação',
        paragraphs: [
          'Estes Termos de Uso regem o uso do aplicativo KEYCON e do teclado KEYCON (juntos, o "KEYCON"), oferecidos por {company}, empresa registrada no estado da Flórida (EUA), com sede em {address}. Ao criar uma conta ou usar o KEYCON, você declara que leu e aceita estes Termos e a Política de Privacidade.',
          'Se você usa o KEYCON em nome de uma empresa, declara ter autorização para aceitar estes Termos por ela.',
        ],
      },
      {
        title: '2. O que é o KEYCON',
        paragraphs: [
          'O KEYCON é um aplicativo de apoio a vendas composto por um app e por um teclado para o celular. Ele permite organizar produtos, arquivos, atalhos de mensagens, clientes e compromissos, e enviar esse conteúdo nas conversas com seus clientes, além de oferecer correção ortográfica, sugestões de palavras e sugestões de resposta com inteligência artificial (IA).',
          'O KEYCON não é afiliado, patrocinado ou aprovado pelo WhatsApp, pela Meta ou por qualquer outro aplicativo de mensagens em que o teclado seja usado.',
        ],
      },
      {
        title: '3. Conta',
        paragraphs: [
          'Para usar os recursos de vendas, você precisa criar uma conta com e-mail e senha. Você deve ter pelo menos 18 anos, informar dados verdadeiros e manter sua senha em segredo. Você é responsável por tudo o que for feito com a sua conta.',
          'Avise-nos pelo e-mail {email} se suspeitar de uso não autorizado da sua conta.',
        ],
      },
      {
        title: '4. Uso permitido',
        paragraphs: [
          'Você se compromete a usar o KEYCON de forma lícita e de acordo com as regras dos aplicativos em que envia mensagens. É proibido, entre outros: enviar mensagens em massa ou não solicitadas (spam); enviar conteúdo ilegal, enganoso, ofensivo ou que viole direitos de terceiros; vender produtos ou serviços proibidos; tentar acessar dados de outros usuários; copiar, descompilar ou modificar o KEYCON; ou usá-lo para prejudicar o serviço ou outras pessoas.',
        ],
      },
      {
        title: '5. Seu conteúdo',
        paragraphs: [
          'Produtos, textos, fotos, vídeos, áudios, links e demais conteúdos que você cadastra continuam sendo seus. Você declara ter os direitos necessários sobre eles e nos concede uma licença limitada, apenas para armazená-los, processá-los e exibi-los na medida necessária para prestar o serviço a você.',
          'Fotos, vídeos e áudios enviados para a nuvem ficam acessíveis por um link público: qualquer pessoa que tenha o link pode abrir o arquivo. Não envie arquivos que não possam ser vistos por quem receber o link.',
        ],
      },
      {
        title: '6. Mensagens e dados dos seus clientes',
        paragraphs: [
          'Você é o único responsável pelas mensagens que envia aos seus clientes e por ter a autorização deles para contatá-los. Os dados dos seus clientes que você registra no KEYCON (como nome, WhatsApp, etiquetas e anotações) ficam no seu aparelho, e você atua como controlador desses dados perante a legislação de proteção de dados.',
        ],
      },
      {
        title: '7. Inteligência artificial',
        paragraphs: [
          'As sugestões de resposta são geradas automaticamente e podem conter erros, imprecisões ou informações desatualizadas. Revise sempre o texto antes de enviá-lo. Você é responsável pelo que decidir enviar.',
        ],
      },
      {
        title: '8. Serviços de terceiros',
        paragraphs: [
          'O KEYCON funciona junto com serviços de terceiros, como o sistema do seu celular, os aplicativos de mensagens, os provedores de nuvem e de inteligência artificial e as lojas de aplicativos. O uso desses serviços está sujeito aos termos de cada um, e não respondemos por falhas ou mudanças deles.',
        ],
      },
      {
        title: '9. Disponibilidade e mudanças',
        paragraphs: [
          'Trabalhamos para manter o KEYCON disponível e funcionando bem, mas não garantimos que ele estará livre de erros ou interrupções. Podemos alterar, incluir ou remover recursos a qualquer momento, inclusive em versões de teste.',
        ],
      },
      {
        title: '10. Limitação de responsabilidade',
        paragraphs: [
          'Na máxima extensão permitida pela lei, o KEYCON é oferecido "no estado em que se encontra". Não respondemos por perdas indiretas, lucros cessantes, perda de dados mantidos apenas no seu aparelho ou por danos causados pelo conteúdo que você envia. Nada nestes Termos afasta direitos que a lei garante ao consumidor.',
        ],
      },
      {
        title: '11. Encerramento',
        paragraphs: [
          'Você pode parar de usar o KEYCON e pedir a exclusão da sua conta a qualquer momento pelo e-mail {email}. Podemos suspender ou encerrar contas que violem estes Termos ou a lei.',
        ],
      },
      {
        title: '12. Alterações destes Termos',
        paragraphs: [
          'Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos no app. Continuar usando o KEYCON depois do aviso significa que você aceita a nova versão.',
        ],
      },
      {
        title: '13. Lei aplicável e foro',
        paragraphs: [
          'Estes Termos seguem as leis do Estado da Flórida (EUA), sem prejuízo das normas obrigatórias de proteção ao consumidor do seu país de residência, como o Código de Defesa do Consumidor no Brasil. Fica eleito o foro de {city}, ressalvado o direito do consumidor de propor ação no foro do seu domicílio.',
        ],
      },
      {
        title: '14. Contato',
        paragraphs: ['Dúvidas sobre estes Termos: {email}.'],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    sections: [
      {
        title: '1. Acceptance',
        paragraphs: [
          'These Terms of Use govern the use of the KEYCON app and the KEYCON keyboard (together, "KEYCON"), provided by {company}, a Florida profit corporation located at {address}. By creating an account or using KEYCON, you confirm that you have read and accept these Terms and the Privacy Policy.',
          'If you use KEYCON on behalf of a company, you confirm that you are authorized to accept these Terms for it.',
        ],
      },
      {
        title: '2. What KEYCON is',
        paragraphs: [
          'KEYCON is a sales-support app made of an app and a phone keyboard. It lets you organize products, files, message shortcuts, clients and appointments and send this content in your chats with clients, and it offers spell checking, word suggestions and reply suggestions powered by artificial intelligence (AI).',
          'KEYCON is not affiliated with, sponsored or endorsed by WhatsApp, Meta or any other messaging app in which the keyboard is used.',
        ],
      },
      {
        title: '3. Account',
        paragraphs: [
          'To use the sales features you need an account with an email and password. You must be at least 18 years old, provide accurate information and keep your password secret. You are responsible for everything done with your account.',
          'Let us know at {email} if you suspect unauthorized use of your account.',
        ],
      },
      {
        title: '4. Acceptable use',
        paragraphs: [
          'You agree to use KEYCON lawfully and in line with the rules of the apps in which you send messages. You may not, among other things: send bulk or unsolicited messages (spam); send illegal, misleading or offensive content or content that infringes the rights of others; sell prohibited products or services; try to access other users\' data; copy, decompile or modify KEYCON; or use it to harm the service or other people.',
        ],
      },
      {
        title: '5. Your content',
        paragraphs: [
          'Products, texts, photos, videos, audios, links and other content you add remain yours. You confirm that you hold the necessary rights to them and grant us a limited license only to store, process and display them as needed to provide the service to you.',
          'Photos, videos and audios uploaded to the cloud are available through a public link: anyone who has the link can open the file. Do not upload files that should not be seen by whoever receives the link.',
        ],
      },
      {
        title: '6. Messages and your clients\' data',
        paragraphs: [
          'You are solely responsible for the messages you send to your clients and for having their permission to contact them. Your clients\' data that you record in KEYCON (such as name, WhatsApp, tags and notes) stays on your device, and you act as the controller of that data under data protection laws.',
        ],
      },
      {
        title: '7. Artificial intelligence',
        paragraphs: [
          'Reply suggestions are generated automatically and may contain errors, inaccuracies or outdated information. Always review the text before sending it. You are responsible for what you decide to send.',
        ],
      },
      {
        title: '8. Third-party services',
        paragraphs: [
          'KEYCON works together with third-party services such as your phone\'s operating system, messaging apps, cloud and AI providers and app stores. Your use of those services is subject to their own terms, and we are not responsible for their failures or changes.',
        ],
      },
      {
        title: '9. Availability and changes',
        paragraphs: [
          'We work to keep KEYCON available and working well, but we do not guarantee that it will be free of errors or interruptions. We may change, add or remove features at any time, including in test versions.',
        ],
      },
      {
        title: '10. Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law, KEYCON is provided "as is". We are not liable for indirect losses, lost profits, loss of data kept only on your device, or damage caused by content you send. Nothing in these Terms limits rights that consumer law grants you.',
        ],
      },
      {
        title: '11. Termination',
        paragraphs: [
          'You may stop using KEYCON and request deletion of your account at any time at {email}. We may suspend or close accounts that violate these Terms or the law.',
        ],
      },
      {
        title: '12. Changes to these Terms',
        paragraphs: [
          'We may update these Terms. If a change is significant, we will let you know in the app. Continuing to use KEYCON after the notice means you accept the new version.',
        ],
      },
      {
        title: '13. Governing law and jurisdiction',
        paragraphs: [
          'These Terms are governed by the laws of the State of Florida, United States, without prejudice to mandatory consumer protection laws of your country of residence. The courts of {city} have jurisdiction, without prejudice to your right as a consumer to bring a claim in the courts where you live.',
        ],
      },
      {
        title: '14. Contact',
        paragraphs: ['Questions about these Terms: {email}.'],
      },
    ],
  },
  es: {
    title: 'Términos de Uso',
    sections: [
      {
        title: '1. Aceptación',
        paragraphs: [
          'Estos Términos de Uso regulan el uso de la app KEYCON y del teclado KEYCON (juntos, "KEYCON"), ofrecidos por {company}, sociedad registrada en el estado de Florida (EE. UU.), con domicilio en {address}. Al crear una cuenta o usar KEYCON, declaras que leíste y aceptas estos Términos y la Política de Privacidad.',
          'Si usas KEYCON en nombre de una empresa, declaras tener autorización para aceptar estos Términos en su nombre.',
        ],
      },
      {
        title: '2. Qué es KEYCON',
        paragraphs: [
          'KEYCON es una aplicación de apoyo a las ventas formada por una app y un teclado para el celular. Permite organizar productos, archivos, accesos rápidos de mensajes, clientes y citas, y enviar ese contenido en las conversaciones con tus clientes, además de ofrecer corrección ortográfica, sugerencias de palabras y sugerencias de respuesta con inteligencia artificial (IA).',
          'KEYCON no está afiliado, patrocinado ni aprobado por WhatsApp, Meta ni ninguna otra aplicación de mensajería en la que se use el teclado.',
        ],
      },
      {
        title: '3. Cuenta',
        paragraphs: [
          'Para usar las funciones de ventas necesitas una cuenta con correo y contraseña. Debes tener al menos 18 años, informar datos verdaderos y mantener tu contraseña en secreto. Eres responsable de todo lo que se haga con tu cuenta.',
          'Avísanos a {email} si sospechas de un uso no autorizado de tu cuenta.',
        ],
      },
      {
        title: '4. Uso permitido',
        paragraphs: [
          'Te comprometes a usar KEYCON de forma lícita y según las reglas de las aplicaciones en las que envías mensajes. Está prohibido, entre otros: enviar mensajes masivos o no solicitados (spam); enviar contenido ilegal, engañoso u ofensivo o que viole derechos de terceros; vender productos o servicios prohibidos; intentar acceder a datos de otros usuarios; copiar, descompilar o modificar KEYCON; o usarlo para perjudicar el servicio o a otras personas.',
        ],
      },
      {
        title: '5. Tu contenido',
        paragraphs: [
          'Los productos, textos, fotos, videos, audios, enlaces y demás contenido que registras siguen siendo tuyos. Declaras tener los derechos necesarios sobre ellos y nos concedes una licencia limitada, solo para almacenarlos, procesarlos y mostrarlos en la medida necesaria para prestarte el servicio.',
          'Las fotos, videos y audios subidos a la nube quedan accesibles mediante un enlace público: cualquier persona que tenga el enlace puede abrir el archivo. No subas archivos que no deban ver quienes reciban el enlace.',
        ],
      },
      {
        title: '6. Mensajes y datos de tus clientes',
        paragraphs: [
          'Eres el único responsable de los mensajes que envías a tus clientes y de tener su autorización para contactarlos. Los datos de tus clientes que registras en KEYCON (como nombre, WhatsApp, etiquetas y notas) quedan en tu dispositivo, y actúas como responsable de esos datos ante la legislación de protección de datos.',
        ],
      },
      {
        title: '7. Inteligencia artificial',
        paragraphs: [
          'Las sugerencias de respuesta se generan automáticamente y pueden contener errores, imprecisiones o información desactualizada. Revisa siempre el texto antes de enviarlo. Eres responsable de lo que decidas enviar.',
        ],
      },
      {
        title: '8. Servicios de terceros',
        paragraphs: [
          'KEYCON funciona junto con servicios de terceros, como el sistema de tu celular, las aplicaciones de mensajería, los proveedores de nube y de inteligencia artificial y las tiendas de aplicaciones. El uso de esos servicios está sujeto a sus propios términos, y no respondemos por sus fallas o cambios.',
        ],
      },
      {
        title: '9. Disponibilidad y cambios',
        paragraphs: [
          'Trabajamos para mantener KEYCON disponible y funcionando bien, pero no garantizamos que esté libre de errores o interrupciones. Podemos cambiar, incluir o quitar funciones en cualquier momento, incluso en versiones de prueba.',
        ],
      },
      {
        title: '10. Limitación de responsabilidad',
        paragraphs: [
          'En la máxima medida permitida por la ley, KEYCON se ofrece "tal cual". No respondemos por pérdidas indirectas, lucro cesante, pérdida de datos guardados solo en tu dispositivo ni por daños causados por el contenido que envías. Nada en estos Términos limita los derechos que la ley otorga al consumidor.',
        ],
      },
      {
        title: '11. Terminación',
        paragraphs: [
          'Puedes dejar de usar KEYCON y pedir la eliminación de tu cuenta en cualquier momento escribiendo a {email}. Podemos suspender o cerrar cuentas que violen estos Términos o la ley.',
        ],
      },
      {
        title: '12. Cambios en estos Términos',
        paragraphs: [
          'Podemos actualizar estos Términos. Si el cambio es relevante, te avisaremos en la app. Seguir usando KEYCON después del aviso significa que aceptas la nueva versión.',
        ],
      },
      {
        title: '13. Ley aplicable y jurisdicción',
        paragraphs: [
          'Estos Términos se rigen por las leyes del Estado de Florida (EE. UU.), sin perjuicio de las normas obligatorias de protección al consumidor de tu país de residencia. Son competentes los tribunales de {city}, sin perjuicio de tu derecho como consumidor a presentar una demanda en los tribunales de tu domicilio.',
        ],
      },
      {
        title: '14. Contacto',
        paragraphs: ['Dudas sobre estos Términos: {email}.'],
      },
    ],
  },
};

// ── Política de Privacidade ─────────────────────────────────────────────

export const PRIVACY: Docs = {
  pt: {
    title: 'Política de Privacidade',
    sections: [
      {
        title: '1. Quem somos',
        paragraphs: [
          'Esta Política explica como {company} ("nós"), empresa registrada no estado da Flórida (EUA), com sede em {address}, trata os dados pessoais de quem usa o aplicativo e o teclado KEYCON, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018) e, quando aplicável, com outras leis de proteção de dados, como o GDPR europeu e as leis de privacidade dos Estados Unidos.',
        ],
      },
      {
        title: '2. Dados que guardamos na nuvem',
        paragraphs: [
          'Conta: e-mail e senha. A senha é guardada de forma protegida pelo nosso provedor de autenticação; nós não temos acesso a ela.',
          'Login com Google ou com a Apple: se você entrar por um deles, recebemos seu nome, e-mail e foto do perfil (no caso da Apple, você pode esconder seu e-mail e usar um endereço de encaminhamento da Apple). Usamos esses dados só para criar e identificar sua conta.',
          'Google Agenda e Google Meet: se você entrar com o Google, pedimos permissão para criar eventos na sua agenda (escopo calendar.events), apenas para criar com link do Google Meet os compromissos que você agenda no KEYCON. Não lemos, não alteramos e não apagamos os outros eventos da sua agenda. O token de acesso fica no seu aparelho; para renová-lo, o token de renovação passa por uma função segura no nosso servidor, que não guarda nada. O uso e a transferência das informações recebidas das APIs do Google seguem a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado: esses dados não são vendidos, não são usados para anúncios nem para treinar modelos de inteligência artificial, e não são compartilhados com terceiros, exceto quando necessário para prestar esse recurso ou quando a lei exigir. Você pode remover o acesso do KEYCON a qualquer momento em myaccount.google.com/permissions.',
          'Perfil: seu nome, nome do negócio, WhatsApp, ramo do negócio, idioma e país onde você vende. Eles aparecem nas suas mensagens prontas e ajustam o app ao seu negócio.',
          'Arquivos que você envia: fotos, vídeos e áudios que você escolhe adicionar ao catálogo, aos atalhos ou à seção Arquivos. Eles ficam acessíveis por um link público, para que o teclado consiga enviá-los nas conversas.',
          'Dados técnicos: registros de acesso mantidos pelos nossos provedores (como data, hora e endereço IP), exigidos para segurança e pela lei.',
          'Lista de espera do site: se você se inscrever para ser avisado do lançamento, guardamos seu e-mail, o tipo de celular que você escolheu (iPhone ou Android) e o idioma da página. Usamos esses dados só para avisar quando o KEYCON estiver disponível no seu celular.',
        ],
      },
      {
        title: '3. Dados que ficam só no seu aparelho',
        paragraphs: [
          'Seus produtos e categorias, atalhos de texto, áudio e link, clientes do CRM (nome, WhatsApp, etiquetas, anotações), compromissos da agenda, a organização das pastas de Arquivos e as suas preferências ficam guardados apenas no seu celular, compartilhados entre o app e o teclado KEYCON. Nós não recebemos esses dados.',
        ],
      },
      {
        title: '4. O teclado e o que você digita',
        paragraphs: [
          'O que você digita com o teclado KEYCON é processado somente no seu aparelho, para corrigir palavras e sugerir as próximas. Não guardamos, não registramos e não enviamos o texto que você digita. Em campos de senha, e-mail e link o teclado desliga as sugestões e a correção automática.',
          'Área de transferência: o KEYCON só lê o texto copiado quando você toca no botão da IA para pedir uma sugestão de resposta.',
        ],
      },
      {
        title: '5. Permissões do celular',
        paragraphs: [
          'Microfone: usado apenas enquanto você grava um atalho de áudio, depois que você autoriza.',
          'Fotos, vídeos e câmera: o KEYCON usa o seletor de arquivos e a câmera do próprio sistema; só recebe o arquivo que você escolher ou capturar.',
          'Internet e vibração: para enviar e receber dados e para a vibração ao reorganizar o menu do teclado.',
        ],
      },
      {
        title: '6. Inteligência artificial',
        paragraphs: [
          'Quando você pede uma sugestão de resposta, a mensagem do cliente que você copiou, o nome do seu negócio e informações dos produtos relacionados são enviados ao nosso servidor e a um provedor de inteligência artificial, apenas para gerar as sugestões. Não usamos esses dados para outras finalidades. Enquanto a IA estiver em modo de demonstração, nada é enviado.',
        ],
      },
      {
        title: '7. Para que usamos os dados e bases legais',
        paragraphs: [
          'Usamos os dados para criar e manter sua conta, prestar os recursos do KEYCON, enviar seus arquivos nas conversas, dar suporte, garantir a segurança e cumprir obrigações legais. As bases legais são a execução do contrato com você, o cumprimento de obrigação legal, o nosso legítimo interesse em manter o serviço seguro e, para o microfone, o seu consentimento.',
        ],
      },
      {
        title: '8. Com quem compartilhamos',
        paragraphs: [
          'Com provedores que nos ajudam a prestar o serviço: hospedagem, banco de dados, autenticação e armazenamento de arquivos (Supabase) e, quando a IA estiver ativa, o provedor de inteligência artificial. Eles só podem usar os dados para prestar esses serviços. Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir. Nós não vendemos seus dados.',
          'Esses provedores podem manter servidores fora do Brasil. Nesses casos, adotamos as garantias previstas na LGPD para a transferência internacional.',
        ],
      },
      {
        title: '9. Por quanto tempo guardamos',
        paragraphs: [
          'Guardamos os dados da conta, do perfil e os arquivos enviados enquanto sua conta existir. Se você pedir a exclusão, apagamos esses dados em até 30 dias, exceto o que a lei nos obrigar a manter (por exemplo, registros de acesso, por 6 meses). Os dados que ficam só no aparelho permanecem até você apagá-los, criar outra conta no mesmo aparelho ou desinstalar o app.',
          'Os dados da lista de espera ficam guardados até o aviso de lançamento ser enviado. Você pode pedir a remoção antes disso pelo e-mail {email}.',
        ],
      },
      {
        title: '10. Segurança',
        paragraphs: [
          'Os dados viajam com conexão criptografada e cada conta só acessa os próprios dados na nuvem. Lembre-se de que os arquivos enviados podem ser abertos por quem tiver o link. Nenhum sistema é 100% seguro; se ocorrer um incidente relevante, avisaremos você e as autoridades, como manda a lei.',
        ],
      },
      {
        title: '11. Seus direitos',
        paragraphs: [
          'Você pode pedir a confirmação de que tratamos seus dados, o acesso, a correção, a anonimização, a portabilidade, a exclusão, informações sobre compartilhamento e a revogação do consentimento, além de se opor a tratamentos. Seu nome, negócio e WhatsApp podem ser corrigidos no próprio app, em Conta. Para os demais pedidos, escreva para {email}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) ou à autoridade do seu país.',
        ],
      },
      {
        title: '12. Dados dos seus clientes',
        paragraphs: [
          'Os dados dos seus clientes que você registra no CRM ficam no seu aparelho e são de sua responsabilidade como controlador. Use-os apenas para atender esses clientes e com a autorização deles.',
        ],
      },
      {
        title: '13. Crianças',
        paragraphs: ['O KEYCON é destinado a maiores de 18 anos e não coleta intencionalmente dados de crianças ou adolescentes.'],
      },
      {
        title: '14. Alterações desta Política',
        paragraphs: ['Podemos atualizar esta Política. Quando a mudança for relevante, avisaremos no app. A data da última atualização aparece no topo.'],
      },
      {
        title: '15. Contato e encarregado de dados',
        paragraphs: ['Para falar sobre privacidade ou com o nosso encarregado pelo tratamento de dados pessoais: {email}.'],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      {
        title: '1. Who we are',
        paragraphs: [
          'This Policy explains how {company} ("we"), a Florida profit corporation located at {address}, handles the personal data of people who use the KEYCON app and keyboard, in accordance with Brazil\'s General Data Protection Law (LGPD) and, where applicable, other data protection laws such as the EU GDPR and U.S. state privacy laws.',
        ],
      },
      {
        title: '2. Data we store in the cloud',
        paragraphs: [
          'Account: email and password. The password is stored securely by our authentication provider; we do not have access to it.',
          'Sign in with Google or Apple: if you sign in with one of them, we receive your name, email and profile photo (with Apple, you can hide your email and use an Apple relay address). We use this data only to create and identify your account.',
          'Google Calendar and Google Meet: if you sign in with Google, we ask for permission to create events in your calendar (calendar.events scope), only to create the appointments you schedule in KEYCON with a Google Meet link. We do not read, change or delete the other events in your calendar. The access token stays on your device; to renew it, the refresh token goes through a secure function on our server, which stores nothing. KEYCON’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements: this data is not sold, not used for advertising or to train artificial intelligence models, and not shared with third parties except as needed to provide this feature or when required by law. You can remove KEYCON’s access at any time at myaccount.google.com/permissions.',
          'Profile: your name, business name, WhatsApp, line of business, language and the country where you sell. They appear in your ready-made messages and tailor the app to your business.',
          'Files you upload: photos, videos and audios you choose to add to your catalog, shortcuts or the Files section. They are available through a public link so the keyboard can send them in your chats.',
          'Technical data: access logs kept by our providers (such as date, time and IP address), required for security and by law.',
          'Website waitlist: if you sign up to be notified about the launch, we keep your email, the type of phone you chose (iPhone or Android) and the language of the page. We use this data only to tell you when KEYCON is available for your phone.',
        ],
      },
      {
        title: '3. Data that stays only on your device',
        paragraphs: [
          'Your products and categories, text, audio and link shortcuts, CRM clients (name, WhatsApp, tags, notes), calendar appointments, the organization of your Files folders and your preferences are stored only on your phone and shared between the KEYCON app and keyboard. We do not receive this data.',
        ],
      },
      {
        title: '4. The keyboard and what you type',
        paragraphs: [
          'What you type with the KEYCON keyboard is processed only on your device, to correct words and suggest the next ones. We do not store, log or send the text you type. In password, email and link fields the keyboard turns off suggestions and autocorrect.',
          'Clipboard: KEYCON only reads copied text when you tap the AI button to ask for a reply suggestion.',
        ],
      },
      {
        title: '5. Phone permissions',
        paragraphs: [
          'Microphone: used only while you record an audio shortcut, after you allow it.',
          'Photos, videos and camera: KEYCON uses the system\'s own file picker and camera; it only receives the file you choose or capture.',
          'Internet and vibration: to send and receive data and for the vibration when you rearrange the keyboard menu.',
        ],
      },
      {
        title: '6. Artificial intelligence',
        paragraphs: [
          'When you ask for a reply suggestion, the client message you copied, your business name and information about related products are sent to our server and to an artificial intelligence provider, only to generate the suggestions. We do not use this data for any other purpose. While the AI is in demo mode, nothing is sent.',
        ],
      },
      {
        title: '7. How we use data and legal bases',
        paragraphs: [
          'We use data to create and maintain your account, provide KEYCON\'s features, send your files in chats, offer support, keep the service secure and meet legal obligations. The legal bases are performance of our contract with you, compliance with legal obligations, our legitimate interest in keeping the service secure and, for the microphone, your consent.',
        ],
      },
      {
        title: '8. Who we share data with',
        paragraphs: [
          'With providers that help us run the service: hosting, database, authentication and file storage (Supabase) and, when AI is active, the artificial intelligence provider. They may use the data only to provide those services. We may also share data when required by law or court order. We do not sell your data.',
          'These providers may keep servers outside Brazil. In those cases we apply the safeguards required by the LGPD for international transfers.',
        ],
      },
      {
        title: '9. How long we keep data',
        paragraphs: [
          'We keep account and profile data and uploaded files while your account exists. If you ask us to delete them, we delete this data within 30 days, except what the law requires us to keep (for example, access logs, for 6 months). Data that stays only on your device remains until you delete it, create another account on the same device or uninstall the app.',
          'Waitlist data is kept until the launch notice is sent. You can ask us to remove it before then by writing to {email}.',
        ],
      },
      {
        title: '10. Security',
        paragraphs: [
          'Data travels over encrypted connections and each account can only access its own data in the cloud. Remember that uploaded files can be opened by anyone who has the link. No system is 100% secure; if a significant incident occurs, we will notify you and the authorities as required by law.',
        ],
      },
      {
        title: '11. Your rights',
        paragraphs: [
          'You can ask us to confirm that we process your data and request access, correction, anonymization, portability, deletion, information about sharing and withdrawal of consent, and you can object to processing. California residents may also request to know and delete personal information; we do not sell or share personal information for targeted advertising. Your name, business and WhatsApp can be corrected in the app under Account. For other requests, write to {email}. You may also complain to Brazil\'s National Data Protection Authority (ANPD) or to the authority in your country.',
        ],
      },
      {
        title: '12. Your clients\' data',
        paragraphs: [
          'Your clients\' data that you record in the CRM stays on your device and is your responsibility as controller. Use it only to serve those clients and with their permission.',
        ],
      },
      {
        title: '13. Children',
        paragraphs: ['KEYCON is intended for people aged 18 and over and does not knowingly collect data from children or teenagers.'],
      },
      {
        title: '14. Changes to this Policy',
        paragraphs: ['We may update this Policy. If a change is significant, we will let you know in the app. The date of the last update appears at the top.'],
      },
      {
        title: '15. Contact and data protection officer',
        paragraphs: ['To talk about privacy or reach our data protection officer: {email}.'],
      },
    ],
  },
  es: {
    title: 'Política de Privacidad',
    sections: [
      {
        title: '1. Quiénes somos',
        paragraphs: [
          'Esta Política explica cómo {company} ("nosotros"), sociedad registrada en el estado de Florida (EE. UU.), con domicilio en {address}, trata los datos personales de quienes usan la app y el teclado KEYCON, de acuerdo con la Ley General de Protección de Datos de Brasil (LGPD) y, cuando corresponda, con otras leyes de protección de datos, como el RGPD europeo y las leyes de privacidad de tu país.',
        ],
      },
      {
        title: '2. Datos que guardamos en la nube',
        paragraphs: [
          'Cuenta: correo y contraseña. La contraseña la guarda de forma protegida nuestro proveedor de autenticación; no tenemos acceso a ella.',
          'Inicio de sesión con Google o con Apple: si entras con uno de ellos, recibimos tu nombre, correo y foto de perfil (con Apple, puedes ocultar tu correo y usar una dirección de reenvío de Apple). Usamos estos datos solo para crear e identificar tu cuenta.',
          'Google Calendar y Google Meet: si entras con Google, pedimos permiso para crear eventos en tu calendario (alcance calendar.events), solo para crear con enlace de Google Meet las citas que agendas en KEYCON. No leemos, no cambiamos ni borramos los demás eventos de tu calendario. El token de acceso queda en tu dispositivo; para renovarlo, el token de renovación pasa por una función segura en nuestro servidor, que no guarda nada. El uso y la transferencia de la información recibida de las API de Google cumplen la Política de Datos del Usuario de los Servicios de API de Google, incluidos los requisitos de Uso Limitado: estos datos no se venden, no se usan para publicidad ni para entrenar modelos de inteligencia artificial, y no se comparten con terceros, salvo cuando es necesario para ofrecer esta función o cuando la ley lo exige. Puedes quitar el acceso de KEYCON en cualquier momento en myaccount.google.com/permissions.',
          'Perfil: tu nombre, nombre del negocio, WhatsApp, rubro, idioma y país donde vendes. Aparecen en tus mensajes listos y adaptan la app a tu negocio.',
          'Archivos que subes: fotos, videos y audios que eliges agregar al catálogo, a los accesos rápidos o a la sección Archivos. Quedan accesibles mediante un enlace público para que el teclado pueda enviarlos en las conversaciones.',
          'Datos técnicos: registros de acceso que mantienen nuestros proveedores (como fecha, hora y dirección IP), exigidos por seguridad y por la ley.',
          'Lista de espera del sitio: si te inscribes para recibir el aviso del lanzamiento, guardamos tu correo, el tipo de celular que elegiste (iPhone o Android) y el idioma de la página. Usamos estos datos solo para avisarte cuando KEYCON esté disponible para tu celular.',
        ],
      },
      {
        title: '3. Datos que quedan solo en tu dispositivo',
        paragraphs: [
          'Tus productos y categorías, accesos rápidos de texto, audio y enlace, clientes del CRM (nombre, WhatsApp, etiquetas, notas), citas de la agenda, la organización de las carpetas de Archivos y tus preferencias se guardan solo en tu celular y se comparten entre la app y el teclado KEYCON. No recibimos estos datos.',
        ],
      },
      {
        title: '4. El teclado y lo que escribes',
        paragraphs: [
          'Lo que escribes con el teclado KEYCON se procesa solo en tu dispositivo, para corregir palabras y sugerir las siguientes. No guardamos, no registramos y no enviamos el texto que escribes. En campos de contraseña, correo y enlace el teclado desactiva las sugerencias y la corrección automática.',
          'Portapapeles: KEYCON solo lee el texto copiado cuando tocas el botón de IA para pedir una sugerencia de respuesta.',
        ],
      },
      {
        title: '5. Permisos del celular',
        paragraphs: [
          'Micrófono: se usa solo mientras grabas un acceso rápido de audio, después de que lo autorices.',
          'Fotos, videos y cámara: KEYCON usa el selector de archivos y la cámara del propio sistema; solo recibe el archivo que elijas o captures.',
          'Internet y vibración: para enviar y recibir datos y para la vibración al reorganizar el menú del teclado.',
        ],
      },
      {
        title: '6. Inteligencia artificial',
        paragraphs: [
          'Cuando pides una sugerencia de respuesta, el mensaje del cliente que copiaste, el nombre de tu negocio e información de los productos relacionados se envían a nuestro servidor y a un proveedor de inteligencia artificial, solo para generar las sugerencias. No usamos estos datos para otros fines. Mientras la IA esté en modo de demostración, no se envía nada.',
        ],
      },
      {
        title: '7. Para qué usamos los datos y bases legales',
        paragraphs: [
          'Usamos los datos para crear y mantener tu cuenta, prestar las funciones de KEYCON, enviar tus archivos en las conversaciones, dar soporte, mantener la seguridad y cumplir obligaciones legales. Las bases legales son la ejecución del contrato contigo, el cumplimiento de obligaciones legales, nuestro interés legítimo en mantener el servicio seguro y, para el micrófono, tu consentimiento.',
        ],
      },
      {
        title: '8. Con quién compartimos',
        paragraphs: [
          'Con proveedores que nos ayudan a prestar el servicio: alojamiento, base de datos, autenticación y almacenamiento de archivos (Supabase) y, cuando la IA esté activa, el proveedor de inteligencia artificial. Solo pueden usar los datos para prestar esos servicios. También podemos compartir datos cuando lo exija la ley o una orden judicial. No vendemos tus datos.',
          'Estos proveedores pueden tener servidores fuera de Brasil. En esos casos, aplicamos las garantías que exige la LGPD para la transferencia internacional.',
        ],
      },
      {
        title: '9. Cuánto tiempo guardamos los datos',
        paragraphs: [
          'Guardamos los datos de la cuenta, del perfil y los archivos subidos mientras exista tu cuenta. Si pides la eliminación, borramos estos datos en un plazo de 30 días, salvo lo que la ley nos obligue a conservar (por ejemplo, registros de acceso, por 6 meses). Los datos que quedan solo en el dispositivo permanecen hasta que los borres, crees otra cuenta en el mismo dispositivo o desinstales la app.',
          'Los datos de la lista de espera se guardan hasta enviar el aviso de lanzamiento. Puedes pedir que los borremos antes escribiendo a {email}.',
        ],
      },
      {
        title: '10. Seguridad',
        paragraphs: [
          'Los datos viajan con conexión cifrada y cada cuenta solo accede a sus propios datos en la nube. Recuerda que los archivos subidos pueden abrirlos quienes tengan el enlace. Ningún sistema es 100% seguro; si ocurre un incidente relevante, te avisaremos a ti y a las autoridades, como exige la ley.',
        ],
      },
      {
        title: '11. Tus derechos',
        paragraphs: [
          'Puedes pedir la confirmación de que tratamos tus datos, el acceso, la corrección, la anonimización, la portabilidad, la eliminación, información sobre el uso compartido y la revocación del consentimiento, además de oponerte a tratamientos. Tu nombre, negocio y WhatsApp pueden corregirse en la propia app, en Cuenta. Para los demás pedidos, escribe a {email}. También puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos de Brasil (ANPD) o ante la autoridad de tu país.',
        ],
      },
      {
        title: '12. Datos de tus clientes',
        paragraphs: [
          'Los datos de tus clientes que registras en el CRM quedan en tu dispositivo y son tu responsabilidad como responsable del tratamiento. Úsalos solo para atender a esos clientes y con su autorización.',
        ],
      },
      {
        title: '13. Menores de edad',
        paragraphs: ['KEYCON está destinado a mayores de 18 años y no recopila intencionalmente datos de niños o adolescentes.'],
      },
      {
        title: '14. Cambios en esta Política',
        paragraphs: ['Podemos actualizar esta Política. Si el cambio es relevante, te avisaremos en la app. La fecha de la última actualización aparece arriba.'],
      },
      {
        title: '15. Contacto y delegado de protección de datos',
        paragraphs: ['Para hablar sobre privacidad o contactar a nuestro delegado de protección de datos: {email}.'],
      },
    ],
  },
};
