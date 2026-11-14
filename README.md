# Roju · రోజు

A tiny daily Telugu game for the diaspora — for folks who understand Amma on the phone but freeze when asked to read a wedding card.

**Three daily modes** (same puzzles for everyone, reset at local midnight):

1. **Word of the Day** — guess the meaning, then reveal. Tap 🔊 to hear it (uses your device's Telugu voice if it has one).
2. **Quiz** — 5 words, 4 choices.
   - 🌱 Easy: everyday words, Telugu script + transliteration
   - 🌶️ Hard: Telugu script only; feelings, family relations, food culture
3. **Akshara Match** — match 6 Telugu letters to their sounds against the clock.

Streaks and results are saved in the browser (localStorage). Results are shareable Wordle-style for the family WhatsApp group.

## Run locally

It's plain HTML/CSS/JS — no build step.

```bash
npx serve .        # or: python3 -m http.server
```

## Deploy

1. Push to GitHub.
2. On vercel.com → **Add New → Project** → import the repo.
3. Framework preset: **Other**. Leave build command empty. Deploy.

## Add words

Edit `words.js`. Each entry: `{ te, tr, en, note? }`. Easy words go in `EASY_WORDS`, harder ones in `HARD_WORDS`. Meanings within a list should be distinct so quiz choices don't overlap.
