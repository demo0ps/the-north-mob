from playwright.sync_api import sync_playwright
import sys, os, re

BASE = "http://127.0.0.1:8000"
SPOTIFY = "https://open.spotify.com/artist/0iZ4kkTa0bDsMz9Qgrr0zx"
ROOT = "/home/user/the-north-mob"
PAGES = ["index.html", "the-mob.html", "gigs.html", "merch.html",
         "partners.html", "bookings.html", "community.html", "members.html", "gallery.html"]
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
    check("home: 4 stat cards", page.locator("#statStrip .stat-card").count() == 4)
    check("home: reported-source note", "Not independently verified" in page.locator("#stats").inner_text())
    teasers = [a.get_attribute("href") for a in page.locator("#teasers .teaser-card").all()]
    check("home: 6 teaser cards", len(teasers) == 6 and "community.html" in teasers, str(teasers))
    check("home: no FAMILY chip before joining", page.locator("#memberChip").count() == 0)
    check("home: spotify CTA visible + correct", page.locator("#heroSpotify").is_visible()
          and page.locator("#heroSpotify").get_attribute("href") == SPOTIFY)
    page.screenshot(path="/home/user/the-north-mob/shots/mobile-home.png", full_page=True)

    # ---------- MERCH (anonymous) ----------
    page.goto(BASE + "/merch.html", wait_until="networkidle")
    check("merch anon: 1 product + 1 members card", page.locator("#merchGrid .product").count() == 2)
    mtxt = page.locator("#merchGrid").inner_text().upper()
    check("merch anon: locked teaser", "MEMBERS ONLY" in mtxt and "LOCKED DROP" in mtxt)
    check("merch anon: no private items listed", "H4B SIGNED TEE" not in mtxt and "MEMBERS CAP" not in mtxt)
    check("merch anon: locked links to community", page.locator(".product-members a[href='community.html']").count() == 1)
    check("merch: public tee has 5 size pills", page.locator("#merchGrid .product").first.locator(".size-pill").count() == 5)

    # ---------- COMMUNITY: join -> member number ----------
    page.goto(BASE + "/community.html", wait_until="networkidle")
    check("community: newsletter unchecked by default", page.locator("#cmNewsletter").is_checked() is False)
    page.fill("#cmName", "Family Tester")
    page.fill("#cmEmail", "family@example.com")
    page.locator("input[name='cmInterest'][value='merch drops']").check()
    page.locator("#cmNewsletter").check()
    page.locator("#communityForm button[type=submit]").click()
    page.wait_for_selector("#communityDone:not(.hidden)", timeout=5000)
    mno = page.locator("#communityRef").inner_text()
    check("community: member number issued H4B-0001", mno == "H4B-0001", mno)
    st = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1'))")
    check("community: member persisted with number", st["community"][0]["memberNo"] == "H4B-0001" and st["community"][0]["newsletter"] is True)
    check("community: membership flag set", st["membership"]["joined"] is True and st["membership"]["memberNo"] == "H4B-0001")
    before = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).community.length")
    page.locator("#communityForm button[type=submit]").click()
    page.wait_for_timeout(300)
    check("community: empty form rejected", before == page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).community.length"))

    # ---------- MERCH (member) ----------
    page.goto(BASE + "/merch.html", wait_until="networkidle")
    mtxt2 = page.locator("#merchGrid").inner_text().upper()
    check("merch member: private-shop card links to members area", page.locator(".product-members a[href='members.html']").count() == 1)
    check("merch member: still no private items on public page", "H4B SIGNED TEE" not in mtxt2)

    # ---------- MEMBERS area (auto-login from join) ----------
    page.goto(BASE + "/members.html", wait_until="networkidle")
    check("members: gate hidden when signed in", "hidden" in (page.locator("#memberGate").get_attribute("class") or ""))
    check("members: area visible", "hidden" not in (page.locator("#memberArea").get_attribute("class") or ""))
    check("members: member card shows number", page.locator("#memNo").inner_text() == "H4B-0001")
    check("members: member name", page.locator("#memName").inner_text().upper() == "FAMILY TESTER")
    check("members: perks cards", page.locator("#memberArea .story-card").count() == 4)
    check("members: private shop has 2 items", page.locator("#memberShop .product").count() == 2)
    check("members: signed tee sizes", page.locator("#memberShop .product").first.locator(".size-pill").count() == 3)
    check("members: 2 private events", page.locator("#privateEvents .gig-poster").count() == 2)
    ptxt = page.locator("#privateEvents").inner_text().upper()
    check("members: private invite kicker", ptxt.count("PRIVATE INVITE") == 2)
    check("members: free entry note", "FREE ENTRY FOR MEMBERS" in ptxt)
    # public gigs must NOT include private events
    page.goto(BASE + "/gigs.html", wait_until="networkidle")
    check("gigs: 3 public events only", page.locator("#gigGrid .gig-poster").count() == 3)
    gtxt = page.locator("#gigGrid").inner_text().upper()
    check("gigs: no private events leaked", "VAULT" not in gtxt and "MEMBERS-ONLY" not in gtxt)

    # ---------- add private item + RSVP ----------
    page.goto(BASE + "/members.html", wait_until="networkidle")
    page.locator("#memberShop .product").first.locator("label.size-pill").filter(has_text=re.compile("^L$")).click()
    page.locator("#memberShop .product").first.locator("button", has_text="Add to cart").click()
    check("members: exclusive item added", page.locator("#cartCount").inner_text() == "1")
    page.locator("#privateEvents .gig-poster button", has_text="RSVP").first.click()
    page.wait_for_timeout(300)
    st = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1'))")
    check("rsvp stored", len(st["rsvps"]) == 1 and st["rsvps"][0]["memberNo"] == "H4B-0001")
    check("rsvp button toggles", "GOING" in page.locator("#privateEvents").inner_text().upper())
    crm_rsvp = page.evaluate("""(() => {
      const c = JSON.parse(localStorage.getItem('tnm.v1')).contacts;
      return c.some(x => x.email === 'family@example.com' && x.events.some(e => e.type === 'rsvp'));
    })()""")
    check("rsvp logged in CRM", crm_rsvp)

    # ---------- logout strips exclusive cart ----------
    page.locator("#logoutBtn").click()
    page.wait_for_timeout(300)
    check("logout: gate back", "hidden" not in (page.locator("#memberGate").get_attribute("class") or ""))
    check("logout: exclusive cart stripped", page.locator("#cartCount").inner_text() == "0")
    st = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1'))")
    check("logout: cart empty in state", len(st["cart"]) == 0 and st["membership"] is None)
    check("logout: rsvp retained", len(st["rsvps"]) == 1)

    # ---------- login: wrong number rejected, then correct ----------
    page.fill("#loginNo", "H4B-9999")
    page.locator("#loginForm button[type=submit]").click()
    page.wait_for_timeout(200)
    check("login: wrong number rejected", page.locator("#loginErr").is_visible() and page.locator("#memberArea").is_hidden())
    page.fill("#loginNo", "0001")
    page.locator("#loginForm button[type=submit]").click()
    page.wait_for_timeout(200)
    check("login: bare number works", page.locator("#memberArea").is_visible() and page.locator("#memNo").inner_text() == "H4B-0001")
    check("login: FAMILY chip restored", page.locator("#memberChip").count() == 1)

    # ---------- checkout with exclusive item ----------
    page.locator("#memberShop .product").first.locator("label.size-pill").filter(has_text=re.compile("^L$")).click()
    page.locator("#memberShop .product").first.locator("button", has_text="Add to cart").click()
    page.locator("#cartBtn").click()
    check("cart shows [L] and FAMILY item", "[L]" in page.locator("#cartItems").inner_text())
    page.locator("#checkoutBtn").click()
    page.fill("#coName", "Family Tester")
    page.fill("#coContact", "family@example.com")
    page.locator("#coPlace").click()
    page.wait_for_selector("#coSuccess:not(.hidden)", timeout=5000)
    ref = page.locator("#coRef").inner_text()
    st = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1'))")
    check("exclusive order placed", st["orders"][0]["items"][0]["name"] == "H4B Signed Tee" and st["orders"][0]["items"][0]["size"] == "L")
    page.locator("#coDone").click()
    page.wait_for_timeout(400)

    # ---------- booking form (CRM merge) ----------
    page.goto(BASE + "/bookings.html", wait_until="networkidle")
    page.fill("#bkName", "Family Tester"); page.fill("#bkEmail", "family@example.com")
    page.fill("#bkDate", "2026-12-05"); page.fill("#bkVenue", "Community Hall")
    page.locator("#bookingForm button[type=submit]").click()
    page.wait_for_selector("#bookingDone:not(.hidden)", timeout=5000)
    bk = page.locator("#bookingRef").inner_text()
    check("booking ref BK-", bk.startswith("BK-"), bk)

    # ---------- PARTNERS / GALLERY ----------
    page.goto(BASE + "/partners.html", wait_until="networkidle")
    check("partners: Play is Title partner", "PLAY" in page.locator("#partnerStrip").inner_text().upper())
    page.fill("#ivCompany", "Brand Co"); page.fill("#ivName", "Ms Exec"); page.fill("#ivEmail", "exec@brand.example")
    page.locator("#investForm button[type=submit]").click()
    page.wait_for_selector("#investDone:not(.hidden)", timeout=5000)
    check("invest ref IN-", page.locator("#investRef").inner_text().startswith("IN-"))
    page.goto(BASE + "/gallery.html", wait_until="networkidle")
    check("gallery: 5 IG windows + 1 Spotify window",
          page.locator("#igWindows .ig-window:not(.sp-window)").count() == 5
          and page.locator("#igWindows .sp-window").count() == 1)
    check("gallery: spotify window links out", page.locator("#igWindows .sp-window a.btn").get_attribute("href") == SPOTIFY)
    check("gallery: footer spotify link", page.locator("#footSpotify").is_visible()
          and page.locator("#footSpotify").get_attribute("href") == SPOTIFY)
    check("gallery: 8 photos", page.locator("#igFeed button").count() == 8)

    # ---------- desktop ----------
    page.set_viewport_size({"width": 1280, "height": 800})
    for f in PAGES:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        check(f"{f}: no h-overflow @1280", page.evaluate("document.documentElement.scrollWidth <= 1281"))
    for f, shot in [("index.html","desktop-home.png"), ("members.html","desktop-members.png"),
                    ("community.html","desktop-community.png"), ("merch.html","desktop-merch.png"),
                    ("gigs.html","desktop-gigs.png"), ("the-mob.html","desktop-the-mob.png"),
                    ("partners.html","desktop-partners.png"), ("bookings.html","desktop-bookings.png"),
                    ("gallery.html","desktop-gallery.png")]:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        page.screenshot(path=f"/home/user/the-north-mob/shots/{shot}", full_page=True)

    # ---------- ADMIN ----------
    page.goto(BASE + "/admin.html", wait_until="networkidle")
    check("admin: exclusive order visible with size", ref in page.locator("#panel-orders").inner_text() and "[L]" in page.locator("#panel-orders").inner_text())
    # CRM
    page.locator(".tab[data-panel='panel-crm']").click()
    check("crm: Family Tester row", "Family Tester" in page.locator("#crmBody").inner_text())
    merged = page.evaluate("""(() => {
      const c = JSON.parse(localStorage.getItem('tnm.v1')).contacts;
      const ft = c.filter(x => x.email === 'family@example.com')[0];
      return ft && ft.events.filter(e => ['signup','newsletter','order','rsvp','booking'].includes(e.type)).length >= 5;
    })()""")
    check("crm: signup+newsletter+order+rsvp+booking merged", merged)
    # Family tab with member numbers
    page.locator(".tab[data-panel='panel-community']").click()
    fam_txt = page.locator("#panel-community").inner_text()
    check("family: member number shown", "H4B-0001" in fam_txt and "Family Tester" in fam_txt)
    check("family: subscriber count", "1 newsletter subscriber" in fam_txt)
    # Gigs tab: members-only + RSVPs
    page.locator(".tab[data-panel='panel-gigs']").click()
    gig_txt = page.locator("#panel-gigs").inner_text()
    check("gigs admin: 5 events listed", page.locator("#gigList .panel-card").count() == 5)
    check("gigs admin: members-only checkboxes", page.locator("#gigList input[data-f='membersOnly']").count() == 5
          and page.locator("#gigList input[data-f='membersOnly']:checked").count() == 2)
    check("gigs admin: RSVP list shows member", "RSVPs: 1" in gig_txt and "H4B-0001" in gig_txt, gig_txt[:100])
    # Catalogue
    page.locator(".tab[data-panel='panel-catalogue']").click()
    check("catalogue: 3 items", page.locator("#catList .panel-card").count() == 3)
    check("catalogue: 2 exclusive toggles on", page.locator("#catList input[data-f='exclusive']:checked").count() == 2)
    # Content gallery manager
    page.locator(".tab[data-panel='panel-content']").click()
    check("content: gallery manager with 8 thumbs", page.locator("#galleryMgr .pm-cell").count() == 8)
    # Links tab: spotify field
    page.locator(".tab[data-panel='panel-links']").click()
    check("admin links: spotify url field", page.evaluate("document.querySelector('#linkSpotify').value") == SPOTIFY)
    # orders flow
    page.locator(".tab[data-panel='panel-orders']").click()
    page.locator("#panel-orders .row-actions button", has_text="Confirm").first.click()
    check("admin: confirm works", "CONFIRMED" in page.locator("#ordersBody").inner_text().upper())
    page.screenshot(path="/home/user/the-north-mob/shots/admin-desktop.png", full_page=True)
    page.locator(".tab[data-panel='panel-gigs']").click()
    page.screenshot(path="/home/user/the-north-mob/shots/admin-gigs.png", full_page=True)

    check("zero JS errors / failed resources", len(errors) == 0, "; ".join(errors[:4]))
    ctx.close(); browser.close()

for st_, name, extra in results:
    print(f"{st_}  {name}" + (f"  [{extra}]" if extra else ""))
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
