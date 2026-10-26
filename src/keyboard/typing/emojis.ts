/**
 * Emojis do painel do teclado, por categoria. São desenhados pela fonte de
 * emojis do próprio celular (iguais aos do aparelho). Ficam de fora os mais
 * novos (Unicode 13+), que aparecem como quadrado em celulares antigos.
 */

export interface EmojiCategory {
  id: string;
  /** Emoji da aba. */
  icon: string;
  /** Nome em português (traduzido na tela). */
  label: string;
  emojis: string[];
}

const list = (s: string) => s.split(' ').filter(Boolean);

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'faces',
    icon: '😀',
    label: 'Carinhas',
    emojis: list(
      '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖',
    ),
  },
  {
    id: 'people',
    icon: '👋',
    label: 'Gestos e pessoas',
    emojis: list(
      '👋 🤚 🖐️ ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 👀 👅 👄 💋 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤷 🤦 💁 🙇 🧑‍💻 👨‍💼 👩‍💼 👪 💑 💏',
    ),
  },
  {
    id: 'hearts',
    icon: '❤️',
    label: 'Corações e símbolos',
    emojis: list(
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ❗ ❓ ⭐ 🌟 ✨ ⚡ 🔥 💯 💢 💥 💫 💦 💨 ⏰ ⌛ ⚠️ 🚫 ⛔ 📌 📍 🔔 🎉 🎊 🎁 🏆 🥇 🥈 🥉 🆕 🆗 🆓 🔝 ▶️ ⏸️ 🔁',
    ),
  },
  {
    id: 'nature',
    icon: '🐶',
    label: 'Animais e natureza',
    emojis: list(
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐬 🐳 🌵 🎄 🌲 🌳 🌴 🌱 🌿 🍀 🍁 🌷 🌹 🌻 🌼 🌸 💐 🌞 🌝 🌙 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ 🌊',
    ),
  },
  {
    id: 'food',
    icon: '🍔',
    label: 'Comida e bebida',
    emojis: list(
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🥔 🍞 🥐 🥖 🧀 🥚 🍳 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍤 🍦 🍰 🎂 🧁 🍫 🍬 🍭 🍩 🍪 ☕ 🍵 🥤 🍺 🍻 🍷 🥂 🍾',
    ),
  },
  {
    id: 'activities',
    icon: '⚽',
    label: 'Atividades e viagens',
    emojis: list(
      '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🏋️ 🚴 🏊 ⛳ 🎮 🎲 🎯 🎸 🎤 🎧 🎬 🎨 🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🛵 🏍️ 🚲 ✈️ 🚀 ⛵ 🚢 🏠 🏡 🏢 🏬 🏦 🏨 🏪 🏫 ⛪ 🏖️ 🏝️ ⛰️ 🗽 🗼 🌎',
    ),
  },
  {
    id: 'objects',
    icon: '💡',
    label: 'Objetos',
    emojis: list(
      '📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 📹 🎥 📞 ☎️ 📺 📻 ⏱️ 💡 🔦 🕯️ 💸 💵 💰 💳 💎 ⚖️ 🔧 🔨 🛠️ 🔑 🗝️ 🚪 🛏️ 🛋️ 🚿 🛁 🧴 🧹 🧺 🛒 ✉️ 📧 📦 📝 📄 📅 📆 📊 📈 📉 📋 📎 ✂️ 🔒 🔓 🖊️ ✏️ 📚 📖',
    ),
  },
  {
    id: 'flags',
    icon: '🏁',
    label: 'Bandeiras',
    emojis: list('🏁 🚩 🏳️ 🇧🇷 🇵🇹 🇺🇸 🇨🇦 🇲🇽 🇦🇷 🇨🇴 🇨🇱 🇪🇸 🇬🇧 🇫🇷 🇮🇹 🇩🇪 🇯🇵 🇺🇾 🇵🇾 🇵🇪 🇧🇴 🇻🇪 🇪🇺'),
  },
];
