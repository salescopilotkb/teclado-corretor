/**
 * Termos de Uso e Política de Privacidade do KEYCON (pt, en, es).
 *
 * Os textos descrevem o que o app faz hoje: conta e perfil na nuvem
 * (Supabase), Locker na nuvem (arquivos privados no Cloudflare R2, organização no
 * Supabase, links permanentes só do que a pessoa compartilha, compartilhar com
 * e-mails e equipes, lixeira de 30 dias, Locker web no navegador), fotos/vídeos/
 * áudios do catálogo e dos atalhos em links públicos, catálogo/atalhos/clientes/
 * agenda só no aparelho, lista de espera do site (e-mail,
 * celular e idioma), teclado que processa o que é
 * digitado só no aparelho. A IA saiu por enquanto (ver IMPLEMENTACOES-FUTURAS.md).
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
export const LEGAL_UPDATED = '2026-10-31';

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
          'O KEYCON é um aplicativo de apoio a vendas composto por um app e por um teclado para o celular. Ele permite organizar produtos, arquivos, atalhos de mensagens, clientes e compromissos, e enviar esse conteúdo nas conversas com seus clientes, além de oferecer correção ortográfica e sugestões de palavras.',
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
          'Os arquivos do Locker (a área de arquivos do app, do teclado e do site locker.keyconapp.com) ficam privados. Quem você escolher pode abri-los: quem recebe o link de um arquivo, quem recebe o link de uma pasta que você deixou como "com o link" ou "pública", e as pessoas e equipes com quem você compartilha. Você é responsável por esses compartilhamentos.',
          'As fotos, vídeos e áudios do catálogo de produtos e dos atalhos ficam acessíveis por um link público, para que o teclado consiga enviá-los: qualquer pessoa que tenha o link pode abrir o arquivo.',
          'O espaço do Locker depende do seu plano (por exemplo, 5 GB no plano Basic) e cada arquivo tem um tamanho máximo (foto 16 MB, vídeo 64 MB, outros 10 MB). O que vai para a lixeira do Locker fica lá por 30 dias e depois é apagado para sempre. Não use o Locker para guardar conteúdo ilegal ou que viole direitos de terceiros; podemos remover esse conteúdo e suspender a conta.',
        ],
      },
      {
        title: '6. Mensagens e dados dos seus clientes',
        paragraphs: [
          'Você é o único responsável pelas mensagens que envia aos seus clientes e por ter a autorização deles para contatá-los. Os dados dos seus clientes que você registra no KEYCON (como nome, WhatsApp, etiquetas e anotações) ficam no seu aparelho, e você atua como controlador desses dados perante a legislação de proteção de dados.',
        ],
      },
      {
        title: '7. Serviços de terceiros',
        paragraphs: [
          'O KEYCON funciona junto com serviços de terceiros, como o sistema do seu celular, os aplicativos de mensagens, os provedores de nuvem e as lojas de aplicativos. O uso desses serviços está sujeito aos termos de cada um, e não respondemos por falhas ou mudanças deles.',
        ],
      },
      {
        title: '8. Disponibilidade e mudanças',
        paragraphs: [
          'Trabalhamos para manter o KEYCON disponível e funcionando bem, mas não garantimos que ele estará livre de erros ou interrupções. Podemos alterar, incluir ou remover recursos a qualquer momento, inclusive em versões de teste.',
        ],
      },
      {
        title: '9. Limitação de responsabilidade',
        paragraphs: [
          'Na máxima extensão permitida pela lei, o KEYCON é oferecido "no estado em que se encontra". Não respondemos por perdas indiretas, lucros cessantes, perda de dados mantidos apenas no seu aparelho ou por danos causados pelo conteúdo que você envia. Nada nestes Termos afasta direitos que a lei garante ao consumidor.',
        ],
      },
      {
        title: '10. Encerramento',
        paragraphs: [
          'Você pode parar de usar o KEYCON e pedir a exclusão da sua conta a qualquer momento pelo e-mail {email}. Podemos suspender ou encerrar contas que violem estes Termos ou a lei.',
        ],
      },
      {
        title: '11. Alterações destes Termos',
        paragraphs: [
          'Podemos atualizar estes Termos. Quando a mudança for relevante, avisaremos no app. Continuar usando o KEYCON depois do aviso significa que você aceita a nova versão.',
        ],
      },
      {
        title: '12. Lei aplicável e foro',
        paragraphs: [
          'Estes Termos seguem as leis do Estado da Flórida (EUA), sem prejuízo das normas obrigatórias de proteção ao consumidor do seu país de residência, como o Código de Defesa do Consumidor no Brasil. Fica eleito o foro de {city}, ressalvado o direito do consumidor de propor ação no foro do seu domicílio.',
        ],
      },
      {
        title: '13. Contato',
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
          'KEYCON is a sales-support app made of an app and a phone keyboard. It lets you organize products, files, message shortcuts, clients and appointments and send this content in your chats with clients, and it offers spell checking and word suggestions.',
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
          'Locker files (the files area of the app, the keyboard and the locker.keyconapp.com website) are private. Only the people you choose can open them: whoever receives the link to a file, whoever receives the link to a folder you set as "with the link" or "public", and the people and teams you share with. You are responsible for what you share.',
          'Photos, videos and audios in your product catalog and shortcuts are available through a public link so the keyboard can send them: anyone who has the link can open the file.',
          'Locker storage depends on your plan (for example, 5 GB on the Basic plan) and each file has a maximum size (photo 16 MB, video 64 MB, others 10 MB). Items moved to the Locker trash stay there for 30 days and are then deleted forever. Do not use the Locker to store illegal content or content that infringes the rights of others; we may remove such content and suspend the account.',
        ],
      },
      {
        title: '6. Messages and your clients\' data',
        paragraphs: [
          'You are solely responsible for the messages you send to your clients and for having their permission to contact them. Your clients\' data that you record in KEYCON (such as name, WhatsApp, tags and notes) stays on your device, and you act as the controller of that data under data protection laws.',
        ],
      },
      {
        title: '7. Third-party services',
        paragraphs: [
          'KEYCON works together with third-party services such as your phone\'s operating system, messaging apps, cloud providers and app stores. Your use of those services is subject to their own terms, and we are not responsible for their failures or changes.',
        ],
      },
      {
        title: '8. Availability and changes',
        paragraphs: [
          'We work to keep KEYCON available and working well, but we do not guarantee that it will be free of errors or interruptions. We may change, add or remove features at any time, including in test versions.',
        ],
      },
      {
        title: '9. Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law, KEYCON is provided "as is". We are not liable for indirect losses, lost profits, loss of data kept only on your device, or damage caused by content you send. Nothing in these Terms limits rights that consumer law grants you.',
        ],
      },
      {
        title: '10. Termination',
        paragraphs: [
          'You may stop using KEYCON and request deletion of your account at any time at {email}. We may suspend or close accounts that violate these Terms or the law.',
        ],
      },
      {
        title: '11. Changes to these Terms',
        paragraphs: [
          'We may update these Terms. If a change is significant, we will let you know in the app. Continuing to use KEYCON after the notice means you accept the new version.',
        ],
      },
      {
        title: '12. Governing law and jurisdiction',
        paragraphs: [
          'These Terms are governed by the laws of the State of Florida, United States, without prejudice to mandatory consumer protection laws of your country of residence. The courts of {city} have jurisdiction, without prejudice to your right as a consumer to bring a claim in the courts where you live.',
        ],
      },
      {
        title: '13. Contact',
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
          'KEYCON es una aplicación de apoyo a las ventas formada por una app y un teclado para el celular. Permite organizar productos, archivos, accesos rápidos de mensajes, clientes y citas, y enviar ese contenido en las conversaciones con tus clientes, además de ofrecer corrección ortográfica y sugerencias de palabras.',
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
          'Los archivos del Locker (el área de archivos de la app, del teclado y del sitio locker.keyconapp.com) son privados. Solo pueden abrirlos quienes tú elijas: quien reciba el enlace de un archivo, quien reciba el enlace de una carpeta que dejaste "con el enlace" o "pública", y las personas y equipos con quienes compartas. Eres responsable de lo que compartes.',
          'Las fotos, videos y audios del catálogo de productos y de los accesos rápidos quedan accesibles mediante un enlace público, para que el teclado pueda enviarlos: cualquier persona que tenga el enlace puede abrir el archivo.',
          'El espacio del Locker depende de tu plan (por ejemplo, 5 GB en el plan Basic) y cada archivo tiene un tamaño máximo (foto 16 MB, video 64 MB, otros 10 MB). Lo que va a la papelera del Locker queda ahí 30 días y luego se elimina para siempre. No uses el Locker para guardar contenido ilegal o que viole derechos de terceros; podemos eliminar ese contenido y suspender la cuenta.',
        ],
      },
      {
        title: '6. Mensajes y datos de tus clientes',
        paragraphs: [
          'Eres el único responsable de los mensajes que envías a tus clientes y de tener su autorización para contactarlos. Los datos de tus clientes que registras en KEYCON (como nombre, WhatsApp, etiquetas y notas) quedan en tu dispositivo, y actúas como responsable de esos datos ante la legislación de protección de datos.',
        ],
      },
      {
        title: '7. Servicios de terceros',
        paragraphs: [
          'KEYCON funciona junto con servicios de terceros, como el sistema de tu celular, las aplicaciones de mensajería, los proveedores de nube y las tiendas de aplicaciones. El uso de esos servicios está sujeto a sus propios términos, y no respondemos por sus fallas o cambios.',
        ],
      },
      {
        title: '8. Disponibilidad y cambios',
        paragraphs: [
          'Trabajamos para mantener KEYCON disponible y funcionando bien, pero no garantizamos que esté libre de errores o interrupciones. Podemos cambiar, incluir o quitar funciones en cualquier momento, incluso en versiones de prueba.',
        ],
      },
      {
        title: '9. Limitación de responsabilidad',
        paragraphs: [
          'En la máxima medida permitida por la ley, KEYCON se ofrece "tal cual". No respondemos por pérdidas indirectas, lucro cesante, pérdida de datos guardados solo en tu dispositivo ni por daños causados por el contenido que envías. Nada en estos Términos limita los derechos que la ley otorga al consumidor.',
        ],
      },
      {
        title: '10. Terminación',
        paragraphs: [
          'Puedes dejar de usar KEYCON y pedir la eliminación de tu cuenta en cualquier momento escribiendo a {email}. Podemos suspender o cerrar cuentas que violen estos Términos o la ley.',
        ],
      },
      {
        title: '11. Cambios en estos Términos',
        paragraphs: [
          'Podemos actualizar estos Términos. Si el cambio es relevante, te avisaremos en la app. Seguir usando KEYCON después del aviso significa que aceptas la nueva versión.',
        ],
      },
      {
        title: '12. Ley aplicable y jurisdicción',
        paragraphs: [
          'Estos Términos se rigen por las leyes del Estado de Florida (EE. UU.), sin perjuicio de las normas obligatorias de protección al consumidor de tu país de residencia. Son competentes los tribunales de {city}, sin perjuicio de tu derecho como consumidor a presentar una demanda en los tribunales de tu domicilio.',
        ],
      },
      {
        title: '13. Contacto',
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
          'Perfil: seu nome, nome do negócio, WhatsApp, ramo do negócio, idioma e país onde você vende. Eles aparecem nas suas mensagens prontas e ajustam o app ao seu negócio.',
          'Locker: os arquivos que você envia (fotos, vídeos, áudios, PDFs e documentos), com nome, tipo, tamanho e datas, e a organização deles (pastas, ordem, o que aparece no teclado, estrela e lixeira). A organização fica no nosso banco de dados e sincroniza o app, o teclado e o site locker.keyconapp.com; os arquivos ficam guardados de forma privada no nosso provedor de armazenamento e são abertos por links temporários.',
          'Compartilhamento no Locker: os e-mails das pessoas com quem você compartilha pastas ou arquivos, as equipes que você cria (nome e e-mails dos participantes) e quem pode ver cada pasta. Quem recebe um compartilhamento vê o seu e-mail como dono.',
          'Fotos, vídeos e áudios do catálogo de produtos e dos atalhos: ficam acessíveis por um link público, para que o teclado consiga enviá-los nas conversas.',
          'Plano do Locker: o seu plano de armazenamento e o espaço usado.',
          'Dados técnicos: registros de acesso mantidos pelos nossos provedores (como data, hora e endereço IP), exigidos para segurança e pela lei.',
          'Lista de espera do site: se você se inscrever para ser avisado do lançamento, guardamos seu e-mail, o tipo de celular que você escolheu (iPhone ou Android) e o idioma da página. Usamos esses dados só para avisar quando o KEYCON estiver disponível no seu celular.',
        ],
      },
      {
        title: '3. Dados que ficam só no seu aparelho',
        paragraphs: [
          'Seus produtos e categorias, atalhos de texto, áudio e link, clientes do CRM (nome, WhatsApp, etiquetas, anotações), compromissos da agenda e as suas preferências ficam guardados apenas no seu celular, compartilhados entre o app e o teclado KEYCON. Nós não recebemos esses dados.',
          'No navegador, o Locker web guarda no seu aparelho a sua sessão, o idioma escolhido, uma cópia da organização para abrir sem internet e, se você marcar "Disponível sem internet", cópias desses arquivos. Ao sair da conta no Locker web, apagamos essas cópias. Não usamos cookies de publicidade nem ferramentas de rastreamento.',
        ],
      },
      {
        title: '4. O teclado e o que você digita',
        paragraphs: [
          'O que você digita com o teclado KEYCON é processado somente no seu aparelho, para corrigir palavras e sugerir as próximas. Não guardamos, não registramos e não enviamos o texto que você digita. Em campos de senha, e-mail e link o teclado desliga as sugestões e a correção automática.',
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
        title: '6. Para que usamos os dados e bases legais',
        paragraphs: [
          'Usamos os dados para criar e manter sua conta, prestar os recursos do KEYCON (inclusive guardar e sincronizar o Locker entre o app, o teclado e o site, e os compartilhamentos que você fizer), enviar seus arquivos nas conversas, dar suporte, garantir a segurança e cumprir obrigações legais. As bases legais são a execução do contrato com você, o cumprimento de obrigação legal, o nosso legítimo interesse em manter o serviço seguro e, para o microfone, o seu consentimento.',
        ],
      },
      {
        title: '7. Com quem compartilhamos',
        paragraphs: [
          'Com provedores que nos ajudam a prestar o serviço: banco de dados, autenticação e armazenamento (Supabase), armazenamento dos arquivos do Locker (Cloudflare) e hospedagem do site. Eles só podem usar os dados para prestar esses serviços. Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir. Nós não vendemos seus dados.',
          'Com quem você escolher, no Locker: as pessoas e equipes com quem você compartilha e quem recebe os links que você envia.',
          'Esses provedores podem manter servidores fora do Brasil. Nesses casos, adotamos as garantias previstas na LGPD para a transferência internacional.',
        ],
      },
      {
        title: '8. Por quanto tempo guardamos',
        paragraphs: [
          'Guardamos os dados da conta, do perfil, o Locker e os arquivos enviados enquanto sua conta existir. O que você manda para a lixeira do Locker é apagado para sempre depois de 30 dias (ou antes, se você esvaziar a lixeira). Se você pedir a exclusão da conta, apagamos esses dados, inclusive os arquivos do Locker, em até 30 dias, exceto o que a lei nos obrigar a manter (por exemplo, registros de acesso, por 6 meses). Os dados que ficam só no aparelho permanecem até você apagá-los, criar outra conta no mesmo aparelho ou desinstalar o app.',
          'Os dados da lista de espera ficam guardados até o aviso de lançamento ser enviado. Você pode pedir a remoção antes disso pelo e-mail {email}.',
        ],
      },
      {
        title: '9. Segurança',
        paragraphs: [
          'Os dados viajam com conexão criptografada e cada conta só acessa os próprios dados na nuvem, além do que outras pessoas compartilharem com ela. Os arquivos do Locker são privados e abertos por links que vencem; só ficam abertos a quem tiver o link os arquivos que você compartilha e as pastas que você deixa "com o link" ou "públicas". As fotos, vídeos e áudios do catálogo e dos atalhos podem ser abertos por quem tiver o link. Nenhum sistema é 100% seguro; se ocorrer um incidente relevante, avisaremos você e as autoridades, como manda a lei.',
        ],
      },
      {
        title: '10. Seus direitos',
        paragraphs: [
          'Você pode pedir a confirmação de que tratamos seus dados, o acesso, a correção, a anonimização, a portabilidade, a exclusão, informações sobre compartilhamento e a revogação do consentimento, além de se opor a tratamentos. Seu nome, negócio e WhatsApp podem ser corrigidos no próprio app, em Conta. Para os demais pedidos, escreva para {email}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) ou à autoridade do seu país.',
        ],
      },
      {
        title: '11. Dados dos seus clientes',
        paragraphs: [
          'Os dados dos seus clientes que você registra no CRM ficam no seu aparelho e são de sua responsabilidade como controlador. Use-os apenas para atender esses clientes e com a autorização deles.',
        ],
      },
      {
        title: '12. Crianças',
        paragraphs: ['O KEYCON é destinado a maiores de 18 anos e não coleta intencionalmente dados de crianças ou adolescentes.'],
      },
      {
        title: '13. Alterações desta Política',
        paragraphs: ['Podemos atualizar esta Política. Quando a mudança for relevante, avisaremos no app. A data da última atualização aparece no topo.'],
      },
      {
        title: '14. Contato e encarregado de dados',
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
          'Profile: your name, business name, WhatsApp, line of business, language and the country where you sell. They appear in your ready-made messages and tailor the app to your business.',
          'Locker: the files you upload (photos, videos, audios, PDFs and documents), with name, type, size and dates, and how they are organized (folders, order, what shows on the keyboard, stars and trash). The organization is kept in our database and syncs the app, the keyboard and the locker.keyconapp.com website; the files are stored privately with our storage provider and opened through temporary links.',
          'Locker sharing: the email addresses of people you share folders or files with, the teams you create (name and members\' emails) and who can see each folder. People who receive a share see your email as the owner.',
          'Photos, videos and audios in your product catalog and shortcuts: available through a public link so the keyboard can send them in your chats.',
          'Locker plan: your storage plan and the space used.',
          'Technical data: access logs kept by our providers (such as date, time and IP address), required for security and by law.',
          'Website waitlist: if you sign up to be notified about the launch, we keep your email, the type of phone you chose (iPhone or Android) and the language of the page. We use this data only to tell you when KEYCON is available for your phone.',
        ],
      },
      {
        title: '3. Data that stays only on your device',
        paragraphs: [
          'Your products and categories, text, audio and link shortcuts, CRM clients (name, WhatsApp, tags, notes), calendar appointments and your preferences are stored only on your phone and shared between the KEYCON app and keyboard. We do not receive this data.',
          'In the browser, the Locker website keeps on your device your session, the language you chose, a copy of your Locker organization to open offline and, if you mark files as "Available offline", copies of those files. When you sign out of the Locker website, we delete these copies. We do not use advertising cookies or tracking tools.',
        ],
      },
      {
        title: '4. The keyboard and what you type',
        paragraphs: [
          'What you type with the KEYCON keyboard is processed only on your device, to correct words and suggest the next ones. We do not store, log or send the text you type. In password, email and link fields the keyboard turns off suggestions and autocorrect.',
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
        title: '6. How we use data and legal bases',
        paragraphs: [
          'We use data to create and maintain your account, provide KEYCON\'s features (including storing and syncing your Locker across the app, keyboard and website, and the shares you make), send your files in chats, offer support, keep the service secure and meet legal obligations. The legal bases are performance of our contract with you, compliance with legal obligations, our legitimate interest in keeping the service secure and, for the microphone, your consent.',
        ],
      },
      {
        title: '7. Who we share data with',
        paragraphs: [
          'With providers that help us run the service: database, authentication and storage (Supabase), Locker file storage (Cloudflare) and website hosting. They may use the data only to provide those services. We may also share data when required by law or court order. We do not sell your data.',
          'With whoever you choose in the Locker: the people and teams you share with and the people who receive the links you send.',
          'These providers may keep servers outside Brazil. In those cases we apply the safeguards required by the LGPD for international transfers.',
        ],
      },
      {
        title: '8. How long we keep data',
        paragraphs: [
          'We keep account and profile data, your Locker and uploaded files while your account exists. Items you move to the Locker trash are deleted forever after 30 days (or sooner, if you empty the trash). If you ask us to delete your account, we delete this data, including your Locker files, within 30 days, except what the law requires us to keep (for example, access logs, for 6 months). Data that stays only on your device remains until you delete it, create another account on the same device or uninstall the app.',
          'Waitlist data is kept until the launch notice is sent. You can ask us to remove it before then by writing to {email}.',
        ],
      },
      {
        title: '9. Security',
        paragraphs: [
          'Data travels over encrypted connections and each account can only access its own data in the cloud, plus what other people share with it. Locker files are private and opened through links that expire; only the files you share and the folders you set as "with the link" or "public" are open to whoever has the link. Photos, videos and audios in your catalog and shortcuts can be opened by anyone who has the link. No system is 100% secure; if a significant incident occurs, we will notify you and the authorities as required by law.',
        ],
      },
      {
        title: '10. Your rights',
        paragraphs: [
          'You can ask us to confirm that we process your data and request access, correction, anonymization, portability, deletion, information about sharing and withdrawal of consent, and you can object to processing. California residents may also request to know and delete personal information; we do not sell or share personal information for targeted advertising. Your name, business and WhatsApp can be corrected in the app under Account. For other requests, write to {email}. You may also complain to Brazil\'s National Data Protection Authority (ANPD) or to the authority in your country.',
        ],
      },
      {
        title: '11. Your clients\' data',
        paragraphs: [
          'Your clients\' data that you record in the CRM stays on your device and is your responsibility as controller. Use it only to serve those clients and with their permission.',
        ],
      },
      {
        title: '12. Children',
        paragraphs: ['KEYCON is intended for people aged 18 and over and does not knowingly collect data from children or teenagers.'],
      },
      {
        title: '13. Changes to this Policy',
        paragraphs: ['We may update this Policy. If a change is significant, we will let you know in the app. The date of the last update appears at the top.'],
      },
      {
        title: '14. Contact and data protection officer',
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
          'Perfil: tu nombre, nombre del negocio, WhatsApp, rubro, idioma y país donde vendes. Aparecen en tus mensajes listos y adaptan la app a tu negocio.',
          'Locker: los archivos que subes (fotos, videos, audios, PDF y documentos), con nombre, tipo, tamaño y fechas, y su organización (carpetas, orden, lo que aparece en el teclado, destacados y papelera). La organización se guarda en nuestra base de datos y sincroniza la app, el teclado y el sitio locker.keyconapp.com; los archivos se guardan de forma privada en nuestro proveedor de almacenamiento y se abren mediante enlaces temporales.',
          'Compartir en el Locker: los correos de las personas con quienes compartes carpetas o archivos, los equipos que creas (nombre y correos de los miembros) y quién puede ver cada carpeta. Quien recibe algo compartido ve tu correo como dueño.',
          'Fotos, videos y audios del catálogo de productos y de los accesos rápidos: quedan accesibles mediante un enlace público para que el teclado pueda enviarlos en las conversaciones.',
          'Plan del Locker: tu plan de almacenamiento y el espacio usado.',
          'Datos técnicos: registros de acceso que mantienen nuestros proveedores (como fecha, hora y dirección IP), exigidos por seguridad y por la ley.',
          'Lista de espera del sitio: si te inscribes para recibir el aviso del lanzamiento, guardamos tu correo, el tipo de celular que elegiste (iPhone o Android) y el idioma de la página. Usamos estos datos solo para avisarte cuando KEYCON esté disponible para tu celular.',
        ],
      },
      {
        title: '3. Datos que quedan solo en tu dispositivo',
        paragraphs: [
          'Tus productos y categorías, accesos rápidos de texto, audio y enlace, clientes del CRM (nombre, WhatsApp, etiquetas, notas), citas de la agenda y tus preferencias se guardan solo en tu celular y se comparten entre la app y el teclado KEYCON. No recibimos estos datos.',
          'En el navegador, el Locker web guarda en tu dispositivo tu sesión, el idioma elegido, una copia de la organización para abrir sin conexión y, si marcas archivos como "Disponible sin conexión", copias de esos archivos. Al cerrar sesión en el Locker web, borramos esas copias. No usamos cookies de publicidad ni herramientas de rastreo.',
        ],
      },
      {
        title: '4. El teclado y lo que escribes',
        paragraphs: [
          'Lo que escribes con el teclado KEYCON se procesa solo en tu dispositivo, para corregir palabras y sugerir las siguientes. No guardamos, no registramos y no enviamos el texto que escribes. En campos de contraseña, correo y enlace el teclado desactiva las sugerencias y la corrección automática.',
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
        title: '6. Para qué usamos los datos y bases legales',
        paragraphs: [
          'Usamos los datos para crear y mantener tu cuenta, prestar las funciones de KEYCON (incluido guardar y sincronizar el Locker entre la app, el teclado y el sitio, y lo que compartas), enviar tus archivos en las conversaciones, dar soporte, mantener la seguridad y cumplir obligaciones legales. Las bases legales son la ejecución del contrato contigo, el cumplimiento de obligaciones legales, nuestro interés legítimo en mantener el servicio seguro y, para el micrófono, tu consentimiento.',
        ],
      },
      {
        title: '7. Con quién compartimos',
        paragraphs: [
          'Con proveedores que nos ayudan a prestar el servicio: base de datos, autenticación y almacenamiento (Supabase), almacenamiento de los archivos del Locker (Cloudflare) y alojamiento del sitio. Solo pueden usar los datos para prestar esos servicios. También podemos compartir datos cuando lo exija la ley o una orden judicial. No vendemos tus datos.',
          'Con quien tú elijas en el Locker: las personas y equipos con quienes compartes y quienes reciben los enlaces que envías.',
          'Estos proveedores pueden tener servidores fuera de Brasil. En esos casos, aplicamos las garantías que exige la LGPD para la transferencia internacional.',
        ],
      },
      {
        title: '8. Cuánto tiempo guardamos los datos',
        paragraphs: [
          'Guardamos los datos de la cuenta, del perfil, el Locker y los archivos subidos mientras exista tu cuenta. Lo que mandas a la papelera del Locker se elimina para siempre después de 30 días (o antes, si vacías la papelera). Si pides la eliminación de la cuenta, borramos estos datos, incluidos los archivos del Locker, en un plazo de 30 días, salvo lo que la ley nos obligue a conservar (por ejemplo, registros de acceso, por 6 meses). Los datos que quedan solo en el dispositivo permanecen hasta que los borres, crees otra cuenta en el mismo dispositivo o desinstales la app.',
          'Los datos de la lista de espera se guardan hasta enviar el aviso de lanzamiento. Puedes pedir que los borremos antes escribiendo a {email}.',
        ],
      },
      {
        title: '9. Seguridad',
        paragraphs: [
          'Los datos viajan con conexión cifrada y cada cuenta solo accede a sus propios datos en la nube, además de lo que otras personas compartan con ella. Los archivos del Locker son privados y se abren con enlaces que vencen; solo quedan abiertos a quien tenga el enlace los archivos que compartes y las carpetas que dejas "con el enlace" o "públicas". Las fotos, videos y audios del catálogo y de los accesos rápidos pueden abrirlos quienes tengan el enlace. Ningún sistema es 100% seguro; si ocurre un incidente relevante, te avisaremos a ti y a las autoridades, como exige la ley.',
        ],
      },
      {
        title: '10. Tus derechos',
        paragraphs: [
          'Puedes pedir la confirmación de que tratamos tus datos, el acceso, la corrección, la anonimización, la portabilidad, la eliminación, información sobre el uso compartido y la revocación del consentimiento, además de oponerte a tratamientos. Tu nombre, negocio y WhatsApp pueden corregirse en la propia app, en Cuenta. Para los demás pedidos, escribe a {email}. También puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos de Brasil (ANPD) o ante la autoridad de tu país.',
        ],
      },
      {
        title: '11. Datos de tus clientes',
        paragraphs: [
          'Los datos de tus clientes que registras en el CRM quedan en tu dispositivo y son tu responsabilidad como responsable del tratamiento. Úsalos solo para atender a esos clientes y con su autorización.',
        ],
      },
      {
        title: '12. Menores de edad',
        paragraphs: ['KEYCON está destinado a mayores de 18 años y no recopila intencionalmente datos de niños o adolescentes.'],
      },
      {
        title: '13. Cambios en esta Política',
        paragraphs: ['Podemos actualizar esta Política. Si el cambio es relevante, te avisaremos en la app. La fecha de la última actualización aparece arriba.'],
      },
      {
        title: '14. Contacto y delegado de protección de datos',
        paragraphs: ['Para hablar sobre privacidad o contactar a nuestro delegado de protección de datos: {email}.'],
      },
    ],
  },
};
