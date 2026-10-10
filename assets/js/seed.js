// THE NORTHMOB — demo seed v7 (members area: login, private shop, private parties).
// Facts from owner-supplied research (sources in docs/profiles/the-north-mob.md).
// Stream/view figures are REPORTED, not independently verified.
// Admin edits override this in localStorage. Bumping `version` resets the store.
window.TNM = window.TNM || {};

TNM.SEED = {
  version: 7,

  content: {
    heroKicker: "GA-RANKUWA · PRETORIA NORTH · TRAPCARDI",
    heroTitle: "THE NORTHMOB",
    heroSub: "A four-man collective from Ga-Rankuwa running trap like a business. Trapcardi — US trap grit locked to Bacardi bounce. Family first, everybody eats. HERE 4 BUSINESS, out now.",
    tagline: "Here 4 Business.",
    ticker: [
      "HERE 4 BUSINESS",
      "TRAPCARDI",
      "FAMILY FIRST",
      "GA-RANKUWA · PRETORIA NORTH",
      "H4B OUT NOW",
      "BOOKINGS OPEN"
    ],
    contactEmail: "bookings@thenorthmob.example",   // placeholder (.example is reserved)
    contactPhone: "+27 00 000 0000",                 // placeholder
    vatNote: "Prices include VAT (demo assumption)."
  },

  stats: [
    { big: "6M+", label: "reported streams in 4 weeks — HERE 4 BUSINESS" },
    { big: "SAMA32", label: "main-stage performance, Sun City Superbowl" },
    { big: "1M+", label: "streams each — camp, chair & maatla, thata" },
    { big: "500K+", label: "views on the Cold Streets breakout" }
  ],

  members: [
    { id: "m1", name: "Trophy ZA",        title: "Director of Collaborations",  role: "The visionary — networks, rollouts, bridges to the game", handle: "trophy.rsa",        monogram: "TZ", photo: "photo-05.jpg", cardNo: "001" },
    { id: "m2", name: "Carlow Picasso",   title: "Executive Producer — Sound",  role: "Sonic architect — co-designer of the H4B sound",         handle: "carlow_picasso",   monogram: "CP", photo: "photo-01.jpg", cardNo: "002" },
    { id: "m3", name: "Orieblxckmaestro", title: "Chief Storytelling Officer",  role: "The roots — isiZulu × Sepitori storytelling",            handle: "orieblxckmaestro", monogram: "OM", photo: "photo-04.jpg", cardNo: "003" },
    { id: "m4", name: "MajorIcey",        title: "Director of Live Operations", role: "The sparkplug — live-performance igniter",                handle: "major_icey",       monogram: "MI", photo: "photo-03.jpg", cardNo: "004" }
  ],

  igAccounts: [
    { id: "ig-group", label: "THE NORTHMOB", handle: "thenorthmob_", confirmed: true, avatar: "assets/img/logo.jpg" },
    { id: "ig-trophy", label: "Trophy ZA", handle: "trophy.rsa", confirmed: true, avatar: "" },
    { id: "ig-carlow", label: "Carlow Picasso", handle: "carlow_picasso", confirmed: true, avatar: "" },
    { id: "ig-orie", label: "Orieblxckmaestro", handle: "orieblxckmaestro", confirmed: true, avatar: "" },
    { id: "ig-icey", label: "MajorIcey", handle: "major_icey", confirmed: true, avatar: "" }
  ],

  // Public item + members-only items (exclusive items render ONLY in the members shop).
  catalogue: [
    { id: "tee",        name: "H4B Tee",            priceCents: 29900, img: "assets/img/merch-tee.jpg", desc: "Black oversized tee. Logo chest print.",          active: true, stock: true,  ai: true, sizes: ["S", "M", "L", "XL", "XXL"], exclusive: false },
    { id: "tee-signed", name: "H4B Signed Tee",     priceCents: 39900, img: "assets/img/merch-tee.jpg", desc: "Members only — signed by the board. Limited run.", active: true, stock: true,  ai: true, sizes: ["M", "L", "XL"], exclusive: true },
    { id: "cap-member", name: "Members Cap",        priceCents: 19900, img: "assets/img/merch-tee.jpg", desc: "Members-only snapback. Red underbrim.",           active: true, stock: true,  ai: true, sizes: [], exclusive: true }
  ],

  // membersOnly events render only inside the members area (private invites).
  gigs: [
    { id: "g1", title: "Ga-Rankuwa",   dateISO: "2026-11-14", time: "19:00", venue: "Venue TBC", area: "Ga-Rankuwa",   ticketUrl: "", visible: true, membersOnly: false },
    { id: "g2", title: "Soshanguve",   dateISO: "2026-11-28", time: "18:00", venue: "Venue TBC", area: "Soshanguve",   ticketUrl: "", visible: true, membersOnly: false },
    { id: "g3", title: "Hammanskraal", dateISO: "2026-12-12", time: "20:00", venue: "Venue TBC", area: "Hammanskraal", ticketUrl: "", visible: true, membersOnly: false },
    { id: "p1", title: "The Vault — Private Listening Session", dateISO: "2026-11-21", time: "18:00", venue: "Address shared with members", area: "Pretoria North", ticketUrl: "", visible: true, membersOnly: true },
    { id: "p2", title: "Members-Only Year-End Turn Up",        dateISO: "2026-12-19", time: "19:00", venue: "Address shared with members", area: "Ga-Rankuwa",     ticketUrl: "", visible: true, membersOnly: true }
  ],

  sponsors: [
    { id: "s1", name: "Play", tier: "Title", url: "", active: true, placeholder: false },
    { id: "s2", name: "Stage partner slot", tier: "Stage", url: "", active: true, placeholder: true },
    { id: "s3", name: "Block partner slot", tier: "Block", url: "", active: true, placeholder: true }
  ],

  photos: [
    "photo-01.jpg", "photo-02.jpg", "photo-03.jpg", "photo-04.jpg",
    "photo-05.jpg", "photo-06.jpg", "photo-07.jpg", "photo-08.jpg"
  ]
};
