// THE NORTHMOB — store engine v2.
// Money is integer cents everywhere. State lives in localStorage (demo-grade,
// no backend). Checkout is simulated and idempotent-guarded against double submits.
// v6 adds: sized cart lines, community membership, CRM contacts with timelines,
// image uploads stored as compressed data URIs (quota-guarded).
(function () {
  "use strict";
  var KEY = "tnm.v1";
  var SEED = window.TNM.SEED;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaults() {
    var s = clone(SEED);
    s.cart = [];
    s.orders = [];
    s.enquiries = [];
    s.community = [];     // family signups
    s.membership = null;  // this browser's joined state
    s.contacts = [];      // CRM
    return s;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      if (!s || s.version !== SEED.version) return defaults();
      if (!Array.isArray(s.cart)) s.cart = [];
      if (!Array.isArray(s.orders)) s.orders = [];
      if (!Array.isArray(s.enquiries)) s.enquiries = [];
      if (!Array.isArray(s.community)) s.community = [];
      if (!Array.isArray(s.contacts)) s.contacts = [];
      if (!s.membership) s.membership = null;
      return s;
    } catch (e) {
      return defaults();
    }
  }

  var state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      window.TNM.storageError = null;
    } catch (e) {
      // Storage full or blocked — demo keeps working in-memory; admin shows a warning.
      window.TNM.storageError = String(e);
    }
  }
  save();

  // ---- money ----
  function fmt(cents) {
    var v = (Math.round(cents) / 100).toFixed(2).split(".");
    var r = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return "R" + r + "." + v[1];
  }

  // ---- catalogue ----
  function findProduct(id) {
    for (var i = 0; i < state.catalogue.length; i++) if (state.catalogue[i].id === id) return state.catalogue[i];
    return null;
  }

  // ---- cart (lines are keyed by product id + size) ----
  function lineKey(id, size) { return id + "|" + (size || ""); }
  function addToCart(id, size) {
    var p = findProduct(id);
    if (!p || !p.active || !p.stock) return false;
    if (p.sizes && p.sizes.length && !size) return false;
    if (p.exclusive && !(state.membership && state.membership.joined)) return false;
    var key = lineKey(id, size);
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].key === key) { state.cart[i].qty++; save(); return true; }
    }
    state.cart.push({ key: key, id: id, size: size || "", qty: 1 });
    save();
    return true;
  }
  function setQty(key, qty) {
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].key === key) {
        state.cart[i].qty = Math.max(0, Math.min(99, qty));
        if (state.cart[i].qty === 0) state.cart.splice(i, 1);
        break;
      }
    }
    save();
  }
  function removeFromCart(key) {
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].key === key) { state.cart.splice(i, 1); break; }
    }
    save();
  }
  function cartCount() {
    var n = 0;
    for (var i = 0; i < state.cart.length; i++) n += state.cart[i].qty;
    return n;
  }
  function cartLines() {
    var out = [];
    for (var i = 0; i < state.cart.length; i++) {
      var p = findProduct(state.cart[i].id);
      if (!p) continue;
      out.push({
        key: state.cart[i].key, id: p.id, size: state.cart[i].size,
        name: p.name, priceCents: p.priceCents, qty: state.cart[i].qty, img: p.img
      });
    }
    return out;
  }
  function cartTotal() {
    var t = 0, ls = cartLines();
    for (var i = 0; i < ls.length; i++) t += ls[i].priceCents * ls[i].qty;
    return t;
  }

  // ---- CRM contacts ----
  function contactKey(identity) {
    if (identity.email) return "e:" + identity.email.trim().toLowerCase();
    if (identity.phone) return "p:" + identity.phone.trim().replace(/\s+/g, "");
    return "n:" + (identity.name || "").trim().toLowerCase();
  }
  function findContact(key) {
    for (var i = 0; i < state.contacts.length; i++) if (state.contacts[i].ckey === key) return state.contacts[i];
    return null;
  }
  function upsertContact(identity, event) {
    var key = contactKey(identity);
    var c = findContact(key);
    var now = new Date().toISOString();
    if (!c) {
      c = {
        id: "C" + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 1296).toString(36),
        ckey: key,
        name: identity.name || "—",
        email: identity.email || "",
        phone: identity.phone || "",
        status: "new", tags: "",
        notes: [], events: [], firstTs: now, lastTs: now
      };
      state.contacts.push(c);
    }
    if (identity.name && identity.name !== "—") c.name = identity.name;
    if (identity.email && !c.email) c.email = identity.email;
    if (identity.phone && !c.phone) c.phone = identity.phone;
    if (event) {
      c.events.unshift({ ts: now, type: event.type, ref: event.ref || "", summary: event.summary || "" });
      c.lastTs = now;
    }
    save();
    return c;
  }
  function setContactStatus(id, status) {
    var allowed = ["new", "contacted", "member", "partner"];
    if (allowed.indexOf(status) === -1) return false;
    for (var i = 0; i < state.contacts.length; i++) {
      if (state.contacts[i].id === id) { state.contacts[i].status = status; save(); return true; }
    }
    return false;
  }
  function setContactTags(id, tags) {
    for (var i = 0; i < state.contacts.length; i++) {
      if (state.contacts[i].id === id) { state.contacts[i].tags = String(tags || "").slice(0, 120); save(); return true; }
    }
    return false;
  }
  function addContactNote(id, text) {
    text = String(text || "").trim();
    if (!text) return false;
    for (var i = 0; i < state.contacts.length; i++) {
      if (state.contacts[i].id === id) {
        state.contacts[i].notes.unshift({ ts: new Date().toISOString(), text: text.slice(0, 500) });
        save(); return true;
      }
    }
    return false;
  }

  // ---- orders ----
  var placing = false; // idempotency guard: a second call during a submit returns null
  function placeOrder(customer, method) {
    if (placing) return null;
    if (!state.cart.length) return null;
    placing = true;
    try {
      var items = cartLines().map(function (l) {
        return { id: l.id, size: l.size, name: l.name, priceCents: l.priceCents, qty: l.qty };
      });
      var totalCents = 0;
      for (var i = 0; i < items.length; i++) totalCents += items[i].priceCents * items[i].qty;
      var ref = "NM-" + Date.now().toString(36).toUpperCase().slice(-4) +
                Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0");
      var order = {
        id: ref, ref: ref,
        ts: new Date().toISOString(),
        items: items,
        totalCents: totalCents,
        status: "new", // new → confirmed → fulfilled | cancelled
        note: "",
        customer: { name: customer.name, contact: customer.contact },
        method: method,
        demo: true
      };
      state.orders.unshift(order);
      state.cart = [];
      save();
      upsertContact(
        { name: customer.name, email: customer.contact.indexOf("@") > -1 ? customer.contact : "", phone: customer.contact.indexOf("@") > -1 ? "" : customer.contact },
        { type: "order", ref: ref, summary: fmt(totalCents) + " — " + items.map(function (it) { return it.name + (it.size ? " (" + it.size + ")" : "") + " ×" + it.qty; }).join(", ") }
      );
      return order;
    } finally {
      placing = false;
    }
  }
  function setOrderStatus(id, status) {
    var flow = ["new", "confirmed", "fulfilled", "cancelled"];
    if (flow.indexOf(status) === -1) return false;
    for (var i = 0; i < state.orders.length; i++) {
      if (state.orders[i].id === id) { state.orders[i].status = status; save(); return true; }
    }
    return false;
  }
  function setOrderNote(id, note) {
    for (var i = 0; i < state.orders.length; i++) {
      if (state.orders[i].id === id) { state.orders[i].note = String(note || "").slice(0, 500); save(); return true; }
    }
    return false;
  }

  // ---- enquiries (bookings / sponsorship / investment) ----
  function addEnquiry(type, data) {
    var prefix = { booking: "BK", sponsorship: "SP", investment: "IN" }[type] || "EN";
    var ref = prefix + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    var e = { id: ref, ref: ref, type: type, ts: new Date().toISOString(), handled: false, data: data };
    state.enquiries.unshift(e);
    save();
    upsertContact(
      { name: data.name || data.company || "—", email: data.email || "", phone: data.phone || "" },
      { type: type, ref: ref, summary: (data.eventType || data.interest || type) + (data.date ? " — " + data.date : "") + (data.company ? " — " + data.company : "") }
    );
    return e;
  }
  function setEnquiryHandled(id, handled) {
    for (var i = 0; i < state.enquiries.length; i++) {
      if (state.enquiries[i].id === id) { state.enquiries[i].handled = !!handled; save(); return true; }
    }
    return false;
  }

  // ---- community (join the family) ----
  function joinCommunity(data) {
    if (!data.name || !data.email) return null;
    var m = {
      id: "F" + Date.now().toString(36).slice(-4),
      name: data.name, email: data.email.trim(), phone: data.phone || "",
      interests: data.interests || [],
      newsletter: !!data.newsletter,
      ts: new Date().toISOString()
    };
    state.community.unshift(m);
    state.membership = { joined: true, name: m.name, email: m.email, since: m.ts };
    save();
    upsertContact({ name: m.name, email: m.email, phone: m.phone },
      { type: "signup", ref: m.id, summary: "Joined the family" + (m.interests.length ? " — " + m.interests.join(", ") : "") });
    if (m.newsletter) {
      upsertContact({ name: m.name, email: m.email }, { type: "newsletter", ref: m.id, summary: "Newsletter opt-in" });
    }
    return m;
  }
  function isMember() { return !!(state.membership && state.membership.joined); }

  // ---- images (admin uploads) ----
  // Photos array entries may be file names (assets/img/...) or data URIs.
  function addPhotos(dataUris) {
    for (var i = 0; i < dataUris.length; i++) state.photos.push(dataUris[i]);
    save();
  }
  function removePhoto(i) { state.photos.splice(i, 1); save(); }
  function movePhoto(i, dir) {
    var j = i + dir;
    if (i < 0 || j < 0 || i >= state.photos.length || j >= state.photos.length) return;
    var t = state.photos[i]; state.photos[i] = state.photos[j]; state.photos[j] = t;
    save();
  }
  // Generic setter for uploaded images (product img / member photo), with revert on quota failure.
  function setImage(obj, prop, dataURI, prev) {
    obj[prop] = dataURI;
    save();
    if (window.TNM.storageError) {
      obj[prop] = prev; // revert, then persist the revert
      save();
      return false;
    }
    return true;
  }

  // ---- admin data ----
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    var s = JSON.parse(text); // throws on bad JSON — caller handles
    if (!s || s.version !== SEED.version) throw new Error("Unrecognised data (version mismatch)");
    if (!Array.isArray(s.catalogue) || !Array.isArray(s.gigs)) throw new Error("Missing catalogue/gigs — not TNM data?");
    state = s;
    if (!Array.isArray(state.cart)) state.cart = [];
    if (!Array.isArray(state.orders)) state.orders = [];
    if (!Array.isArray(state.enquiries)) state.enquiries = [];
    if (!Array.isArray(state.community)) state.community = [];
    if (!Array.isArray(state.contacts)) state.contacts = [];
    if (!state.membership) state.membership = null;
    save();
    return true;
  }
  function resetSeed() {
    localStorage.removeItem(KEY);
    state = defaults();
    save();
  }

  window.TNM.store = {
    state: state,
    save: save,
    fmt: fmt,
    addToCart: addToCart,
    setQty: setQty,
    removeFromCart: removeFromCart,
    cartCount: cartCount,
    cartLines: cartLines,
    cartTotal: cartTotal,
    placeOrder: placeOrder,
    setOrderStatus: setOrderStatus,
    setOrderNote: setOrderNote,
    addEnquiry: addEnquiry,
    setEnquiryHandled: setEnquiryHandled,
    joinCommunity: joinCommunity,
    isMember: isMember,
    upsertContact: upsertContact,
    setContactStatus: setContactStatus,
    setContactTags: setContactTags,
    addContactNote: addContactNote,
    addPhotos: addPhotos,
    removePhoto: removePhoto,
    movePhoto: movePhoto,
    setImage: setImage,
    exportJSON: exportJSON,
    importJSON: importJSON,
    resetSeed: resetSeed
  };
})();
