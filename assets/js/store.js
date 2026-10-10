// THE NORTH MOB — store engine.
// Money is integer cents everywhere. State lives in localStorage (demo-grade,
// no backend). Checkout is simulated and idempotent-guarded against double submits.
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
      return s;
    } catch (e) {
      return defaults();
    }
  }

  var state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // Storage full or blocked — demo keeps working in-memory; admin shows a warning.
      window.TNM.storageError = String(e);
    }
  }
  save(); // persist the merged default so the store is stable from first load

  // ---- money ----
  function fmt(cents) {
    var v = (Math.round(cents) / 100).toFixed(2).split(".");
    var r = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return "R" + r + "." + v[1];
  }

  // ---- cart ----
  function findProduct(id) {
    for (var i = 0; i < state.catalogue.length; i++) if (state.catalogue[i].id === id) return state.catalogue[i];
    return null;
  }
  function addToCart(id) {
    var p = findProduct(id);
    if (!p || !p.active || !p.stock) return false;
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].id === id) { state.cart[i].qty++; save(); return true; }
    }
    state.cart.push({ id: id, qty: 1 });
    save();
    return true;
  }
  function setQty(id, qty) {
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].id === id) {
        state.cart[i].qty = Math.max(0, Math.min(99, qty));
        if (state.cart[i].qty === 0) state.cart.splice(i, 1);
        break;
      }
    }
    save();
  }
  function removeFromCart(id) {
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].id === id) { state.cart.splice(i, 1); break; }
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
      out.push({ id: p.id, name: p.name, priceCents: p.priceCents, qty: state.cart[i].qty, img: p.img });
    }
    return out;
  }
  function cartTotal() {
    var t = 0, ls = cartLines();
    for (var i = 0; i < ls.length; i++) t += ls[i].priceCents * ls[i].qty;
    return t;
  }

  // ---- orders ----
  var placing = false; // idempotency guard: a second call during a submit returns null
  function placeOrder(customer, method) {
    if (placing) return null;
    if (!state.cart.length) return null;
    placing = true;
    try {
      var items = cartLines().map(function (l) {
        return { id: l.id, name: l.name, priceCents: l.priceCents, qty: l.qty };
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
        customer: { name: customer.name, contact: customer.contact },
        method: method,
        demo: true
      };
      state.orders.unshift(order);
      state.cart = [];
      save();
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

  // ---- enquiries (bookings / sponsorship / investment) ----
  function addEnquiry(type, data) {
    var prefix = { booking: "BK", sponsorship: "SP", investment: "IN" }[type] || "EN";
    var ref = prefix + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    var e = { id: ref, ref: ref, type: type, ts: new Date().toISOString(), handled: false, data: data };
    state.enquiries.unshift(e);
    save();
    return e;
  }
  function setEnquiryHandled(id, handled) {
    for (var i = 0; i < state.enquiries.length; i++) {
      if (state.enquiries[i].id === id) { state.enquiries[i].handled = !!handled; save(); return true; }
    }
    return false;
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
    addEnquiry: addEnquiry,
    setEnquiryHandled: setEnquiryHandled,
    exportJSON: exportJSON,
    importJSON: importJSON,
    resetSeed: resetSeed
  };
})();
