# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The product itself is a React Native 0.74 app for Android and iOS (app + system keyboard), with one custom KEYCON design shared by both systems rather than each OS's native look. It also has a web test build (`web/`, `dist/`) and the static marketing site in `landing/`. The `web` value covers the landing page and the web build; app and keyboard screens follow the incumbent cross-platform design in `src/`.

## Users

Anyone who sells through their phone, with no single primary profile: solo sellers (resellers, brokers, consultants), small business owners and their attendants, and sales teams. They are in chats with customers all day (WhatsApp, Instagram, Messenger, e-mail) and need to answer fast and send products, photos, prices and standard replies without leaving the conversation.

Launch market: **United States first**. Portuguese (Brazil) and Spanish are supported languages, but English-speaking US businesses are the main audience at launch. Most businesses using it are expected to be in the USA, which is why there are no Brazilian professional registration fields (CRECI, SUSEP, OAB).

## Product Purpose

KEYCON is a system keyboard for selling. Users register products with photos, ready-made messages (text, audio, links), customers and appointments in the app, then use all of it from the keyboard inside any app. Success means the seller replies and sends what the customer asked for in one or two taps, in the chat itself, and keeps customers organized by sales stage.

## Positioning

The sales toolkit lives inside the keyboard, so it works in every chat app the seller already uses, with no integration, business API or app switching. It is also a full everyday keyboard (spell check, word suggestions) that can replace the phone's stock keyboard.

## Operating Context

- Used on the phone, mid-conversation, often one-handed and in a hurry.
- Setup happens in the KEYCON app: account, business segment, products, files, shortcuts, customers. Daily use happens in the keyboard.
- The user picks a business segment (Geral, Imobiliária, Seguros, Restaurante, Advocacia, Loja e varejo, Beleza e estética, Veículos), which shapes product fields, CRM stages and AI tone.
- iPhone keyboard rules: photos, videos and audio are copied for the user to paste; the keyboard needs Full Access for internet and shared data.

## Capabilities and Constraints

- Keyboard menu: Arquivos (files), Produtos, Atalhos (shortcuts), Agenda, CRM, Mais (AI replies, settings), translation, switch to system keyboard.
- AI reply suggestions for a copied customer message (server-side; the OpenAI key stays in the backend).
- On-device translation (Google ML Kit): pt, en, es, fr, it, de.
- Spell check and suggestions in pt, en, es; the dictionary is general, never per segment.
- App languages: pt, en, es.
- Privacy facts: typing is processed on the device; catalog, shortcuts, customers, agenda and files list stay on the device; account/profile in the cloud (Supabase); uploaded media are public links; only the message the user copies for AI goes to the server.
- New accounts start empty: no demo or sample data in the product.
- Store identities: `com.keycon.app`, `com.keycon.app.keyboard`, `group.com.keycon.app`. Not yet published on Google Play or the App Store.
- Pricing: **monthly subscription** (confirmed model). Price, trial and plan details are not decided; do not state amounts, a free trial or a free plan.
- Company legal data (name, registration number, contact e-mail, city) is still pending in `src/legal/legal.ts` (`LEGAL_INFO`).

## Brand Commitments

- Name: **KEYCON**. The brand manual says "KEYLO"; that name was taken, so ignore it.
- Slogans: "Smart keyboard. Organized sales." (on the official logo art) and "Seu negócio na ponta dos dedos." (README).
- Official art in `assets/` (app icon, K symbol, logos with and without slogan, light and dark text). Never redraw the K by hand.
- Graphite #242833 is the structural color; coral #F17860 is only for actions, brand and active states. Font: Inter. The Configurações icon is a gear.
- KEYCON is not affiliated with WhatsApp or Meta.

## Evidence on Hand

- Real product screens: keyboard captures per language in `landing/img/<en|es|pt>/*.webp` (made from the web test build with illustrative store data in each market's language and currency; the translation capture shows the expected ML Kit result because the web build only simulates translation).
- Privacy Policy and Terms of Use in pt/en/es (`src/legal/legal.ts`, published as `landing/privacidade.html` and `landing/termos.html`).
- None yet: customers, testimonials, ratings, usage numbers, press, store listings or prices. Do not fabricate any of them.

## Product Principles

1. The chat is the workplace: every feature should be reachable from the keyboard without leaving the conversation.
2. One or two taps to send; speed beats configurability in the keyboard.
3. Works for any product or service; segments adapt the wording, never the core.
4. Honest about platform limits (especially iPhone) and about what data leaves the phone.
5. Empty by default: guide new users with setup and tutorials, not sample content.
