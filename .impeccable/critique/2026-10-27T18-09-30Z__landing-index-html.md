---
target: landing
total_score: 21
max_score: 36
na_heuristics: 7
p0_count: 2
p1_count: 2
target_identity: "file:F:\\PROJETOS OUTBOX\\RAFAEL MARTINEZ\\KEYCON\\keycon-app-IDE\\landing\\index.html"
target_fingerprint: "sha256:a49a8a302ccd2a62c63f4398f680670d5073a906784c51aff6697863eb3e2940"
target_path: "F:\\PROJETOS OUTBOX\\RAFAEL MARTINEZ\\KEYCON\\keycon-app-IDE\\landing\\index.html"
timestamp: 2026-10-27T18-09-30Z
slug: landing-index-html
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score: 21/36 (Acceptable, 58%) — heuristic 7 n/a (one-pass marketing page)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | Header CTA scrolls to inert store badges; "Coming soon" in 11px |
| 2 | Match real world | 1 | EN page shows Portuguese product UI (R$, Pix, PT menus/chat); HTML defaults pt-BR |
| 3 | User control | 3 | Nothing traps; language persists |
| 4 | Consistency | 2 | Hand-made store badges; mobile panel above tabs |
| 5 | Error prevention | 2 | Dead-end clicks; final CTA hidden without contactEmail |
| 6 | Recognition | 3 | Tabs carry descriptions |
| 7 | Flexibility | n/a | One-pass landing |
| 8 | Aesthetic/minimal | 3 | Clean, but strip/cards/FAQ repeat benefits |
| 9 | Error recovery | 2 | No notify-me path once user learns it's unavailable |
| 10 | Help | 3 | FAQ good; lacks pricing/data deletion |

## Design specificity
Category-interchangeable dark-SaaS template; core mechanic (toolkit inside the keyboard, inside the chat) only visible inside screenshots. Real asset: genuine product captures.
Detector: low-contrast x8 (white on #F17860 2.8:1; hover #E2654D 3.4:1) real; icon-tile-stack x6, hero-eyebrow/kicker x6, dark-glow, radial-spotlight-glow (aurora, intentional) real; straggler x3 real/low; overused-font Inter = false positive (brand); dark-glow on legal pages = false positive.

## Priority issues
- [P0] Product shown in Portuguese for US launch market; HTML lang/title/OG pt-BR. Fix: English as source language, recapture screens in EN/USD, per-language images.
- [P0] No conversion path: inert store badges, hidden final CTA. Fix: waitlist/notify-me email capture in hero and final CTA; official badges only with real URLs.
- [P1] Trust for a keyboard that sees typing is buried (card 6, FAQ 4), no Full Access explanation, no company identity. Fix: dedicated privacy section with on-device vs server data flow, Full Access by name, policy link.
- [P1] Generic layout doesn't dramatize the mechanic. Fix: hero shows customer asks → tap Products → card lands in chat; cut 6-card grid to 3; drop repeated eyebrows and icon tiles.
- [P2] Mobile: tab panel above tabs (tap changes off-screen image); header CTA hidden <640px. Fix: horizontal tabs above phone or inline accordion; compact persistent CTA.

## Persona red flags
Jordan: "system keyboard" unexplained; CTA leads nowhere; PT UI confuses; no price signal. Riley: badges/chips look clickable but do nothing; no-JS shows PT + dead contact; privacy claim vs AI/public media unreconciled. Casey: ~7300px scroll, no CTA on mobile header, off-screen tab swap, "coming soon" first viewport. Dana (US SMB owner): no company identity, Full Access unexplained, no price, R$/Pix read as offshore.

## Minor
Generic H1 idiom; eyebrow on every section; 11px coming-soon label; FAQ gaps (pricing, deletion, uninstall); translation demo PT→EN rather than EN→ES; relative OG image URL; stragglers.

## Questions
1. Why explain "never leave the chat" with a feature grid instead of showing a sale inside a chat?
2. What is the page for before launch: emails, beta testers, or credibility?
3. Should privacy lead for US buyers?
