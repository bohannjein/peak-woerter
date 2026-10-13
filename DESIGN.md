---
name: Peake Wörter
description: A private two-editor wiki and word archive of exceptional German words, with a Quartett card deck for voting.
colors:
  table: "#e4e7ee"
  table-2: "#d8dce6"
  table-3: "#cbd0dc"
  line: "#b9bfcd"
  ink: "#12141c"
  ink-2: "#474d61"
  ink-3: "#636a80"
  focus: "#2347d8"
  table-dark: "#10121a"
  table-2-dark: "#171a25"
  table-3-dark: "#20242f"
  line-dark: "#2d3242"
  ink-dark: "#eceef5"
  ink-2-dark: "#a9afc2"
  ink-3-dark: "#8a90a5"
  focus-dark: "#8ea6ff"
  card: "#fdfdf8"
  card-2: "#f0efe6"
  card-dark: "#f4f3ec"
  card-2-dark: "#e7e5da"
  card-ink: "#13151d"
  card-ink-2: "#4f5466"
  card-line: "#d6d5cb"
  yes: "#12804a"
  no: "#d0254f"
  later: "#f5b900"
  later-ink: "#2b2100"
  band-cobalt: "#2347d8"
  band-sun: "#ffcf1f"
  band-sun-ink: "#231b00"
  band-grass: "#17824b"
  band-magenta: "#c72663"
  band-orange: "#f2711c"
  band-orange-ink: "#1f0e00"
  band-teal: "#0b7476"
  band-violet: "#6b46c1"
  band-ink: "#2a2e3c"
  band-ink-text: "#f4f3ec"
  band-on-dark: "#ffffff"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 10vw, 4.75rem)"
    fontWeight: 860
    lineHeight: 0.92
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 68"
  card-term:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, calc(168cqi / letters), 4.25rem)"
    fontWeight: 860
    lineHeight: 0.92
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 68"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 860
    lineHeight: 0.92
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 68"
  page-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 2.75rem)"
    fontWeight: 820
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 72"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    letterSpacing: "-0.005em"
  lemma:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 860
    lineHeight: 0.92
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 68"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'kern', 'liga'"
  definition:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.375
  lexical:
    fontFamily: "Charis SIL, Gentium Plus, Noto Serif, serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.375
    letterSpacing: "0.01em"
  band-label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 78"
  value-label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.07em"
    fontVariation: "'wdth' 78"
  card-number:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "'tnum', 'lnum'"
    fontVariation: "'wdth' 78"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 640
    lineHeight: 1.3
rounded:
  stamp: "8px"
  notice: "12px"
  field: "14px"
  panel: "16px"
  card: "20px"
  pill: "999px"
spacing:
  card-inset: "20px"
  card-inset-wide: "24px"
  mini-inset: "14px"
  band-height: "44px"
  mini-band-height: "28px"
  control-min: "48px"
  control-sm: "44px"
  chip-height: "36px"
  chip-height-coarse: "44px"
  entry-row-min: "56px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.table}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
    typography: "{typography.label}"
  button-quiet:
    backgroundColor: "{colors.table-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
  button-quiet-hover:
    backgroundColor: "{colors.table-3}"
  button-danger:
    backgroundColor: "{colors.no}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
  button-sm:
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "{spacing.control-sm}"
  chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "{spacing.chip-height}"
  chip-coarse:
    height: "{spacing.chip-height-coarse}"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.table}"
    rounded: "{rounded.pill}"
  field:
    backgroundColor: "{colors.table-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.8rem 1rem"
  field-focus:
    backgroundColor: "{colors.table}"
  word-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-inset}"
  word-card-compact:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
  entry-row:
    textColor: "{colors.ink}"
    typography: "{typography.lemma}"
    padding: "12px 0"
    height: "{spacing.entry-row-min}"
  letter-heading:
    textColor: "{colors.ink-3}"
    typography: "{typography.display}"
    width: "2.5rem"
  word-card-band:
    backgroundColor: "{colors.band-cobalt}"
    textColor: "{colors.band-on-dark}"
    typography: "{typography.band-label}"
    height: "{spacing.band-height}"
    padding: "0 20px"
  vote-button:
    backgroundColor: "{colors.table-2}"
    rounded: "{rounded.pill}"
    size: "68px"
  vote-button-later:
    backgroundColor: "{colors.table-2}"
    rounded: "{rounded.pill}"
    size: "52px"
  vote-button-yes-armed:
    backgroundColor: "{colors.yes}"
    textColor: "#ffffff"
  vote-button-no-armed:
    backgroundColor: "{colors.no}"
    textColor: "#ffffff"
  vote-button-later-armed:
    backgroundColor: "{colors.later}"
    textColor: "{colors.later-ink}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.table}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
  toast-error:
    backgroundColor: "{colors.no}"
    textColor: "#ffffff"
  tab-bar:
    backgroundColor: "{colors.table}"
    textColor: "{colors.ink-3}"
    height: "64px"
---

# Design System: Peake Wörter

## Overview

**Creative North Star: "The Quartett Table"**

Peake Wörter is a private word archive that reads like a small wiki and a dictionary, with a German Quartett deck lying on the table beside it. Lists and entries are set as dictionary type; a word becomes a collectible card only where it is shown off or played: word of the day, random words and highlights, the voting deck, and the card beside the entry. Voting is playing a card; the entry page is the card opened up as a dictionary page. The site is internal, every surface sits behind login, and it never explains or sells itself. The table changes with the theme (cool grey by day, ink blue-black at night); the cards never do. They are always off-white card stock with a coloured category band, a heavy condensed term, a card number like "№ 042" and a ruled value table at the foot.

The system is dense where cards are and quiet everywhere else. Colour carries meaning only: category bands (one colour, one category) and the three verdicts (Ja, Nein, Später). Chrome is ink on table, in pills and hairlines. Two voices share the type: condensed Archivo for anything a card would print, Charis SIL for the lexicographic layer (IPA, examples, part of speech). Motion is physical and short: cards tilt with the thumb, a rubber stamp inks in with drag distance, the decided card flies off.

The world explicitly refuses the category default of a Tinder-pink swipe stack over a cream-serif dictionary.

**Key Characteristics:**
- Cards are always light card stock, in both themes; only the table goes dark.
- One colour per category band; verdict hues only where a verdict or status is being expressed.
- Condensed heavy Archivo (width 68%, weight 860) for terms; Charis SIL for IPA and examples.
- Card number "№ 000" as identity, set in condensed black tabular numerals.
- Cards are earned: word of the day, random and highlights, voting. Lists and long entries are dictionary lines (lemma, IPA, italic part of speech, definition).
- Sentence-case page and section titles; uppercase display is the card and game voice only.
- Hairline-ruled value tables and entry lists; dictionary typesetting with a 2px ink rule on the entry page.
- Shadows belong to physical objects (card stock, floating toast), never to table chrome.

## Colors

A cool neutral table, a warm off-white card, and a small set of fully saturated signal colours that each mean exactly one thing.

### Primary
- **Table Ink** (`ink`, dark: `ink-dark`): primary actions, active nav pill, active chip, toast background, the 2px dictionary rule. Inverts with the theme, so the primary button is near-black on grey by day and near-white on ink by night.
- **Focus Cobalt** (`focus`, dark: `focus-dark`): focus outlines and the text caret only.

### Secondary
- **Category Bands** (`band-cobalt`, `band-sun`, `band-grass`, `band-magenta`, `band-orange`, `band-teal`, `band-violet`, `band-ink`): the head band of every card and the dot in a category chip. Each band carries its own ink: white on cobalt, grass, magenta, teal, violet; `band-sun-ink` on sun; `band-orange-ink` on orange; `band-ink-text` on the neutral ink band (used for uncategorised and "Neu" cards).

### Tertiary
- **Ja Green** (`yes`): Ja vote control, JA stamp, success notices, the checked Toggle.
- **Nein Magenta-Red** (`no`): Nein vote control, NEIN stamp, error notices and toasts, invalid field border, danger button.
- **Später Yellow** (`later`, text `later-ink`): Später vote control and stamp ink; caution notices at 10 to 15% tint.

### Neutral
- **Table** (`table` / `table-dark`): page ground and sticky header/tab bar (at 90 to 95% with blur).
- **Table Raised** (`table-2`, `table-3`): field fill, quiet button, vote button fill, comment bubbles; `table-3` is the hover step and the Toggle track.
- **Hairline** (`line`): borders on fields, chips, quiet buttons, panels, section rules.
- **Ink 2 / Ink 3**: secondary text and hints / meta, placeholders, inactive tabs.
- **Card Stock** (`card`, `card-2`; slightly warmer `card-dark`, `card-2-dark` under the dark table): the card face and in-card note panel.
- **Card Ink** (`card-ink`, `card-ink-2`, `card-line`): text and rules printed on cards. These do not change with the theme.

### Named Rules
**The One Colour One Meaning Rule.** A band colour names a category and nothing else; a verdict colour means yes, no or later (and their status equivalents: confirmed, error, caution) and nothing else. No colour is used to decorate.

**The Card Stock Rule.** Card faces never follow the theme. In dark mode the table goes ink blue-black and the cards stay off-white with their own ink.

## Typography

**Display Font:** Archivo variable (weight 100 to 900, width 62 to 125%), self-hosted, with ui-sans-serif fallback
**Body Font:** Archivo at normal width
**Lexical Font:** Charis SIL regular and italic, subset with full IPA, with Gentium Plus and Noto Serif fallbacks

**Character:** A single grotesque stretched across its width axis does all the printing: crushed and heavy for terms, slightly condensed and tracked for card furniture, normal width for reading. Charis SIL is the dictionary's own voice, reserved for phonetics and examples.

### Hierarchy
- **Display** (860, width 68%, `clamp(2.75rem, 10vw, 4.75rem)`, line-height 0.92): the term on the entry page. Hyphenated (`lang="de"`, `hyphens: auto`) for long compounds.
- **Card Term** (860, width 68%, up to 4.25rem on the full card, 2.2rem on mini cards): size shrinks with letter count against container width (`168cqi / letters`, floor 1.6rem) so compounds fit the card.
- **Headline** (860, width 68%, 3rem, uppercase): game-voice lines only: the voting deck's status ("Stapel leer.") and Wrapped story titles (2.75rem, with a `clamp(4rem, 22vw, 8rem)` big figure).
- **Page Title** (820, width 72%, `clamp(2rem, 6vw, 2.75rem)`, line-height 1, sentence case): the one h1 of every table page ("Peake Wörter", "Sammlung").
- **Section Title** (700, 1.15rem, -0.005em, sentence case): section heads on table pages ("Wort des Tages", "Neu") and empty-state lines.
- **Lemma** (860, width 68%, 1.45rem): the headword of a dictionary line; underlines 2px on hover. Letter headings in the A-Z list use the display style at 1.25rem in ink-3.
- **Body** (400, 1rem, kern and liga on): UI and prose. Definitions on cards at 1.06rem snug; on the entry page at 1.3rem, measure capped at 40rem.
- **Lexical** (Charis 400): IPA in square brackets drawn by CSS at 55% opacity, never synthesised bold or italic; examples in italic inside German quotes „…“.
- **Band Label** (800, width 78%, 0.82rem, 0.08em tracking, uppercase): category name in the card head band.
- **Value Label** (700, width 78%, 0.72rem, 0.07em tracking, uppercase): keys of the card value table (Buchstaben, Bedeutungen, Runden, Aufgenommen).
- **Card Number** (900, width 78%, tabular lining numerals): "№ 001" in the band, the value table values, and the entry colophon.
- **Label** (640, 0.9rem): form labels; hints at 0.85rem in ink-2.

### Named Rules
**The Three Widths Rule.** Terms and game display are 68% wide, page titles 72%, card furniture 78%; reading text is never condensed.

**The Sentence Case Rule.** Page and section titles are sentence case. Uppercase display is reserved for the voting deck, card bands and value labels, verdict stamps and Wrapped.

**The Lexicographer's Voice Rule.** Charis SIL is for IPA, examples and part of speech (entry page and dictionary lines) only. It never sets UI.

**The Honest IPA Rule.** Unconfirmed IPA carries a small superscript "?" in Archivo; IPA is never shown without that mark unless verified.

## Layout

The app shell is a 64px sticky header (wordmark, centred pill nav from 768px, theme and account at the right) over a centred column of at most 72rem (`max-w-6xl`) with 16px gutters on phones and 24px from 768px. Below 768px the header nav disappears and a fixed 64px bottom tab bar takes over; its primary action (Hinzufügen) is a 44px ink disc with the label hidden for screen readers only. Main content reserves 112px bottom padding on phones for the tab bar and safe area.

Home is a search field, a count line and, from 768px, two columns: a 21rem column holding the compact word-of-the-day card and a list column of dictionary lines and category chips; on phones they stack. The collection (Sammlung) defaults to a dictionary list grouped by initial letter: from 768px the letter sits in a 2.5rem gutter column and sticks at 80px; on phones it is a hairline-ruled heading above its group. Each line is at least 56px tall; from 768px lemma and IPA take a `minmax(11rem, 16rem)` column with the definition beside it, on phones the definition wraps below.

Abstimmen is a single 28rem column sized to the dynamic viewport: a meta line, the deck filling the remaining height, then the three vote buttons. The entry page is two columns from 768px (text column plus a 20rem sticky card aside, tilted 1.5deg); on phones they stack. The optional card view of the collection (Karten) is 2 columns, 3 from 640px, 4 from 1024px, with 16px gaps. Rhythm follows Tailwind's 4px scale; cards use a 20px inset (24px from 640px), sections are separated by 40px and a hairline or 2px ink rule.

## Elevation & Depth

Two layers: the flat table and the physical objects lying on it. The table and its chrome are flat; header and tab bar use translucency and a small backdrop blur rather than shadow. Card stock carries a two-part shadow (a contact line plus a long soft drop) that deepens under the dark table. Stacked cards show depth by offset, scale (4% per step) and alternating tilt (1.6deg, -2.2deg), not by stronger shadows.

### Shadow Vocabulary
- **Card on table** (`--card-shadow`, light: `0 1px 1px rgb(18 20 28 / 0.08), 0 10px 30px -8px rgb(18 20 28 / 0.28)`; dark: `0 1px 1px rgb(0 0 0 / 0.4), 0 16px 40px -10px rgb(0 0 0 / 0.75)`): every card-stock surface.
- **Floating toast** (Tailwind `shadow-lg`): the undo/status toast above the tab bar.

### Named Rules
**The Objects Cast Shadows Rule.** Only things that are physically on the table (cards, the toast) cast shadows. Panels, fields, chips and buttons are flat and bordered.

## Shapes

Cards are 20px-radius rectangles clipped so the band follows the corner. Everything the user presses is a pill (999px): buttons, chips, nav items, vote buttons (circles). Containers on the table step down the radius as they get smaller: 16px panels and toggles, 14px fields, 12px notices and the in-card note, 8px rubber stamps. Borders are 1.5px hairlines in `line`; vote buttons use a 3px ring in their verdict colour; stamps a 4px ring. Empty states use a 2px dashed `line` border at the card radius, the outline of a missing card.

## Components

### Buttons
Confident ink pills, pressed rather than hovered.
- **Shape:** pill (999px), 48px minimum height, 20px side padding; small variant 44px with 0.9rem text.
- **Primary:** ink fill with table text; hover mixes 14% table into the ink.
- **Quiet:** table-2 fill, 1.5px hairline border; hover steps to table-3.
- **Danger:** Nein red with white text, destructive confirmations only.
- **States:** press scales to 0.97 over 120ms (expo-out); disabled at 45% opacity. Focus is the global 2.5px cobalt outline offset 3px.

### Chips
- **Style:** 36px pill (44px under a coarse pointer), 1.5px hairline border, 600 weight 0.9rem, optional 16px icon or a 10px category dot in the band colour.
- **State:** hover darkens the border to ink-3; pressed or current fills ink with table text.

### Cards / Containers
- **Word Card:** card stock, 20px radius, card shadow. 44px head band in the category colour with the condensed uppercase category name left and "№ 000" right. Body: term, part of speech plus IPA, definition, italic example, then a two-column value table of hairline-ruled rows pushed to the foot. A card with no entry shows ruled index-card lines and "Eintrag folgt." in Charis italic rather than empty fields.
- **Compact Word Card:** the full card with tighter rhythm (16px top inset, term capped at 3rem, 12px above the value table). Word of the day on home (without value table) and the entry page's aside (without definition and example).
- **Mini Card:** same anatomy at 28px band and 14px inset, term and up to three lines of definition; lifts 4px on hover or focus.
- **Panels on the table:** no fill or table-2 fill, 1.5px hairline, 16px radius, 16 to 20px padding.
- **Notices:** 12px radius, 1.5px border at 60% of the status colour over a 10% tint.

### Dictionary Line (signature)
The default way to list words. No card, no fill: a hairline-ruled list (`line` at 70%, no rule after the last row).
- **Anatomy:** lemma in the Lemma style, verified IPA in Charis at 0.95rem ink-2, then the part of speech in Charis italic ink-3 with an em dash, then the short definition in ink-2. A missing definition reads "noch ohne Definition" in ink-3.
- **States:** the whole row is the link; hover underlines the lemma (2px, 4px offset).

### Inputs / Fields
- **Style:** table-2 fill, 1.5px hairline, 14px radius, 0.8rem by 1rem padding, 1rem text; placeholder ink-3.
- **Focus:** border turns focus cobalt and the fill drops to the table colour; caret is cobalt.
- **Error:** border in Nein red with `aria-invalid`.
- **Toggle:** a full-width 16px-radius bordered row with a 48 by 28px track (table-3, Ja green when on) and a white knob.

### Navigation
- **Header (from 768px):** 40px pills, 600 weight 0.95rem with an 18px Lucide icon; inactive ink-2, hover ink on table-2, active ink fill with table text. Count badges are 20px ink discs with tabular numerals and a table-coloured ring.
- **Tab bar (phones):** fixed, 64px rows, icon over a 0.7rem label; inactive ink-3, active ink with a heavier stroke; the primary action is a raised 44px ink disc.

### Swipe Deck (signature)
- **Stack:** top three cards; back cards anchored at their bottom edge, offset 12px and scaled 4% per step, tilted 1.6deg and -2.2deg; they move forward as the top card is dragged.
- **Drag:** the top card follows the pointer and rotates 0.05deg per px. Commit at 110px horizontal or 120px down (or a fast flick); otherwise it settles back over 420ms expo-out.
- **Stamps:** JA (left, -12deg, green), NEIN (right, 12deg, red), SPÄTER (centre, -3deg, later-ink) in display type at 3.4rem with a 4px ring, multiplied onto the card and masked with diagonal wear; opacity follows drag distance.
- **Vote buttons:** Nein 68px, Später 52px, Ja 68px circles on table-2 with a 3px verdict ring and a 3px-stroke icon; they fill with their colour and grow up to 12% as the drag arms them.
- **Ghost:** the decided card leaves the queue at once; a copy with its stamp flies off in 340ms (`cubic-bezier(0.4, 0, 0.6, 1)`), or fades in 150ms with reduced motion.
- **Toast:** ink pill-cornered bar (16px radius) above the tab bar, rising 8px over 260ms, with a Rückgängig action; errors switch to Nein red.

## Do's and Don'ts

### Do:
- **Do** reserve card stock for word of the day, random words and highlights, the voting deck and the entry aside; a card always has its category band and, once accepted, its "№ 000" number.
- **Do** list words and set long entries as dictionary lines: lemma, IPA, italic part of speech, definition.
- **Do** set page titles in the Page Title style and section heads in the Section Title style, both sentence case.
- **Do** keep on-screen copy minimal and functional: titles name the page, buttons name their function; no explanatory or marketing text.
- **Do** keep cards light in dark mode; only table tokens switch themes.
- **Do** set terms in the condensed display style (width 68%, weight 860, line-height 0.92) and let them shrink with length rather than truncate.
- **Do** set IPA and examples in Charis SIL; mark unverified IPA with the superscript "?".
- **Do** give every swipe a button and a keyboard equivalent (← Nein, ↓ Später, → Ja, Z undo) and respect reduced motion.
- **Do** use pills for anything pressable and 1.5px hairlines for anything that only contains; pressable controls are at least 44px tall on touch.

### Don't:
- **Don't** use a category band colour for anything but its category, or a verdict colour for anything but a verdict or its status meaning.
- **Don't** draw decorative gradients; gradients in this system only draw ruled lines and stamp wear.
- **Don't** add shadows to panels, fields, chips or buttons; only cards and the toast sit above the table.
- **Don't** condense reading text or set UI in Charis SIL.
- **Don't** set page or section titles in uppercase display, or show ordinary lists as card grids by default.
- **Don't** build guest or visitor surfaces; every screen assumes a signed-in member.
- **Don't** show placeholder data on a card; an incomplete entry shows ruled lines and "Eintrag folgt."
