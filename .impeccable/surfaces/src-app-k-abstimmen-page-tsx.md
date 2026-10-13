---
version: 1
slug: "src-app-k-abstimmen-page-tsx"
primary_target: "src/app/k/abstimmen/page.tsx"
related_targets: ["src/app/page.tsx","src/app/wort","src/app/woerter"]
---

# Surface brief: Peake Wörter app (voting, collection, entry)

Scope: whole app shell. Primary surfaces: Abstimmen (Operate), Sammlung and Wortseite (Read), Start with Wort des Tages (Read, light Persuade). Admin is Operate, quieter, same system.

Audience/job: two curators capture and swipe-vote words on phones; friends read and share entries.

## Direction contract

THESIS: Every word is a collectible card in a German Quartett deck. Voting is playing a card; the collection is the deck; the entry page is the card opened up as a dictionary page. Refuses the category default: a Tinder-pink stack over a cream-serif dictionary.

OWN-WORLD: Dark "Spieltisch" ground (ink blue-black), light theme a cool table grey. Cards: off-white card stock, 20px radius, coloured head band coded by category (cobalt, sun yellow, grass green, magenta, orange, teal; one colour = one category, nothing else coloured). Heavy condensed Archivo for terms and the card number "№ 042"; a ruled two-column value table (Buchstaben, Bedeutungen, Runden, Aufgenommen) with tabular numerals. IPA and example sentences in Charis SIL. Vote colours (Ja green, Nein magenta-red, Später yellow) appear only on vote controls and verdict stamps.

STORY: One word, big, as a card. Understood at a glance (IPA, short definition, example). Curators decide with a thumb; the deck grows with numbered cards; visitors browse the deck and open single cards.

FIRST VIEWPORT: Abstimmen on a 390px phone: one card fills about 70% of the height; head band with category or "Neu"; term in condensed 900 weight up to 64px; IPA under it; short definition; example in italic; value table at the card foot. Behind it the edges of the next two cards (deck depth). Below: three round buttons, Nein left, Später centre (smaller), Ja right, 64px. Bottom navigation.

FORM: Wort-Quartett, #3 on the own ordered list (Stempel, Karteikasten, Quartett, Abreisskalender, Fallblatt, Aicher, Duden). Seed 141e02ee. Raises: one colour one meaning (wayfinding); card number as identity (Factory catalogue); dictionary typesetting on the entry page (centre-rail). Signature interaction: card swipe with tilt and a stamped verdict label (JA / NEIN / SPÄTER) that inks in with drag distance.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
