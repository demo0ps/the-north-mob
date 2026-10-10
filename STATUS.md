# STATUS — THE NORTHMOB demo

**Where we are:** fifth build — aesthetic aligned to the owner's references (monochrome photo,
red accents), typographic event posters, single-tee store, Play on the partner wall,
@thenorthmob_ live. Verified 76/76. Live in the preview pane; run locally with
`python3 -m http.server 8000 --bind 0.0.0.0` from this folder.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Home — slim ticker wire, **client-supplied B/W hero photo** + stamp, Board Memo stats, 6 teaser cards, next-event chip. |
| `the-mob.html` | Agenda 01 The Movement (+ seal), Agenda 02 The Board — crew ID cards with mapped photos (Trophy=05, Carlow=01, Orie=04, MajorIcey=03). |
| `gigs.html` | Agenda 03 — three H4B Listening Parties as **typographic posters** (no imagery). |
| `merch.html` | Agenda 04 — **single-item store: the H4B Tee** + cart + demo checkout. |
| `partners.html` | Agenda 05 — **Play (Title partner, link TBC)** + 2 open slots + 3 tiers; Agenda 07 Invest (greyscale boardroom). |
| `bookings.html` | Agenda 06 — Form B-01 booking request. |
| `gallery.html` | Agenda 08 — 5 IG windows (**all live, incl. @thenorthmob_**) + 8-photo feed + lightbox. |
| `admin.html` | Orders board, enquiries, catalogue editor, gig manager, links manager, content editor, data export/import/reset. |

Cart/checkout/toast injected on every page; cart follows the visitor across pages.

## Verified (2026-10-10, build 5)

- **76/76 checks passed** (`tools/verify.py`): links resolve; every page correct title/active
  nav/no overflow at 390px & 1280px; logo-only header; stats + source note; teasers; photo
  mapping exact; **gigs render zero images** with 3 typographic posters and kickers; merch is a
  single H4B tee; **Play shows as Title partner** with 2 placeholder slots; **all 5 IG follow
  buttons live, group links to instagram.com/thenorthmob_**; cross-page cart; booking + invest
  forms; admin transitions; **zero JS errors**.
- Screenshots (all non-blank): `shots/mobile-home.png`, `shots/desktop-{home,the-mob,gigs,merch,partners,bookings,gallery}.png`, `shots/admin-desktop.png`.

## Demo boundaries

- No backend, no real payments, no logins. Browser localStorage; export/import in admin → Data.
- Merch price, event details, remaining sponsor slots, contact details: placeholders, labelled.
- Stats labelled "Reported — not independently verified" with sources named.
- AI imagery (hero, invest, tee mockup) greyscale/illustrative and labelled; logo + photos client-supplied.
- Member executive titles are creative flavour from researched roles.

## Deployed (2026-10-10)

- Repo: https://github.com/demo0ps/the-north-mob (public, branch `main`)
- Live preview: **https://demo0ps.github.io/the-north-mob/**
- GitHub Pages serving from `main` / root; build status "built"; all 8 pages + assets verified HTTP 200 on the live URL.
- Future updates: commit to `main` and push — Pages redeploys automatically.
- Optional: custom domain via a CNAME record (e.g. thenorthmob.eliteway.co.za → demo0ps.github.io), then enforce HTTPS in repo settings.

## Known gaps / not done

- **image-1.png reference arrived empty (0 bytes)** — re-attach if it carried unique direction.
- Play: URL, tier confirmation and exact crediting outstanding (tier assumed Title).
- No admin editor for members/stats (seed-defined only).
- Not deployed. Suggested: GitHub Pages (R0).

## Next steps (owner)

1. Play: send the link + how they want to be credited → admin → Content (sponsor wall).
2. Real tee price → admin → Catalogue. Real event dates/venues/ticket links → admin → Gigs.
3. Real contact details → admin → Links.
4. Decide whether named artists (Focalistic etc.) may appear in site copy.
5. Deploy target.
