# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Given by the brief: Next.js (App Router, TypeScript), PostgreSQL, Prisma, Tailwind CSS, shadcn/ui-style components, Lucide icons, Better Auth (passwords, passkeys, TOTP, recovery codes), Zod, Docker Compose. Installable PWA. Self-hosted on Ubuntu behind an existing reverse proxy (Portainer).

## Users

- **Two curators** (friends, equal rights). Mostly on their phones, in spare moments: they hear a great word, add it in seconds, and later swipe through pending words. Sometimes they sit together and go through the "Später" list in a discussion session.
- **One administrator** (may also be a curator). Sets up the instance, invites, security policy, categories, exports.
- **Members** (the rest of the roughly three friends): read-only accounts by invitation, no vote. Nobody can see anything without logging in.

## Product Purpose

A shared, slowly growing collection of exceptional German words and expressions: funny, beautiful, absurd or just very good. Only words both curators accept enter the official collection. Each accepted word becomes a proper dictionary entry. Success: collecting is effortless, voting is fun, and the collection reads like a dictionary the two of them are proud of.

## Identity (confirmed 2026-10-13)

A personal wiki and word archive with modern interactions and its own visual personality: Wikipedia-like structure and fast lookup, Duden-like entries (definition, IPA, part of speech, examples), a small continuously growing knowledge collection. The dating-app feel belongs only to the mobile voting mode. It is a small private fun project, not a public product: it never needs to sell or explain itself. It should feel like an existing shared archive you open regularly — "a pretty cool self-built word archive". Less landing page, more wiki and dictionary.

## Positioning

A dictionary with exactly two editors who must agree. The joint "yes" is the product: the swipe vote is the gate, the dictionary entry is the reward.

## Operating Context

- Capture happens in the moment, on a phone, often one-handed.
- Voting happens in batches, swipe-style.
- Discussions of undecided words happen in person or asynchronously via comments.
- The site is internal only (decided 2026-10-13): every page requires login, there are no guest suggestions and nothing is indexed.
- Year-end recap ("Peake Wrapped") as a small story.

## Capabilities and Constraints

- UI language: German only.
- Voting: yes / no / later per curator per round; both yes = accepted, both no = negative list, any disagreement or "later" = Später list. Rounds are stored separately, never overwritten.
- Entries may be incomplete. No invented definitions, IPA or statistics. IPA must be marked as unverified when not confirmed by curators.
- AI is optional and only produces drafts; it never votes or publishes.
- Audio pronunciation only when a real recording exists.
- No public account registration. No default credentials.

## Brand Commitments

- Name: **Peake Wörter**. Meaning left open by the owners; working reading (assumption): "peak" as slang for the very best, so the collection is the peak of words.
- Wordmark, palette and fonts are established (see DESIGN.md).
- Voice: relaxed, natural, personal ("unser kleines Archiv"). Humour allowed, never forced; no marketing claims, no youth slang, no emotional brand talk. Buttons name their function briefly.
- Visual identity is established and must be preserved: dark palette, cobalt accent, light card-stock word cards with coloured head band, condensed Archivo display type, wordmark, navigation and icons. Cards are reserved for word of the day, random words, voting and highlights; regular lists and long entries use dictionary typesetting instead.

## Evidence on Hand

No existing word data, logo or imagery. Do not fabricate sample words, statistics or rankings in the product. Example in the brief: "Mumpitz [ˈmʊmpɪt͡s]".

## Product Principles

1. Collecting and joint voting come first; the dictionary presentation comes second; everything else after.
2. Two equal voices. No feature may give one curator more weight, including the admin.
3. Show only what is real: no placeholder fields, no guessed data presented as fact.
4. Seconds, not minutes: the core actions work one-handed on a small phone.
5. Private stays private: votes, comments and the negative list never reach visitors.

## Accessibility & Inclusion

All swipe actions have button and keyboard equivalents. Reduced motion respected. Screen reader labels for votes and IPA. WCAG 2.2 AA contrast in both themes.
