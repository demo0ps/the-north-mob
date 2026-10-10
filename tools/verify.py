from playwright.sync_api import sync_playwright
import sys, os, re

BASE = "http://127.0.0.1:8000"
ROOT = "/home/user/the-north-mob"
PAGES = ["index.html", "the-mob.html", "gigs.html", "merch.html",
         "partners.html", "bookings.html", "gallery.html"]
results, fails = [], []
def check(name, cond, extra=""):
    results.append(("PASS" if cond else "FAIL", name, extra))
    if not cond: fails.append(name)

# ---------- static link integrity ----------
bad = 0
for p in PAGES + ["admin.html"]:
    html = open(f"{ROOT}/{p}").read()
    for href in re.findall(r'href="([^"#]+\.html)"', html):
        if not os.path.exists(f"{ROOT}/{href}"):
            print(f"DEAD LINK: {p} -> {href}"); bad += 1
    for href in re.findall(r'href="#([\w-]+)"', html):
        if f'id="{href}"' not in html:
            print(f"DEAD ANCHOR: {p} -> #{href}"); bad += 1
check("all internal links resolve", bad == 0, f"{bad} broken")

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # ---------- every page: loads, active nav, no mobile overflow ----------
    for f in PAGES:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        check(f"{f}: title", "THE NORTHMOB" in page.title())
        active = page.locator(".nav-links a.active").get_attribute("href")
        check(f"{f}: active nav link", active == f, str(active))
        check(f"{f}: no h-overflow @390", page.evaluate("document.documentElement.scrollWidth <= 391"),
              str(page.evaluate("document.documentElement.scrollWidth")))

    # ---------- HOME ----------
    page.goto(BASE + "/index.html", wait_until="networkidle")
    check("home: header is logo-only", page.locator(".site-nav .brand").inner_text().strip() == "")
    check("home: hero stamp", page.locator(".hero .stamp").count() == 1)
    check("home: hero says NORTHMOB", "NORTHMOB" in page.locator("#heroTitle").inner_text().upper())
    check("home: 4 stat cards", page.locator("#statStrip .stat-card").count() == 4)
    check("home: reported-source note", "Not independently verified" in page.locator("#stats").inner_text())
    teasers = [a.get_attribute("href") for a in page.locator("#teasers .teaser-card").all()]
    check("home: 6 teaser cards -> all pages", sorted(teasers) == sorted(PAGES[1:]), str(teasers))
    check("home: next event teaser filled", "NOV" in page.locator("#teaserNext").inner_text() and "Ga-Rankuwa" in page.locator("#teaserNext").inner_text(), page.locator("#teaserNext").inner_text())
    check("home: hero CTAs -> real pages", page.locator('a[href="bookings.html"].btn').count() >= 1)
    page.screenshot(path="/home/user/the-north-mob/shots/mobile-home.png", full_page=True)

    # ---------- THE MOB ----------
    page.goto(BASE + "/the-mob.html", wait_until="networkidle")
    check("mob: 4 board cards", page.locator("#crewGrid .member-card").count() == 4)
    srcs = [page.locator("#crewGrid .biz-photo img").nth(i).get_attribute("src") for i in range(4)]
    check("mob: photo mapping (Trophy05/Carlow01/Orie04/Icey03)",
          srcs == ["assets/img/photo-05.jpg", "assets/img/photo-01.jpg",
                   "assets/img/photo-04.jpg", "assets/img/photo-03.jpg"], str(srcs))
    txt = page.locator("#crewGrid").inner_text()
    check("mob: corporate titles", "DIRECTOR OF" in txt.upper())
    check("mob: card numbers", "№ 004" in txt)
    check("mob: 4 live member IG links", page.locator("#crewGrid .member-ig").count() == 4)
    check("mob: movement story cards", page.locator("#about .story-card").count() == 3)
    check("mob: seal", page.locator("#about .seal").count() == 1)

    # ---------- GIGS ----------
    page.goto(BASE + "/gigs.html", wait_until="networkidle")
    check("gigs: 3 events", page.locator("#gigGrid .gig-poster").count() == 3)
    gtxt = page.locator("#gigGrid").inner_text().upper()
    check("gigs: all are listening parties", gtxt.count("LISTENING PARTY") >= 3)
    check("gigs: typographic posters (no imagery)", page.locator("#gigGrid img").count() == 0 and page.locator("#gigGrid .gig-poster").count() == 3)
    check("gigs: poster kickers", page.locator("#gigGrid .gp-kicker").count() == 3)
    check("gigs: tickets TBC (no fake links)", page.locator("#gigGrid .btn-disabled").count() == 3)
    check("gigs: booking CTA links to bookings", page.locator('a[href="bookings.html"].btn').count() >= 1)

    # ---------- MERCH (add to cart) ----------
    page.goto(BASE + "/merch.html", wait_until="networkidle")
    check("merch: single product (H4B tee)", page.locator("#merchGrid .product").count() == 1 and "H4B TEE" in page.locator("#merchGrid").inner_text().upper())
    page.locator("#merchGrid .product button").nth(0).click()
    page.locator("#cartBtn").click()
    page.locator(".qty button[aria-label='Increase quantity']").first.click()
    check("merch: badge = 2", page.locator("#cartCount").inner_text() == "2")
    check("merch: total = 2x tee", "R598.00" in page.locator("#drawerTotal").inner_text())
    page.locator("#drawerClose").click()

    # ---------- cross-page cart: bookings page ----------
    page.goto(BASE + "/bookings.html", wait_until="networkidle")
    check("cart follows across pages", page.locator("#cartCount").inner_text() == "2")
    page.locator("#cartBtn").click()
    check("drawer total on bookings page", "R598.00" in page.locator("#drawerTotal").inner_text())
    page.locator("#checkoutBtn").click()
    page.fill("#coName", "Test Buyer")
    page.fill("#coContact", "buyer@example.com")
    page.locator("#coPlace").click()
    page.wait_for_selector("#coSuccess:not(.hidden)", timeout=5000)
    ref = page.locator("#coRef").inner_text()
    check("order placed from bookings page", ref.startswith("NM-"), ref)
    page.locator("#coDone").click()
    page.wait_for_timeout(400)
    check("badge cleared after order", page.locator("#cartCount").inner_text() == "0")

    # ---------- BOOKINGS form ----------
    page.fill("#bkName", "Promoter X"); page.fill("#bkEmail", "x@example.com")
    page.fill("#bkDate", "2026-12-05"); page.fill("#bkVenue", "Community Hall")
    page.locator("#bookingForm button[type=submit]").click()
    page.wait_for_selector("#bookingDone:not(.hidden)", timeout=5000)
    bk = page.locator("#bookingRef").inner_text()
    check("booking ref BK-", bk.startswith("BK-"), bk)
    enq_before = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).enquiries.length")
    page.locator("#bookingForm button[type=submit]").click()
    page.wait_for_timeout(300)
    check("empty form rejected", enq_before == page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).enquiries.length"))

    # ---------- PARTNERS ----------
    page.goto(BASE + "/partners.html", wait_until="networkidle")
    check("partners: Play is Title partner", "PLAY" in page.locator("#partnerStrip").inner_text().upper())
    check("partners: 2 open placeholder slots", page.locator("#partnerStrip .partner-slot").count() == 3)
    check("partners: 3 tiers", page.locator("#sponsors .tier").count() == 3)
    check("partners: invest section present", page.locator("#invest").count() == 1)
    page.fill("#ivCompany", "Brand Co"); page.fill("#ivName", "Ms Exec"); page.fill("#ivEmail", "exec@brand.example")
    page.locator("#investForm button[type=submit]").click()
    page.wait_for_selector("#investDone:not(.hidden)", timeout=5000)
    check("invest ref IN-", page.locator("#investRef").inner_text().startswith("IN-"))

    # ---------- GALLERY ----------
    page.goto(BASE + "/gallery.html", wait_until="networkidle")
    check("gallery: 5 IG windows", page.locator("#igWindows .ig-window").count() == 5)
    check("gallery: 5 live follow buttons (group confirmed)", page.locator("#igWindows a.btn").count() == 5)
    ghrefs = [a.get_attribute("href") for a in page.locator("#igWindows a.btn").all()]
    check("gallery: group links to @thenorthmob_", "instagram.com/thenorthmob_" in str(ghrefs), str(ghrefs[:1]))
    check("gallery: 8 photos", page.locator("#igFeed button").count() == 8)
    page.locator("#igFeed button").nth(0).click()
    check("gallery: lightbox opens", "open" in page.locator("#lightbox").get_attribute("class"))
    page.locator("#lbNext").click(); page.locator("#lbClose").click()
    check("gallery: lightbox closes", "open" not in page.locator("#lightbox").get_attribute("class"))

    # ---------- desktop spot checks + screenshots ----------
    page.set_viewport_size({"width": 1280, "height": 800})
    for f in PAGES:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        check(f"{f}: no h-overflow @1280", page.evaluate("document.documentElement.scrollWidth <= 1281"))
    page.goto(BASE + "/index.html", wait_until="networkidle")
    page.screenshot(path="/home/user/the-north-mob/shots/desktop-home.png", full_page=True)
    for f, shot in [("the-mob.html","desktop-the-mob.png"), ("gigs.html","desktop-gigs.png"),
                    ("merch.html","desktop-merch.png"), ("partners.html","desktop-partners.png"),
                    ("bookings.html","desktop-bookings.png"), ("gallery.html","desktop-gallery.png")]:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        page.screenshot(path=f"/home/user/the-north-mob/shots/{shot}", full_page=True)

    # ---------- ADMIN ----------
    page.goto(BASE + "/admin.html", wait_until="networkidle")
    check("admin: order visible", ref in page.locator("#panel-orders").inner_text())
    check("admin: booking enquiry visible", bk in page.locator("#panel-enquiries").inner_text())
    check("admin: invest enquiry visible", "IN-" in page.locator("#panel-enquiries").inner_text())
    page.locator("#panel-orders .row-actions button", has_text="Confirm").first.click()
    check("admin: confirm works", "CONFIRMED" in page.locator("#ordersBody").inner_text().upper())
    check("admin: state persisted", page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).orders[0].status") == "confirmed")
    page.screenshot(path="/home/user/the-north-mob/shots/admin-desktop.png", full_page=True)

    check("zero JS errors across all pages", len(errors) == 0, "; ".join(errors[:4]))
    ctx.close(); browser.close()

for st, name, extra in results:
    print(f"{st}  {name}" + (f"  [{extra}]" if extra else ""))
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
