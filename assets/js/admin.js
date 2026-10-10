// THE NORTH MOB — admin (DEMO). Everything edits TNM.store.state and saves to
// this browser's localStorage. The storefront reads the same state.
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
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function when(iso) {
    var d = new Date(iso);
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + ", " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
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
        return "<li>" + esc(i.name) + " × " + i.qty + " — " + S.fmt(i.priceCents * i.qty) + "</li>";
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
      tr.lastElementChild.appendChild(actions);
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
      head.style.display = "flex";
      head.style.gap = "0.6rem";
      head.style.alignItems = "center";
      head.style.flexWrap = "wrap";
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

  // ---------- catalogue ----------
  function renderCatalogue() {
    var box = $("#catList");
    box.innerHTML = "";
    S.state.catalogue.forEach(function (p) {
      var row = el("div", "panel-card");
      row.innerHTML =
        "<div class='edit-grid c4'>" +
        "<div class='fieldline'><span class='lab'>Item</span><input class='admin-input' data-f='name' data-id='" + p.id + "' value='" + esc(p.name) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Price (R)</span><input class='admin-input' data-f='price' data-id='" + p.id + "' type='number' step='0.01' min='0' value='" + (p.priceCents / 100).toFixed(2) + "'></div>" +
        "<div class='fieldline'><span class='lab'>Live on store</span><label class='check-line'><input type='checkbox' data-f='active' data-id='" + p.id + "'" + (p.active ? " checked" : "") + "> Active</label></div>" +
        "<div class='fieldline'><span class='lab'>Availability</span><label class='check-line'><input type='checkbox' data-f='stock' data-id='" + p.id + "'" + (p.stock ? " checked" : "") + "> In stock</label></div>" +
        "</div><p class='hint mt'>Demo prices are placeholders until the client confirms real stock.</p>";
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
        S.save();
        renderCatalogue();
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
        S.save();
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
        title: "New gig " + n,
        dateISO: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
        time: "19:00", venue: "Venue TBC", area: "Pretoria north",
        ticketUrl: "", visible: false
      });
      S.save();
      renderGigs();
    });
  }

  // ---------- links ----------
  function renderLinks() {
    var box = "#igRows";
    var rows = $(box);
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
        S.save();
        if (f !== "confirmed") renderLinks();
      };
      inp.addEventListener("change", handler);
      inp.addEventListener("blur", handler);
    });
    $("#linkEmail").value = S.state.content.contactEmail;
    $("#linkPhone").value = S.state.content.contactPhone;
  }
  function wireLinksStatic() {
    $("#linkEmail").addEventListener("change", function () { S.state.content.contactEmail = this.value.trim(); S.save(); });
    $("#linkPhone").addEventListener("change", function () { S.state.content.contactPhone = this.value.trim(); S.save(); });
    $("#addIg").addEventListener("click", function () {
      S.state.igAccounts.push({ id: "ig-" + Date.now().toString(36), label: "New account", handle: "handle", confirmed: false });
      S.save(); renderLinks();
    });
  }

  // ---------- content ----------
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
        S.save();
      };
      inp.addEventListener("change", handler);
      if (inp.tagName === "INPUT" && inp.type === "text") inp.addEventListener("blur", handler);
    });
  }
  function wireContentStatic() {
    $("#ctSub").addEventListener("change", function () { S.state.content.heroSub = this.value.trim(); S.save(); });
    $("#ctTicker").addEventListener("change", function () {
      S.state.content.ticker = this.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      S.save();
    });
    $("#addSponsor").addEventListener("click", function () {
      S.state.sponsors.push({ id: "s" + Date.now().toString(36), name: "New partner", tier: "Block", url: "", active: true, placeholder: false });
      S.save(); renderContent();
    });
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
      if (confirm("Reset ALL demo data (orders, enquiries, edits) back to the seed?")) {
        S.resetSeed();
        renderAll();
      }
    });
  }

  function renderAll() {
    renderOrders(); renderEnquiries(); renderCatalogue(); renderGigs(); renderLinks(); renderContent();
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireTabs(); wireAddGig(); wireLinksStatic(); wireContentStatic(); wireData();
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
