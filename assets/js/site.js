// THE NORTHMOB — storefront, multi-page edition.
// One script serves every page: renders only what the current page contains,
// and injects the shared chrome (cart drawer, checkout modal, toast, lightbox)
// so every page has a working cart. Cart state lives in localStorage (store.js),
// so it follows the visitor across pages. No external network calls anywhere.
(function () {
  "use strict";
  var S = window.TNM.store;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ---------- shared chrome, injected once per page ----------
  var CHROME =
    '<div class="overlay" id="overlay"></div>' +
    '<aside class="drawer" id="cartDrawer" aria-label="Cart">' +
    '<div class="drawer-head"><h3>Your cart</h3>' +
    '<button class="x-btn" id="drawerClose" aria-label="Close cart">×</button></div>' +
    '<div class="drawer-items" id="cartItems"></div>' +
    '<div class="drawer-foot">' +
    '<div class="drawer-total"><span>Total</span><span id="drawerTotal">R0.00</span></div>' +
    '<button class="btn btn-red" id="checkoutBtn">Checkout (demo)</button></div></aside>' +

    '<div class="modal" id="checkoutModal" role="dialog" aria-modal="true" aria-label="Checkout">' +
    '<div class="modal-card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><h3>Checkout</h3>' +
    '<button class="x-btn" id="coClose" aria-label="Close checkout">×</button></div>' +
    '<p class="demo-banner">Demo checkout — simulated payment, no money moves, nothing is sent anywhere.</p>' +
    '<form id="coForm" novalidate>' +
    '<div class="summary" id="coSummary"></div>' +
    '<div class="field"><label for="coName">Name *</label>' +
    '<input id="coName" type="text" autocomplete="name" required><span class="err">Name is required.</span></div>' +
    '<div class="field"><label for="coContact">Email or phone *</label>' +
    '<input id="coContact" type="text" autocomplete="email" required><span class="err">Contact is required.</span></div>' +
    '<div class="radio-row" role="radiogroup" aria-label="Payment method">' +
    '<label class="radio-pill"><input type="radio" name="coMethod" value="Card (simulated)" checked>' +
    '<span><b>Card</b><small>Simulated — no card fields, no charge</small></span></label>' +
    '<label class="radio-pill"><input type="radio" name="coMethod" value="Instant EFT (simulated)">' +
    '<span><b>Instant EFT</b><small>Simulated — no bank redirect</small></span></label>' +
    '<label class="radio-pill"><input type="radio" name="coMethod" value="Pay on collection (demo)">' +
    '<span><b>Pay on collection</b><small>Arrange with the Mob at a gig</small></span></label></div>' +
    '<button type="submit" class="btn btn-red" id="coPlace" style="width:100%">Place demo order</button></form>' +
    '<div class="success-box hidden" id="coSuccess">' +
    '<p style="font-family:var(--display);font-size:1.4rem;text-transform:uppercase">Order in!</p>' +
    '<p class="big-ref" id="coRef"></p>' +
    '<p class="hint">Demo order placed. It is on the admin board — open <a href="admin.html" style="color:var(--red)">the admin</a> to track it.</p>' +
    '<button class="btn btn-hl" id="coDone" style="margin-top:0.9rem">Done — back to the site</button></div>' +
    '</div></div>' +

    '<div class="toast" id="toast" role="status" aria-live="polite"></div>';

  var LIGHTBOX =
    '<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer">' +
    '<button class="lb-close" id="lbClose" aria-label="Close">×</button>' +
    '<button class="lb-nav lb-prev" id="lbPrev" aria-label="Previous photo">‹</button>' +
    '<img id="lightboxImg" src="" alt="THE NORTHMOB photo (client-supplied)">' +
    '<button class="lb-nav lb-next" id="lbNext" aria-label="Next photo">›</button></div>';

  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // ---------- ticker ----------
  function renderTicker() {
    var track = $("#tickerTrack");
    if (!track) return;
    track.innerHTML = "";
    var items = (S.state.content.ticker || []).length ? S.state.content.ticker : ["THE NORTHMOB"];
    for (var c = 0; c < 2; c++) {
      items.forEach(function (t) { track.appendChild(el("span", null, esc(t))); });
    }
  }

  // ---------- hero (home) ----------
  function visibleGigs() {
    var today = new Date().toISOString().slice(0, 10);
    return S.state.gigs
      .filter(function (g) { return g.visible && !g.membersOnly && g.dateISO >= today; })
      .sort(function (a, b) { return a.dateISO < b.dateISO ? -1 : 1; });
  }
  function privateGigs() {
    var today = new Date().toISOString().slice(0, 10);
    return S.state.gigs
      .filter(function (g) { return g.visible && g.membersOnly && g.dateISO >= today; })
      .sort(function (a, b) { return a.dateISO < b.dateISO ? -1 : 1; });
  }
  function renderHero() {
    if (!$("#heroTitle")) return;
    $("#heroKicker").textContent = S.state.content.heroKicker;
    $("#heroTitle").innerHTML =
      '<span class="row1">' + esc(S.state.content.heroTitle).split(" ").slice(0, 1).join(" ") + "</span> " +
      '<span class="row2">' + esc(S.state.content.heroTitle).split(" ").slice(1).join(" ") + "</span>";
    $("#heroSub").textContent = S.state.content.heroSub;
    renderNextEvent();
  }
  function renderNextEvent() {
    var chip = $("#nextGig");
    if (!chip) return;
    var gigs = visibleGigs();
    if (!gigs.length) { chip.textContent = "No events confirmed yet — book one."; return; }
    var d = new Date(gigs[0].dateISO + "T00:00:00");
    chip.innerHTML =
      '<span class="dot"></span> Next up: <strong>H4B Listening Party — ' + esc(gigs[0].area || gigs[0].title) + "</strong> · " +
      DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
    var teaser = $("#teaserNext");
    if (teaser) {
      teaser.innerHTML = DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " · " + esc(gigs[0].area);
    }
  }

  // ---------- stats (home) ----------
  function renderStats() {
    var strip = $("#statStrip");
    if (!strip) return;
    strip.innerHTML = "";
    (S.state.stats || []).forEach(function (st) {
      var card = el("div", "stat-card");
      card.appendChild(el("b", null, esc(st.big)));
      card.appendChild(el("span", null, esc(st.label)));
      strip.appendChild(card);
    });
  }

  // ---------- crew (the-mob) ----------
  function renderCrew() {
    var grid = $("#crewGrid");
    if (!grid) return;
    grid.innerHTML = "";
    S.state.members.forEach(function (m, idx) {
      var card = el("article", "member-card biz-card");
      var top = el("div", "biz-top");
      top.appendChild(el("div", "biz-mono", esc(m.monogram || m.name.slice(0, 2).toUpperCase())));
      var head = el("div", "biz-head");
      head.appendChild(el("h3", "member-name", esc(m.name)));
      head.appendChild(el("p", "biz-title", esc(m.title || "The Mob")));
      top.appendChild(head);
      card.appendChild(top);
      var photo = el("div", "biz-photo");
      if (m.photo) {
        var img = el("img"); img.src = imgSrc(m.photo);
        img.alt = esc(m.name) + " (client-supplied photo)";
        photo.appendChild(img);
      } else {
        photo.appendChild(el("span", "biz-stamp", "H4B"));
      }
      card.appendChild(photo);
      var body = el("div", "biz-body");
      body.appendChild(el("p", "member-role", esc(m.role)));
      if (m.handle) {
        var a = el("a", "member-ig", "@" + esc(m.handle) + " ↗");
        a.href = "https://instagram.com/" + encodeURIComponent(m.handle);
        a.target = "_blank"; a.rel = "noopener";
        body.appendChild(a);
      }
      var foot = el("div", "biz-foot");
      foot.appendChild(el("span", null, "THE NORTHMOB"));
      foot.appendChild(el("span", "biz-no", "№ " + (m.cardNo || String(idx + 1).padStart(3, "0"))));
      body.appendChild(foot);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  // ---------- gigs / listening parties ----------
  function renderGigs() {
    var grid = $("#gigGrid");
    if (!grid) return;
    grid.innerHTML = "";
    var gigs = visibleGigs();
    if (!gigs.length) {
      grid.appendChild(el("p", "empty-note", "No events confirmed yet. Book the Mob and make one."));
      return;
    }
    gigs.forEach(function (g) {
      var d = new Date(g.dateISO + "T00:00:00");
      var card = el("article", "gig-poster");
      card.appendChild(el("p", "gp-kicker", "H4B Listening Party"));
      var date = el("div", "gp-date");
      date.appendChild(el("span", "d", String(d.getDate())));
      date.appendChild(el("span", "m", MONTHS[d.getMonth()] + " " + d.getFullYear()));
      card.appendChild(date);
      card.appendChild(el("h3", "gp-title", esc(g.title)));
      card.appendChild(el("p", "gp-meta",
        "<strong>" + DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + "</strong> · " +
        esc(g.time || "") + " · " + esc(g.venue || "") + " · " + esc(g.area || "")));
      card.appendChild(el("div", "gp-rule"));
      var body = el("div", "gp-body");
      if (g.ticketUrl) {
        var a = el("a", "btn btn-hl btn-sm", "Get tickets");
        a.href = g.ticketUrl; a.target = "_blank"; a.rel = "noopener";
        body.appendChild(a);
      } else {
        body.appendChild(el("span", "btn btn-disabled btn-sm", "Tickets TBC"));
      }
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  // ---------- merch ----------
  function imgSrc(src) {
    src = String(src);
    if (src.indexOf("data:") === 0) return src;      // uploaded data URI
    if (src.indexOf("/") > -1) return src;           // already a path
    return "assets/img/" + src;                      // bare file name
  }
  function renderMerch() {
    var grid = $("#merchGrid");
    if (!grid) return;
    grid.innerHTML = "";
    var member = S.isMember();
    S.state.catalogue.filter(function (p) { return p.active && !p.exclusive; }).forEach(function (p) {
      var card = el("article", "product");
      var imgWrap = el("div", "product-img");
      var img = el("img"); img.src = imgSrc(p.img); img.alt = "Illustrative mockup: " + esc(p.name); img.loading = "lazy";
      imgWrap.appendChild(img);
      imgWrap.appendChild(el("span", "price-sticker", S.fmt(p.priceCents)));
      if (p.exclusive) imgWrap.appendChild(el("span", "member-flag", "FAMILY"));
      if (!p.stock) imgWrap.appendChild(el("div", "soldout", "Sold out"));
      card.appendChild(imgWrap);
      var body = el("div", "product-body");
      body.appendChild(el("h3", "product-name", esc(p.name)));
      body.appendChild(el("p", "product-desc", esc(p.desc || "")));
      if (p.ai) body.appendChild(el("span", "product-ai", "Illustrative image (AI)"));
      var chosenSize = null;
      if (p.sizes && p.sizes.length) {
        chosenSize = p.sizes.indexOf("M") > -1 ? "M" : p.sizes[0];
        var pills = el("div", "size-pills");
        p.sizes.forEach(function (sz) {
          var id = "sz-" + p.id + "-" + sz;
          var input = el("input"); input.type = "radio"; input.name = "sz-" + p.id; input.value = sz; input.id = id;
          if (sz === chosenSize) input.checked = true;
          var lab = el("label", "size-pill", esc(sz));
          lab.setAttribute("for", id);
          input.addEventListener("change", function () { chosenSize = sz; });
          pills.appendChild(input); pills.appendChild(lab);
        });
        body.appendChild(pills);
      }
      var btn = el("button", "btn btn-red btn-sm", p.stock ? "Add to cart" : "Sold out");
      if (!p.stock) { btn.disabled = true; btn.className = "btn btn-disabled btn-sm"; }
      else btn.addEventListener("click", function () {
        if (S.addToCart(p.id, chosenSize)) { updateCartBadge(); toast("Added: " + p.name + (chosenSize ? " (" + chosenSize + ")" : "")); renderCart(); }
        else toast("Join the family first — it's free");
      });
      body.appendChild(btn);
      card.appendChild(body);
      grid.appendChild(card);
    });
    // one members card: private-shop link for family, locked teaser for others
    if (S.state.catalogue.some(function (p) { return p.active && p.exclusive; })) {
      var mcard = el("article", "product product-members");
      var mw = el("div", "product-img");
      var mimg = el("img"); mimg.src = imgSrc(S.state.catalogue.filter(function (p) { return p.exclusive; })[0].img);
      mimg.alt = "Members-only drop"; mimg.loading = "lazy";
      mw.appendChild(mimg);
      if (member) {
        mw.appendChild(el("span", "member-flag", "FAMILY"));
      } else {
        mimg.style.filter = "blur(9px) grayscale(0.4) brightness(0.75)";
        mw.appendChild(el("div", "locked-veil", '<span class="lock">MEMBERS ONLY</span>'));
      }
      mcard.appendChild(mw);
      var mb = el("div", "product-body");
      mb.appendChild(el("h3", "product-name", member ? "Private shop" : "Locked drop"));
      mb.appendChild(el("p", "product-desc", member
        ? "The exclusive drops live in the members area."
        : "The family gets first access to exclusive merch."));
      var ma = el("a", "btn " + (member ? "btn-hl" : "btn-red") + " btn-sm", member ? "Enter members area →" : "Join the family");
      ma.href = member ? "members.html" : "community.html";
      mb.appendChild(ma);
      mcard.appendChild(mb);
      grid.appendChild(mcard);
    }
    var note = $("#vatNote");
    if (note) note.textContent = S.state.content.vatNote;
  }

  // ---------- cart (every page) ----------
  function updateCartBadge() {
    var n = S.cartCount();
    var badge = $("#cartCount");
    if (!badge) return;
    badge.textContent = n;
    badge.style.display = n ? "grid" : "none";
  }
  function renderCart() {
    var list = $("#cartItems");
    if (!list) return;
    list.innerHTML = "";
    var lines = S.cartLines();
    if (!lines.length) {
      list.appendChild(el("p", "drawer-empty", "Your cart is empty.<br>Fix that — the Mob is watching."));
      $("#drawerTotal").textContent = S.fmt(0);
      $("#checkoutBtn").disabled = true;
      return;
    }
    lines.forEach(function (l) {
      var row = el("div", "cart-line");
      var img = el("img"); img.src = imgSrc(l.img); img.alt = esc(l.name);
      var mid = el("div");
      mid.appendChild(el("div", "n", esc(l.name) + (l.size ? ' <span class="cart-size">[' + esc(l.size) + "]</span>" : "")));
      mid.appendChild(el("div", "p", S.fmt(l.priceCents) + " each"));
      var qty = el("div", "qty");
      var minus = el("button", null, "–"); minus.setAttribute("aria-label", "Decrease quantity");
      var count = el("span", null, String(l.qty));
      var plus = el("button", null, "+"); plus.setAttribute("aria-label", "Increase quantity");
      minus.addEventListener("click", function () { S.setQty(l.key, l.qty - 1); renderCart(); updateCartBadge(); });
      plus.addEventListener("click", function () { S.setQty(l.key, l.qty + 1); renderCart(); updateCartBadge(); });
      qty.appendChild(minus); qty.appendChild(count); qty.appendChild(plus);
      mid.appendChild(qty);
      var rm = el("button", "rm", "Remove");
      rm.addEventListener("click", function () { S.removeFromCart(l.key); renderCart(); updateCartBadge(); });
      mid.appendChild(rm);
      var tot = el("div", "line-total", S.fmt(l.priceCents * l.qty));
      row.appendChild(img); row.appendChild(mid); row.appendChild(tot);
      list.appendChild(row);
    });
    $("#drawerTotal").textContent = S.fmt(S.cartTotal());
    $("#checkoutBtn").disabled = false;
  }
  function openDrawer() { $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("open"); renderCart(); }
  function closeDrawer() { $("#cartDrawer").classList.remove("open"); $("#overlay").classList.remove("open"); }

  // ---------- checkout (simulated, every page) ----------
  function renderCheckoutSummary() {
    var box = $("#coSummary");
    box.innerHTML = "";
    S.cartLines().forEach(function (l) {
      box.appendChild(el("div", "row", "<span>" + esc(l.name) + (l.size ? " (" + esc(l.size) + ")" : "") + " × " + l.qty + "</span><span>" + S.fmt(l.priceCents * l.qty) + "</span>"));
    });
    box.appendChild(el("div", "row total", "<span>Total</span><span>" + S.fmt(S.cartTotal()) + "</span>"));
  }
  function openCheckout() {
    if (!S.cartCount()) return;
    renderCheckoutSummary();
    $("#coForm").classList.remove("hidden");
    $("#coSuccess").classList.add("hidden");
    $("#checkoutModal").classList.add("open");
  }
  function closeCheckout() {
    $("#checkoutModal").classList.remove("open");
    // After a completed order, the cart is empty — close the drawer too so
    // the customer lands back on the site, not on an empty cart.
    if (!$("#coSuccess").classList.contains("hidden")) closeDrawer();
  }
  function submitCheckout(ev) {
    ev.preventDefault();
    var name = $("#coName").value.trim();
    var contact = $("#coContact").value.trim();
    var methodInput = document.querySelector('input[name="coMethod"]:checked');
    var nameField = $("#coName").closest(".field");
    var contactField = $("#coContact").closest(".field");
    nameField.classList.remove("invalid"); contactField.classList.remove("invalid");
    var ok = true;
    if (name.length < 2) { nameField.classList.add("invalid"); ok = false; }
    if (!contact) { contactField.classList.add("invalid"); ok = false; }
    if (!ok || !methodInput) return;
    var btn = $("#coPlace");
    btn.disabled = true; btn.textContent = "Placing…";
    setTimeout(function () {
      var order = S.placeOrder({ name: name, contact: contact }, methodInput.value);
      btn.disabled = false; btn.textContent = "Place demo order";
      if (!order) { toast("Cart changed — try again"); return; }
      $("#coForm").classList.add("hidden");
      $("#coSuccess").classList.remove("hidden");
      $("#coRef").textContent = order.ref;
      updateCartBadge(); renderCart();
    }, 350);
  }

  // ---------- sponsors (partners) ----------
  function renderSponsors() {
    var strip = $("#partnerStrip");
    if (!strip) return;
    strip.innerHTML = "";
    S.state.sponsors.filter(function (s) { return s.active; }).forEach(function (s) {
      var slot = el("div", "partner-slot");
      slot.innerHTML = s.placeholder
        ? "<b>" + esc(s.tier) + " partner</b> Your logo here — " + esc(s.tier).toLowerCase() + " slot open"
        : (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener"><b>' + esc(s.name) + "</b>" + esc(s.tier) + " partner</a>"
                 : "<b>" + esc(s.name) + "</b>" + esc(s.tier) + " partner");
      strip.appendChild(slot);
    });
  }

  // ---------- forms ----------
  function validate(fields) {
    var ok = true;
    fields.forEach(function (f) {
      var node = document.getElementById(f.id);
      if (!node) return;
      var wrap = node.closest(".field");
      wrap.classList.remove("invalid");
      var bad = !node.value.trim() || (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(node.value.trim()));
      if (bad) { wrap.classList.add("invalid"); ok = false; }
    });
    return ok;
  }
  function wireBookingForm() {
    var form = $("#bookingForm");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!validate([{ id: "bkName" }, { id: "bkEmail", email: true }, { id: "bkDate" }, { id: "bkVenue" }])) return;
      var e = S.addEnquiry("booking", {
        name: $("#bkName").value.trim(), org: $("#bkOrg").value.trim(),
        email: $("#bkEmail").value.trim(), phone: $("#bkPhone").value.trim(),
        eventType: $("#bkType").value, date: $("#bkDate").value,
        venue: $("#bkVenue").value.trim(), area: $("#bkArea").value.trim(),
        budget: $("#bkBudget").value, notes: $("#bkNotes").value.trim()
      });
      form.reset();
      $("#bookingDone").classList.remove("hidden");
      $("#bookingRef").textContent = e.ref;
      $("#bookingDone").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  function wireInvestForm() {
    var form = $("#investForm");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!validate([{ id: "ivCompany" }, { id: "ivName" }, { id: "ivEmail", email: true }])) return;
      var interest = $("#ivInterest").value;
      var type = interest === "sponsorship" ? "sponsorship" : "investment";
      var e = S.addEnquiry(type, {
        company: $("#ivCompany").value.trim(), name: $("#ivName").value.trim(),
        email: $("#ivEmail").value.trim(), interest: interest,
        message: $("#ivMessage").value.trim()
      });
      form.reset();
      $("#investDone").classList.remove("hidden");
      $("#investRef").textContent = e.ref;
      $("#investDone").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.querySelectorAll("[data-interest]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sel = $("#ivInterest");
        if (sel) sel.value = b.getAttribute("data-interest");
      });
    });
  }

  // ---------- instagram + gallery ----------
  function renderIG() {
    var wrap = $("#igWindows");
    if (wrap) {
      wrap.innerHTML = "";
      S.state.igAccounts.forEach(function (acc) {
        var card = el("div", "ig-window");
        if (acc.avatar) {
          var img = el("img", "avatar"); img.src = acc.avatar;
          img.alt = esc(acc.label) + " avatar";
          card.appendChild(img);
        } else {
          var member = S.state.members.filter(function (m) { return m.handle === acc.handle; })[0];
          card.appendChild(el("div", "avatar-mono", esc(member ? (member.monogram || "?") : "?")));
        }
        card.appendChild(el("h3", null, esc(acc.label)));
        card.appendChild(el("p", "handle", "@" + esc(acc.handle)));
        if (acc.confirmed) {
          var a = el("a", "btn btn-hl btn-sm", "Follow ↗");
          a.setAttribute("aria-label", "Follow " + acc.label + " on Instagram");
          a.href = "https://instagram.com/" + encodeURIComponent(acc.handle);
          a.target = "_blank"; a.rel = "noopener";
          card.appendChild(a);
        } else {
          card.appendChild(el("span", "btn btn-disabled btn-sm", "Follow — TBC"));
          card.appendChild(el("p", "note", "Goes live the moment the handle is confirmed in admin."));
        }
        wrap.appendChild(card);
      });
    }
    var feed = $("#igFeed");
    if (feed) {
      feed.innerHTML = "";
      S.state.photos.forEach(function (p, i) {
        var b = el("button");
        b.setAttribute("aria-label", "Open photo " + (i + 1));
        var img = el("img");
        img.src = imgSrc(p); img.alt = "THE NORTHMOB — photo " + (i + 1) + " (client-supplied)";
        img.loading = "lazy";
        b.appendChild(img);
        b.addEventListener("click", function () { openLightbox(i); });
        feed.appendChild(b);
      });
    }
  }

  // ---------- lightbox (gallery only) ----------
  var lbIndex = 0;
  function openLightbox(i) {
    lbIndex = i;
    $("#lightboxImg").src = imgSrc(S.state.photos[i]);
    $("#lightbox").classList.add("open");
  }
  function lbStep(d) {
    lbIndex = (lbIndex + d + S.state.photos.length) % S.state.photos.length;
    $("#lightboxImg").src = imgSrc(S.state.photos[lbIndex]);
  }
  function wireLightbox() {
    if (!$("#lightbox")) return;
    $("#lbPrev").addEventListener("click", function () { lbStep(-1); });
    $("#lbNext").addEventListener("click", function () { lbStep(1); });
    $("#lbClose").addEventListener("click", function () { $("#lightbox").classList.remove("open"); });
    $("#lightbox").addEventListener("click", function (ev) {
      if (ev.target === $("#lightbox")) $("#lightbox").classList.remove("open");
    });
    document.addEventListener("keydown", function (ev) {
      if (!$("#lightbox").classList.contains("open")) return;
      if (ev.key === "Escape") $("#lightbox").classList.remove("open");
      if (ev.key === "ArrowLeft") lbStep(-1);
      if (ev.key === "ArrowRight") lbStep(1);
    });
  }

  // ---------- footer (every page) ----------
  function renderFooter() {
    var e = $("#footEmail");
    if (!e) return;
    e.textContent = S.state.content.contactEmail;
    e.href = "mailto:" + S.state.content.contactEmail;
    var p = $("#footPhone");
    if (p) { p.textContent = S.state.content.contactPhone; p.href = "tel:" + S.state.content.contactPhone.replace(/\s+/g, ""); }
  }

  // ---------- membership chip (every page) ----------
  function renderMemberChip() {
    var nav = $(".site-nav .inner");
    if (!nav) return;
    var existing = $("#memberChip");
    if (existing) existing.remove();
    if (!S.isMember()) return;
    var chip = el("span", "member-chip", "FAMILY");
    chip.id = "memberChip";
    chip.title = S.state.membership.name + " — " + (S.state.membership.memberNo || "family member");
    var cartBtn = $("#cartBtn");
    if (cartBtn) nav.insertBefore(chip, cartBtn); else nav.appendChild(chip);
  }

  // ---------- community (join the family) ----------
  function wireCommunityForm() {
    var form = $("#communityForm");
    if (!form) return;
    var count = $("#familyCount");
    if (count) count.textContent = state_countLabel();
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nameF = $("#cmName").closest(".field");
      var mailF = $("#cmEmail").closest(".field");
      nameF.classList.remove("invalid"); mailF.classList.remove("invalid");
      var ok = true;
      var name = $("#cmName").value.trim();
      var email = $("#cmEmail").value.trim();
      if (name.length < 2) { nameF.classList.add("invalid"); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { mailF.classList.add("invalid"); ok = false; }
      if (!ok) return;
      var interests = [];
      document.querySelectorAll("input[name='cmInterest']:checked").forEach(function (c) { interests.push(c.value); });
      var m = S.joinCommunity({
        name: name, email: email, phone: $("#cmPhone").value.trim(),
        interests: interests, newsletter: $("#cmNewsletter").checked
      });
      if (!m) return;
      form.reset();
      $("#communityDone").classList.remove("hidden");
      $("#communityRef").textContent = m.memberNo || m.id;
      $("#communityDone").scrollIntoView({ behavior: "smooth", block: "center" });
      renderMemberChip();
      var c2 = $("#familyCount");
      if (c2) c2.textContent = state_countLabel();
      renderMerch();
    });
  }
  function state_countLabel() {
    var n = S.state.community.length;
    return n + (n === 1 ? " family member" : " family members") + " (demo)";
  }

  // ---------- members page (gate + private shop + private events) ----------
  function whenShort(iso) {
    var d = new Date(iso);
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function renderMembersPage() {
    var gate = $("#memberGate");
    if (!gate) return; // not on members.html
    var area = $("#memberArea");
    if (S.isMember()) {
      gate.classList.add("hidden");
      area.classList.remove("hidden");
      var m = S.state.membership;
      $("#memName").textContent = m.name;
      $("#memNo").textContent = m.memberNo || "—";
      $("#memSince").textContent = m.since ? "Member since " + whenShort(m.since) : "";
      renderMembersShop();
      renderPrivateEvents();
    } else {
      gate.classList.remove("hidden");
      area.classList.add("hidden");
    }
  }
  function renderMembersShop() {
    var grid = $("#memberShop");
    if (!grid) return;
    grid.innerHTML = "";
    var items = S.state.catalogue.filter(function (p) { return p.active && p.exclusive; });
    if (!items.length) {
      grid.appendChild(el("p", "empty-note", "No private drops right now. The board is cooking."));
      return;
    }
    items.forEach(function (p) {
      var card = el("article", "product product-exclusive");
      var imgWrap = el("div", "product-img");
      var img = el("img"); img.src = imgSrc(p.img); img.alt = "Illustrative mockup: " + esc(p.name); img.loading = "lazy";
      imgWrap.appendChild(img);
      imgWrap.appendChild(el("span", "price-sticker", S.fmt(p.priceCents)));
      imgWrap.appendChild(el("span", "member-flag", "FAMILY"));
      if (!p.stock) imgWrap.appendChild(el("div", "soldout", "Sold out"));
      card.appendChild(imgWrap);
      var body = el("div", "product-body");
      body.appendChild(el("h3", "product-name", esc(p.name)));
      body.appendChild(el("p", "product-desc", esc(p.desc || "")));
      if (p.ai) body.appendChild(el("span", "product-ai", "Illustrative image (AI)"));
      var chosenSize = null;
      if (p.sizes && p.sizes.length) {
        chosenSize = p.sizes.indexOf("M") > -1 ? "M" : p.sizes[0];
        var pills = el("div", "size-pills");
        p.sizes.forEach(function (sz) {
          var id = "msz-" + p.id + "-" + sz;
          var input = el("input"); input.type = "radio"; input.name = "msz-" + p.id; input.value = sz; input.id = id;
          if (sz === chosenSize) input.checked = true;
          var lab = el("label", "size-pill", esc(sz));
          lab.setAttribute("for", id);
          input.addEventListener("change", function () { chosenSize = sz; });
          pills.appendChild(input); pills.appendChild(lab);
        });
        body.appendChild(pills);
      }
      var btn = el("button", "btn btn-red btn-sm", p.stock ? "Add to cart" : "Sold out");
      if (!p.stock) { btn.disabled = true; btn.className = "btn btn-disabled btn-sm"; }
      else btn.addEventListener("click", function () {
        if (S.addToCart(p.id, chosenSize)) { updateCartBadge(); toast("Added: " + p.name + (chosenSize ? " (" + chosenSize + ")" : "")); renderCart(); }
      });
      body.appendChild(btn);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }
  function renderPrivateEvents() {
    var grid = $("#privateEvents");
    if (!grid) return;
    grid.innerHTML = "";
    var gigs = privateGigs();
    if (!gigs.length) {
      grid.appendChild(el("p", "empty-note", "No private invites right now. Watch this space."));
      return;
    }
    var mno = (S.state.membership && S.state.membership.memberNo) || "";
    gigs.forEach(function (g) {
      var d = new Date(g.dateISO + "T00:00:00");
      var going = S.state.rsvps.some(function (r) { return r.eventId === g.id && r.memberNo === mno; });
      var card = el("article", "gig-poster");
      card.appendChild(el("p", "gp-kicker", "Private invite — members only"));
      var date = el("div", "gp-date");
      date.appendChild(el("span", "d", String(d.getDate())));
      date.appendChild(el("span", "m", MONTHS[d.getMonth()] + " " + d.getFullYear()));
      card.appendChild(date);
      card.appendChild(el("h3", "gp-title", esc(g.title)));
      card.appendChild(el("p", "gp-meta",
        "<strong>" + DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + "</strong> · " +
        esc(g.time || "") + " · " + esc(g.venue || "") + " · " + esc(g.area || "")));
      card.appendChild(el("div", "gp-rule"));
      var body = el("div", "gp-body");
      body.appendChild(el("p", "gp-meta", "Free entry for members. Bring your member number."));
      var btn = el("button", "btn btn-sm " + (going ? "btn-ghost" : "btn-hl"),
        going ? "Going ✓ — cancel" : "RSVP — I'm in");
      btn.addEventListener("click", function () {
        var res = S.rsvpEvent(g.id);
        if (res && res.cancelled) toast("RSVP cancelled");
        else toast("You're on the list. " + (mno || ""));
        renderPrivateEvents();
      });
      body.appendChild(btn);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }
  function wireMembersPage() {
    var form = $("#loginForm");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = $("#loginErr");
      err.classList.add("hidden");
      var val = $("#loginNo").value.trim();
      var m = S.loginMember(val);
      if (!m) {
        err.textContent = "Member number not found on this device. Numbers look like H4B-0001 — or join the family first.";
        err.classList.remove("hidden");
        return;
      }
      $("#loginNo").value = "";
      renderMemberChip(); renderMerch(); renderMembersPage();
      toast("Welcome back, " + m.name);
    });
    var lo = $("#logoutBtn");
    if (lo) lo.addEventListener("click", function () {
      S.logoutMember();
      updateCartBadge(); renderCart(); renderMemberChip(); renderMerch(); renderMembersPage();
      toast("Logged out");
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", function () {
    // inject shared chrome first, then wire everything that exists on this page
    document.body.insertAdjacentHTML("beforeend", CHROME);
    if ($("#igFeed")) document.body.insertAdjacentHTML("beforeend", LIGHTBOX);

    renderTicker(); renderHero(); renderNextEvent(); renderStats(); renderCrew();
    renderGigs(); renderMerch(); renderSponsors(); renderIG(); renderFooter();
    updateCartBadge(); renderCart();
    renderMemberChip();
    renderMembersPage();
    wireBookingForm(); wireInvestForm(); wireLightbox(); wireCommunityForm(); wireMembersPage();

    var cartBtn = $("#cartBtn");
    if (cartBtn) cartBtn.addEventListener("click", openDrawer);
    $("#drawerClose").addEventListener("click", closeDrawer);
    $("#overlay").addEventListener("click", closeDrawer);
    $("#checkoutBtn").addEventListener("click", openCheckout);
    $("#coClose").addEventListener("click", closeCheckout);
    $("#coForm").addEventListener("submit", submitCheckout);
    $("#coDone").addEventListener("click", closeCheckout);
    $("#checkoutModal").addEventListener("click", function (ev) {
      if (ev.target === $("#checkoutModal")) closeCheckout();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { closeDrawer(); closeCheckout(); }
    });
  });
})();
