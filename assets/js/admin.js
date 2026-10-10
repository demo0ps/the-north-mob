// THE NORTHMOB — admin (DEMO). Everything edits TNM.store.state and saves to
// this browser's localStorage. The storefront reads the same state.
// v6 adds: CRM (contacts + timelines + notes), community members, image uploads
// (compressed client-side, quota-guarded), sized catalogue, members editor,
// gallery manager, order notes.
(function () {
  "use strict";
  var S = window.TNM.store;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
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
  var imgSrc = function (src) {
    src = String(src);
    if (src.indexOf("data:") === 0) return src;
    if (src.indexOf("/") > -1) return src;
    return "assets/img/" + src;
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function when(iso) {
    var d = new Date(iso);
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + ", " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ---------- image upload (compress -> data URI -> state, quota-guarded) ----------
  function compressImage(file, maxSide, quality, cb) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = function () { URL.revokeObjectURL(url); alert("Could not read that image."); };
    img.src = url;
  }
  function uploadButton(label, onImage) {
    var wrap = el("span", "upload-wrap");
    var input = el("input"); input.type = "file"; input.accept = "image/*"; input.hidden = true;
    var btn = el("button", "btn btn-ghost btn-sm", label);
    btn.type = "button";
    btn.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var f = input.files[0];
      if (!f) return;
      compressImage(f, 900, 0.82, function (uri) {
        onImage(uri);
        input.value = "";
      });
    });
    wrap.appendChild(btn); wrap.appendChild(input);
    return wrap;
  }
  function storageBanner() {
    var b = $("#storageBanner");
    if (!b) return;
    if (window.TNM.storageError) {
      b.textContent = "Browser storage is full — the last change was NOT saved. Export your data, or remove uploaded images, then retry.";
      b.classList.add("show");
    } else {
      b.classList.remove("show");
    }
  }

  // ---------- tabs ----------
  function wireTabs() {
    $$(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        $$(".tab").forEach(function (x) { x.classList.remove("active"); });
        $$(".admin-panel").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        $("#" + t.getAttribute("data-panel")).classList.add("active");
        renderAll();
      });
    });
  }

  // ---------- orders ----------
  function renderOrders() {
    var box = $("#ordersBody");
    box.innerHTML = "";
    var orders = S.state.orders;
    $("#ordCount").textContent = orders.length;
    var open = orders.filter(function (o) { return o.status === "new"; }).length;
    $("#ordOpen").textContent = open + " open";
    if (!orders.length) {
      box.appendChild(el("tr", null, '<td colspan="6" class="empty-note">No orders yet. Place one from the storefront to see it here.</td>'));
      return;
    }
    orders.forEach(function (o) {
      var tr = el("tr");
      var items = "<ul class='order-items'>" + o.items.map(function (i) {
        return "<li>" + esc(i.name) + (i.size ? " <b>[" + esc(i.size) + "]</b>" : "") + " × " + i.qty + " — " + S.fmt(i.priceCents * i.qty) + "</li>";
      }).join("") + "</ul>";
      var actions = el("div", "row-actions");
      function act(label, status, cls) {
        var b = el("button", "btn btn-sm " + cls, label);
        b.addEventListener("click", function () { S.setOrderStatus(o.id, status); renderOrders(); });
        actions.appendChild(b);
      }
      if (o.status === "new") { act("Confirm", "confirmed", "btn-ghost"); }
      if (o.status === "confirmed") { act("Mark fulfilled", "fulfilled", "btn-hl"); }
      if (o.status !== "fulfilled" && o.status !== "cancelled") { act("Cancel", "cancelled", "btn-ghost"); }
      if (o.status === "cancelled" || o.status === "fulfilled") {
        actions.appendChild(el("span", "hint", "—"));
      }
      tr.innerHTML =
        "<td><strong>" + esc(o.ref) + "</strong><br><span class='hint'>" + when(o.ts) + "</span></td>" +
        "<td>" + esc(o.customer.name) + "<br><span class='hint'>" + esc(o.customer.contact) + "</span></td>" +
        "<td>" + items + "</td>" +
        "<td class='num'><strong>" + S.fmt(o.totalCents) + "</strong><br><span class='hint'>" + esc(o.method) + "</span></td>" +
        "<td><span class='status-chip st-" + o.status + "'>" + o.status + "</span></td>" +
        "<td></td>";
      var noteCell = el("div", "fieldline");
      noteCell.style.minWidth = "150px";
      noteCell.innerHTML = "<span class='lab'>Note</span>";
      var noteInput = el("input", "admin-input");
      noteInput.value = o.note || "";
      noteInput.placeholder = "internal note…";
      noteInput.addEventListener("change", function () { S.setOrderNote(o.id, noteInput.value); });
      noteCell.appendChild(noteInput);
      var actionsWrap = el("div");
      actionsWrap.appendChild(actions);
      actionsWrap.appendChild(noteCell);
      tr.lastElementChild.appendChild(actionsWrap);
      box.appendChild(tr);
    });
  }

  // ---------- enquiries ----------
  function renderEnquiries() {
    var box = $("#enquiryList");
    box.innerHTML = "";
    var filter = $("#enqFilter").getAttribute("data-filter") || "all";
    var list = S.state.enquiries.filter(function (e) { return filter === "all" || e.type === filter; });
    $("#enqCount").textContent = S.state.enquiries.length;
    var fresh = S.state.enquiries.filter(function (e) { return !e.handled; }).length;
    $("#enqOpen").textContent = fresh + " open";
    if (!list.length) {
      box.appendChild(el("p", "empty-note", "No enquiries here yet. Submit a booking or investor form on the storefront to see it appear."));
      return;
    }
    list.forEach(function (e) {
      var d = e.data || {};
      var card = el("div", "panel-card");
      var head = el("div", null);
      head.style.cssText = "display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap";
      head.innerHTML =
        "<span class='type-chip ty-" + e.type + "'>" + e.type + "</span>" +
        "<strong>" + esc(e.ref) + "</strong>" +
        "<span class='hint'>" + when(e.ts) + "</span>" +
        (e.handled ? "<span class='status-chip st-fulfilled'>handled</span>" : "<span class='status-chip st-new'>open</span>");
      card.appendChild(head);
      var body = el("div", "mt");
      var rows = [];
      if (e.type === "booking") {
        rows = [
          ["Contact", (d.name || "") + (d.org ? " (" + d.org + ")" : "")],
          ["Email / phone", (d.email || "") + " / " + (d.phone || "—")],
          ["Event", (d.eventType || "") + " on " + (d.date || "?")],
          ["Venue", (d.venue || "—") + (d.area ? ", " + d.area : "")],
          ["Budget", d.budget || "—"],
          ["Notes", d.notes || "—"]
        ];
      } else {
        rows = [
          ["Company", d.company || "—"],
          ["Contact", (d.name || "") + " · " + (d.email || "")],
          ["Interest", d.interest || "—"],
          ["Message", d.message || "—"]
        ];
      }
      body.innerHTML = "<table class='tbl'>" + rows.map(function (r) {
        return "<tr><td style='width:130px' class='hint'>" + r[0] + "</td><td>" + esc(r[1]) + "</td></tr>";
      }).join("") + "</table>";
      card.appendChild(body);
      var actions = el("div", "row-actions mt");
      var b = el("button", "btn btn-sm " + (e.handled ? "btn-ghost" : "btn-hl"),
        e.handled ? "Reopen" : "Mark handled");
      b.addEventListener("click", function () { S.setEnquiryHandled(e.id, !e.handled); renderEnquiries(); });
      actions.appendChild(b);
      card.appendChild(actions);
      box.appendChild(card);
    });
  }

  // ---------- CRM ----------
  var crmTerm = "";
  var crmSelected = null;
  function renderCRM() {
    var box = $("#crmBody");
    if (!box) return;
    box.innerHTML = "";
    var contacts = S.state.contacts.filter(function (c) {
      if (!crmTerm) return true;
      var t = crmTerm.toLowerCase();
      return (c.name + " " + c.email + " " + c.phone + " " + c.tags).toLowerCase().indexOf(t) > -1;
    });
    $("#crmCount").textContent = S.state.contacts.length;
    var members = S.state.contacts.filter(function (c) { return c.status === "member"; }).length;
    $("#crmMembers").textContent = members + " members";
    if (!contacts.length) {
      box.appendChild(el("tr", null, '<td colspan="6" class="empty-note">No contacts yet. Orders, enquiries and community signups all land here automatically.</td>'));
      return;
    }
    contacts.forEach(function (c) {
      var tr = el("tr", "crm-row");
      tr.style.cursor = "pointer";
      tr.setAttribute("data-id", c.id);
      tr.innerHTML =
        "<td><strong>" + esc(c.name) + "</strong></td>" +
        "<td>" + esc(c.email || "—") + "<br><span class='hint'>" + esc(c.phone || "") + "</span></td>" +
        "<td><span class='status-chip st-crm-" + c.status + "'>" + c.status + "</span></td>" +
        "<td class='num'>" + c.events.length + "</td>" +
        "<td><span class='hint'>" + when(c.lastTs) + "</span></td>" +
        "<td>" + esc(c.tags || "—") + "</td>";
      tr.addEventListener("click", function () { crmSelected = c.id; renderCRM(); });
      box.appendChild(tr);
    });
    renderCRMDetail();
  }
  function renderCRMDetail() {
    var box = $("#crmDetail");
    if (!box) return;
    box.innerHTML = "";
    if (!crmSelected) {
      box.appendChild(el("p", "empty-note", "Select a contact to see their timeline and notes."));
      return;
    }
    var c = S.state.contacts.filter(function (x) { return x.id === crmSelected; })[0];
    if (!c) { crmSelected = null; box.appendChild(el("p", "empty-note", "Contact removed.")); return; }

    var head = el("div", "panel-card");
    head.innerHTML = "<h3>" + esc(c.name) + "</h3>" +
      "<p class='hint'>" + esc(c.email || "") + (c.phone ? " · " + esc(c.phone) : "") + " · first seen " + when(c.firstTs) + "</p>";
    var statusRow = el("div", "row-actions mt");
    ["new", "contacted", "member", "partner"].forEach(function (st) {
      var b = el("button", "btn btn-sm " + (c.status === st ? "btn-hl" : "btn-ghost"), st);
      b.addEventListener("click", function () { S.setContactStatus(c.id, st); renderCRM(); });
      statusRow.appendChild(b);
    });
    head.appendChild(statusRow);
    var tagLine = el("div", "fieldline mt");
    tagLine.innerHTML = "<span class='lab'>Tags (free text)</span>";
    var tagInput = el("input", "admin-input");
    tagInput.value = c.tags || "";
    tagInput.placeholder = "e.g. promoter, whale, family";
    tagInput.addEventListener("change", function () { S.setContactTags(c.id, tagInput.value); renderCRM(); });
    tagLine.appendChild(tagInput);
    head.appendChild(tagLine);
    box.appendChild(head);

    var tl = el("div", "panel-card");
    tl.innerHTML = "<h3>Timeline</h3>";
    if (!c.events.length) {
      tl.appendChild(el("p", "empty-note", "No events yet."));
    } else {
      c.events.forEach(function (ev) {
        var row = el("div", "crm-event");
        row.innerHTML = "<span class='type-chip ty-" + esc(ev.type) + "'>" + esc(ev.type) + "</span> " +
          "<strong>" + esc(ev.ref || "") + "</strong> <span class='hint'>" + when(ev.ts) + "</span>" +
          "<br><span class='hint'>" + esc(ev.summary || "") + "</span>";
        tl.appendChild(row);
      });
    }
    box.appendChild(tl);

    var notes = el("div", "panel-card");
    notes.innerHTML = "<h3>Notes</h3>";
    var addLine = el("div", "fieldline");
    addLine.innerHTML = "<span class='lab'>Add note</span>";
    var noteInput = el("input", "admin-input");
    noteInput.placeholder = "met at Soshanguve party, wants collab…";
    var addBtn = el("button", "btn btn-hl btn-sm", "Add");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () {
      if (S.addContactNote(c.id, noteInput.value)) { noteInput.value = ""; renderCRM(); }
    });
    addLine.appendChild(noteInput);
    addLine.appendChild(addBtn);
    addLine.style.display = "grid";
    addLine.style.gap = "0.4rem";
    notes.appendChild(addLine);
    if (!c.notes.length) {
      notes.appendChild(el("p", "empty-note", "No notes yet."));
    } else {
      c.notes.forEach(function (n) {
        notes.appendChild(el("div", "crm-event", "<span class='hint'>" + when(n.ts) + "</span><br>" + esc(n.text)));
      });
    }
    box.appendChild(notes);
  }
  function wireCRM() {
    var search = $("#crmSearch");
    if (search) search.addEventListener("input", function () { crmTerm = search.value.trim(); renderCRM(); });
  }

  // ---------- community ----------
  function renderCommunity() {
    var box = $("#communityBody");
    if (!box) return;
    box.innerHTML = "";
    var members = S.state.community;
    $("#famCount").textContent = members.length;
    var subs = members.filter(function (m) { return m.newsletter; }).length;
    $("#famSubs").textContent = subs + " newsletter " + (subs === 1 ? "subscriber" : "subscribers");
    if (!members.length) {
      box.appendChild(el("tr", null, '<td colspan="5" class="empty-note">No family members yet. Signups from the community page land here.</td>'));
      return;
    }
    members.forEach(function (m) {
      var tr = el("tr");
      tr.innerHTML =
        "<td><strong>" + esc(m.name) + "</strong><br><span class='hint'>" + esc(m.id) + "</span></td>" +
        "<td>" + esc(m.email) + (m.phone ? "<br><span class='hint'>" + esc(m.phone) + "</span>" : "") + "</td>" +
        "<td>" + esc((m.interests || []).join(", ") || "—") + "</td>" +
        "<td>" + (m.newsletter ? "<span class='status-chip st-new'>subscribed</span>" : "<span class='hint'>no</span>") + "</td>" +
        "<td><span class='hint'>" + when(m.ts) + "</span></td>";
      box.appendChild(tr);
    });
  }

  // ---------- catalogue ----------
  function renderCatalogue() {
    var box = $("#catList");
    box.innerHTML = "";
    S.state.catalogue.forEach(function (p) {
      var row = el("div", "panel-card");
      var grid = el("div", "edit-grid c4");
      grid.innerHTML =
        "<div class='fieldline'><span class='lab'>Item</span><input class='admin-input' data-f='name' data-id='" + p.id + "' value='" + esc(p.name) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Price (R)</span><input class='admin-input' data-f='price' data-id='" + p.id + "' type='number' step='0.01' min='0' value='" + (p.priceCents / 100).toFixed(2) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Live on store</span><label class='check-line'><input type='checkbox' data-f='active' data-id='" + p.id + "'" + (p.active ? " checked" : "") + "> Active</label></div>" +
        "<div class='fieldline'><span class='lab'>Availability</span><label class='check-line'><input type='checkbox' data-f='stock' data-id='" + p.id + "'" + (p.stock ? " checked" : "") + "> In stock</label></div>" +
        "<div class='fieldline'><span class='lab'>Sizes (comma separated)</span><input class='admin-input' data-f='sizes' data-id='" + p.id + "' value='" + esc((p.sizes || []).join(", ")) + "' placeholder='S, M, L, XL'></div>" +
        "<div class='fieldline'><span class='lab'>Members only</span><label class='check-line'><input type='checkbox' data-f='exclusive' data-id='" + p.id + "'" + (p.exclusive ? " checked" : "") + "> Exclusive (family unlock)</label></div>" +
        "<div class='fieldline'><span class='lab'>Image</span><span class='hint'>Upload replaces the mockup (stored in this browser).</span></div>";
      var imgLine = grid.lastElementChild;
      var upBtn = uploadButton("Upload image", function (uri) {
        var ok = S.setImage(p, "img", uri, p.img);
        if (!ok) alert("Browser storage is full — image not saved. Export data or remove other uploads first.");
        storageBanner();
        renderCatalogue();
      });
      imgLine.appendChild(upBtn);
      row.appendChild(grid);
      row.appendChild(el("p", "hint mt", "Demo prices are placeholders until the client confirms real stock."));
      box.appendChild(row);
    });
    $$("input[data-f]", box).forEach(function (inp) {
      inp.addEventListener("change", function () {
        var id = inp.getAttribute("data-id"), f = inp.getAttribute("data-f");
        var p = S.state.catalogue.find(function (x) { return x.id === id; });
        if (!p) return;
        if (f === "name") p.name = inp.value.trim() || p.name;
        if (f === "price") p.priceCents = Math.max(0, Math.round(parseFloat(inp.value || "0") * 100));
        if (f === "active") p.active = inp.checked;
        if (f === "stock") p.stock = inp.checked;
        if (f === "exclusive") p.exclusive = inp.checked;
        if (f === "sizes") p.sizes = inp.value.split(",").map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean).slice(0, 8);
        S.save(); storageBanner();
        if (f === "sizes") renderCatalogue();
      });
    });
  }

  // ---------- gigs ----------
  function renderGigs() {
    var box = $("#gigList");
    box.innerHTML = "";
    S.state.gigs.forEach(function (g) {
      var row = el("div", "panel-card");
      row.innerHTML =
        "<div class='edit-grid c4'>" +
        "<div class='fieldline'><span class='lab'>Title</span><input class='admin-input' data-f='title' data-id='" + g.id + "' value='" + esc(g.title) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Date</span><input class='admin-input' type='date' data-f='dateISO' data-id='" + g.id + "' value='" + g.dateISO + "'></div>" +
        "<div class='fieldline'><span class='lab'>Time</span><input class='admin-input' data-f='time' data-id='" + g.id + "' value='" + esc(g.time || "") + "'></div>" +
        "<div class='fieldline'><span class='lab'>Visible</span><label class='check-line'><input type='checkbox' data-f='visible' data-id='" + g.id + "'" + (g.visible ? " checked" : "") + "> Show on site</label></div>" +
        "<div class='fieldline'><span class='lab'>Venue</span><input class='admin-input' data-f='venue' data-id='" + g.id + "' value='" + esc(g.venue || "") + "'></div>" +
        "<div class='fieldline'><span class='lab'>Area</span><input class='admin-input' data-f='area' data-id='" + g.id + "' value='" + esc(g.area || "") + "'></div>" +
        "<div class='fieldline'><span class='lab'>Ticket link (blank = TBC)</span><input class='admin-input' data-f='ticketUrl' data-id='" + g.id + "' value='" + esc(g.ticketUrl || "") + "' placeholder='https://…'></div>" +
        "</div>";
      box.appendChild(row);
    });
    $$("input[data-f]", box).forEach(function (inp) {
      var handler = function () {
        var id = inp.getAttribute("data-id"), f = inp.getAttribute("data-f");
        var g = S.state.gigs.find(function (x) { return x.id === id; });
        if (!g) return;
        if (f === "visible") g.visible = inp.checked;
        else g[f] = inp.value.trim();
        S.save(); storageBanner();
      };
      inp.addEventListener("change", handler);
      if (inp.type === "text" || inp.type === "url") inp.addEventListener("blur", handler);
    });
  }
  function wireAddGig() {
    $("#addGig").addEventListener("click", function () {
      var n = S.state.gigs.length + 1;
      S.state.gigs.push({
        id: "g" + Date.now().toString(36),
        title: "New event " + n,
        dateISO: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
        time: "19:00", venue: "Venue TBC", area: "Pretoria north",
        ticketUrl: "", visible: false
      });
      S.save();
      renderGigs();
    });
  }

  // ---------- members ----------
  function renderMembers() {
    var box = $("#memberList");
    if (!box) return;
    box.innerHTML = "";
    S.state.members.forEach(function (m) {
      var row = el("div", "panel-card");
      var grid = el("div", "edit-grid c4");
      grid.innerHTML =
        "<div class='fieldline'><span class='lab'>Name</span><input class='admin-input' data-f='name' data-id='" + m.id + "' value='" + esc(m.name) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Executive title</span><input class='admin-input' data-f='title' data-id='" + m.id + "' value='" + esc(m.title || "") + "'></div>" +
        "<div class='fieldline'><span class='lab'>Role line</span><input class='admin-input' data-f='role' data-id='" + m.id + "' value='" + esc(m.role || "") + "'></div>" +
        "<div class='fieldline'><span class='lab'>Instagram (without @)</span><input class='admin-input' data-f='handle' data-id='" + m.id + "' value='" + esc(m.handle || "") + "'></div>" +
        "<div class='fieldline'><span class='lab'>Monogram</span><input class='admin-input' data-f='monogram' data-id='" + m.id + "' value='" + esc(m.monogram || "") + "' maxlength='3'></div>" +
        "<div class='fieldline'><span class='lab'>Card №</span><input class='admin-input' data-f='cardNo' data-id='" + m.id + "' value='" + esc(m.cardNo || "") + "' maxlength='4'></div>";
      row.appendChild(grid);
      var photoLine = el("div", "fieldline mt");
      var preview = el("img", "member-preview");
      preview.src = m.photo ? imgSrc(m.photo) : "";
      preview.alt = esc(m.name) + " photo preview";
      photoLine.appendChild(el("span", "lab", "Photo"));
      photoLine.appendChild(preview);
      var btns = el("div", "row-actions");
      btns.appendChild(uploadButton("Upload photo", function (uri) {
        var ok = S.setImage(m, "photo", uri, m.photo);
        if (!ok) alert("Browser storage is full — photo not saved.");
        storageBanner();
        renderMembers();
      }));
      if (m.photo) {
        var rm = el("button", "btn btn-ghost btn-sm", "Remove photo");
        rm.type = "button";
        rm.addEventListener("click", function () { m.photo = ""; S.save(); renderMembers(); });
        btns.appendChild(rm);
      }
      photoLine.appendChild(btns);
      row.appendChild(photoLine);
      box.appendChild(row);
    });
    $$("input[data-f]", box).forEach(function (inp) {
      var handler = function () {
        var id = inp.getAttribute("data-id"), f = inp.getAttribute("data-f");
        var m = S.state.members.find(function (x) { return x.id === id; });
        if (!m) return;
        if (f === "handle") m.handle = inp.value.trim().replace(/^@/, "");
        else m[f] = inp.value.trim();
        S.save(); storageBanner();
      };
      inp.addEventListener("change", handler);
      inp.addEventListener("blur", handler);
    });
  }

  // ---------- links ----------
  function renderLinks() {
    var rows = $("#igRows");
    rows.innerHTML = "";
    S.state.igAccounts.forEach(function (acc) {
      var row = el("div", "panel-card");
      row.innerHTML =
        "<div class='edit-grid c3'>" +
        "<div class='fieldline'><span class='lab'>Label</span><input class='admin-input' data-f='label' data-id='" + acc.id + "' value='" + esc(acc.label) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Handle (without @)</span><input class='admin-input' data-f='handle' data-id='" + acc.id + "' value='" + esc(acc.handle) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Status</span><label class='check-line'><input type='checkbox' data-f='confirmed' data-id='" + acc.id + "'" + (acc.confirmed ? " checked" : "") + "> Confirmed — makes the follow button live</label></div>" +
        "</div><p class='hint mt'>Unconfirmed handles never link out (a wrong handle can point at a stranger's account).</p>";
      rows.appendChild(row);
    });
    $$("input[data-f]", rows).forEach(function (inp) {
      var handler = function () {
        var id = inp.getAttribute("data-id"), f = inp.getAttribute("data-f");
        var acc = S.state.igAccounts.find(function (x) { return x.id === id; });
        if (!acc) return;
        if (f === "confirmed") acc.confirmed = inp.checked;
        else acc[f] = inp.value.trim().replace(/^@/, "");
        S.save(); storageBanner();
        if (f !== "confirmed") renderLinks();
      };
      inp.addEventListener("change", handler);
      inp.addEventListener("blur", handler);
    });
    $("#linkEmail").value = S.state.content.contactEmail;
    $("#linkPhone").value = S.state.content.contactPhone;
  }
  function wireLinksStatic() {
    $("#linkEmail").addEventListener("change", function () { S.state.content.contactEmail = this.value.trim(); S.save(); storageBanner(); });
    $("#linkPhone").addEventListener("change", function () { S.state.content.contactPhone = this.value.trim(); S.save(); storageBanner(); });
    $("#addIg").addEventListener("click", function () {
      S.state.igAccounts.push({ id: "ig-" + Date.now().toString(36), label: "New account", handle: "handle", confirmed: false });
      S.save(); renderLinks();
    });
  }

  // ---------- content (+ gallery manager) ----------
  function renderContent() {
    $("#ctSub").value = S.state.content.heroSub;
    $("#ctTicker").value = (S.state.content.ticker || []).join("\n");
    var box = $("#sponsorRows");
    box.innerHTML = "";
    S.state.sponsors.forEach(function (sp) {
      var row = el("div", "panel-card");
      row.innerHTML =
        "<div class='edit-grid c4'>" +
        "<div class='fieldline'><span class='lab'>Name</span><input class='admin-input' data-f='name' data-id='" + sp.id + "' value='" + esc(sp.name) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Tier</span><select class='admin-input' data-f='tier' data-id='" + sp.id + "'>" +
        ["Title", "Stage", "Block"].map(function (t) { return "<option" + (sp.tier === t ? " selected" : "") + ">" + t + "</option>"; }).join("") +
        "</select></div>" +
        "<div class='fieldline'><span class='lab'>Link (optional)</span><input class='admin-input' data-f='url' data-id='" + sp.id + "' value='" + esc(sp.url || "") + "' placeholder='https://…'></div>" +
        "<div class='fieldline'><span class='lab'>Status</span><label class='check-line'><input type='checkbox' data-f='active' data-id='" + sp.id + "'" + (sp.active ? " checked" : "") + "> Show slot</label>" +
        " <label class='check-line'><input type='checkbox' data-f='placeholder' data-id='" + sp.id + "'" + (sp.placeholder ? " checked" : "") + "> Still a placeholder</label></div>" +
        "</div>";
      box.appendChild(row);
    });
    $$("input[data-f], select[data-f]", box).forEach(function (inp) {
      var handler = function () {
        var id = inp.getAttribute("data-id"), f = inp.getAttribute("data-f");
        var sp = S.state.sponsors.find(function (x) { return x.id === id; });
        if (!sp) return;
        if (f === "active") sp.active = inp.checked;
        else if (f === "placeholder") sp.placeholder = inp.checked;
        else sp[f] = inp.value.trim();
        S.save(); storageBanner();
      };
      inp.addEventListener("change", handler);
      if (inp.tagName === "INPUT" && inp.type === "text") inp.addEventListener("blur", handler);
    });
    renderGalleryMgr();
  }
  function renderGalleryMgr() {
    var box = $("#galleryMgr");
    if (!box) return;
    box.innerHTML = "";
    S.state.photos.forEach(function (p, i) {
      var cell = el("div", "pm-cell");
      var img = el("img", "pm-thumb");
      img.src = imgSrc(p);
      img.alt = "gallery photo " + (i + 1);
      cell.appendChild(img);
      var ctl = el("div", "pm-ctl");
      var up = el("button", "pm-btn", "↑"); up.title = "Move earlier"; up.type = "button";
      var down = el("button", "pm-btn", "↓"); down.title = "Move later"; down.type = "button";
      var del = el("button", "pm-btn pm-del", "✕"); del.title = "Remove"; del.type = "button";
      up.addEventListener("click", function () { S.movePhoto(i, -1); renderGalleryMgr(); });
      down.addEventListener("click", function () { S.movePhoto(i, 1); renderGalleryMgr(); });
      del.addEventListener("click", function () {
        if (confirm("Remove photo " + (i + 1) + " from the gallery?")) { S.removePhoto(i); renderGalleryMgr(); }
      });
      ctl.appendChild(up); ctl.appendChild(down); ctl.appendChild(del);
      cell.appendChild(ctl);
      box.appendChild(cell);
    });
  }
  function wireContentStatic() {
    $("#ctSub").addEventListener("change", function () { S.state.content.heroSub = this.value.trim(); S.save(); storageBanner(); });
    $("#ctTicker").addEventListener("change", function () {
      S.state.content.ticker = this.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      S.save(); storageBanner();
    });
    $("#addSponsor").addEventListener("click", function () {
      S.state.sponsors.push({ id: "s" + Date.now().toString(36), name: "New partner", tier: "Block", url: "", active: true, placeholder: false });
      S.save(); renderContent();
    });
    var multi = $("#galleryUpload");
    if (multi) {
      multi.addEventListener("change", function () {
        var files = Array.prototype.slice.call(this.files);
        if (!files.length) return;
        var done = 0;
        files.forEach(function (f) {
          compressImage(f, 900, 0.82, function (uri) {
            S.state.photos.push(uri);
            S.save();
            done++;
            if (done === files.length) {
              storageBanner();
              if (window.TNM.storageError) alert("Some photos were not saved — browser storage is full. Export data or remove uploads.");
              renderGalleryMgr();
              multi.value = "";
            }
          });
        });
      });
    }
  }

  // ---------- data ----------
  function wireData() {
    $("#exportBtn").addEventListener("click", function () {
      var blob = new Blob([S.exportJSON()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tnm-data-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#importFile").addEventListener("change", function () {
      var f = this.files[0];
      if (!f) return;
      var reader = new FileReader();
      var self = this;
      reader.onload = function () {
        try {
          S.importJSON(reader.result);
          alert("Imported. Data replaced with the file's contents.");
          renderAll();
        } catch (err) {
          alert("Import failed: " + err.message);
        }
        self.value = "";
      };
      reader.readAsText(f);
    });
    $("#resetBtn").addEventListener("click", function () {
      if (confirm("Reset ALL demo data (orders, enquiries, community, CRM, edits) back to the seed?")) {
        S.resetSeed();
        renderAll();
      }
    });
  }

  function renderAll() {
    renderOrders(); renderEnquiries(); renderCRM(); renderCommunity(); renderCatalogue();
    renderGigs(); renderMembers(); renderLinks(); renderContent();
    storageBanner();
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireTabs(); wireAddGig(); wireLinksStatic(); wireContentStatic(); wireData(); wireCRM();
    $$(".enq-filter").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".enq-filter").forEach(function (x) { x.classList.remove("active"); x.classList.add("btn-ghost"); x.classList.remove("btn-hl"); });
        b.classList.add("active"); b.classList.add("btn-hl"); b.classList.remove("btn-ghost");
        $("#enqFilter").setAttribute("data-filter", b.getAttribute("data-filter"));
        renderEnquiries();
      });
    });
    renderAll();
  });
})();
