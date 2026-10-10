from playwright.sync_api import sync_playwright
import sys, os, re

BASE = "http://127.0.0.1:8000"
ROOT = "/home/user/the-north-mob"
PAGES = ["index.html", "the-mob.html", "gigs.html", "merch.html",
         "partners.html", "bookings.html", "community.html", "gallery.html"]
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
    check("home: 6 teaser cards -> 6 pages", sorted(teasers) == sorted(
        ["gigs.html", "merch.html", "the-mob.html", "partners.html", "bookings.html", "community.html"]), str(teasers))
    check("home: no FAMILY chip before joining", page.locator("#memberChip").count() == 0)
    page.screenshot(path="/home/user/the-north-mob/shots/mobile-home.png", full_page=True)

    # ---------- MERCH: locked state (not yet a member) ----------
    page.goto(BASE + "/merch.html", wait_until="networkidle")
    check("merch: 2 cards rendered (1 product + 1 locked teaser)", page.locator("#merchGrid .product").count() == 2,
          str(page.locator("#merchGrid .product").count()))
    check("merch: locked exclusive teaser present", page.locator("#merchGrid .product-locked").count() == 1)
    check("merch: locked links to community", page.locator(".product-locked a[href='community.html']").count() == 1)
    check("merch: locked veil says MEMBERS ONLY", "MEMBERS ONLY" in page.locator("#merchGrid .product-locked").inner_text().upper())
    check("merch: H4B tee has 5 size pills", page.locator("#merchGrid .product").first.locator(".size-pill").count() == 5)

    # ---------- THE MOB ----------
    page.goto(BASE + "/the-mob.html", wait_until="networkidle")
    check("mob: 4 board cards", page.locator("#crewGrid .member-card").count() == 4)
    srcs = [page.locator("#crewGrid .biz-photo img").nth(i).get_attribute("src") for i in range(4)]
    check("mob: photo mapping (Trophy05/Carlow01/Orie04/Icey03)",
          srcs == ["assets/img/photo-05.jpg", "assets/img/photo-01.jpg",
                   "assets/img/photo-04.jpg", "assets/img/photo-03.jpg"], str(srcs))
    check("mob: corporate titles", "DIRECTOR OF" in page.locator("#crewGrid").inner_text().upper())
    check("mob: 4 live member IG links", page.locator("#crewGrid .member-ig").count() == 4)

    # ---------- GIGS ----------
    page.goto(BASE + "/gigs.html", wait_until="networkidle")
    check("gigs: 3 events", page.locator("#gigGrid .gig-poster").count() == 3)
    gtxt = page.locator("#gigGrid").inner_text().upper()
    check("gigs: all listening parties", gtxt.count("LISTENING PARTY") >= 3)
    check("gigs: typographic (no images)", page.locator("#gigGrid img").count() == 0)
    check("gigs: tickets TBC", page.locator("#gigGrid .btn-disabled").count() == 3)

    # ---------- COMMUNITY: join the family ----------
    page.goto(BASE + "/community.html", wait_until="networkidle")
    check("community: benefits cards", page.locator("#community .story-card").count() == 3)
    check("community: newsletter unchecked by default", page.locator("#cmNewsletter").is_checked() is False)
    page.fill("#cmName", "Family Tester")
    page.fill("#cmEmail", "family@example.com")
    page.fill("#cmPhone", "070 000 0000")
    page.locator("input[name='cmInterest'][value='merch drops']").check()
    page.locator("#cmNewsletter").check()
    page.locator("#communityForm button[type=submit]").click()
    page.wait_for_selector("#communityDone:not(.hidden)", timeout=5000)
    mid = page.locator("#communityRef").inner_text()
    check("community: member id F…", mid.startswith("F"), mid)
    st = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1'))")
    check("community: member persisted", len(st["community"]) == 1 and st["community"][0]["newsletter"] is True)
    check("community: membership flag set", st["membership"]["joined"] is True)
    check("community: member count label", "1 family member" in page.locator("#familyCount").inner_text())
    # empty form rejected
    before = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).community.length")
    page.locator("#communityForm button[type=submit]").click()
    page.wait_for_timeout(300)
    check("community: empty form rejected", before == page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).community.length"))

    # ---------- MERCH: unlocked state ----------
    page.goto(BASE + "/index.html", wait_until="networkidle")
    check("home: FAMILY chip after joining", page.locator("#memberChip").count() == 1)
    page.goto(BASE + "/merch.html", wait_until="networkidle")
    check("merch: 2 products, no locked card", page.locator("#merchGrid .product").count() == 2
          and page.locator("#merchGrid .product-locked").count() == 0)
    check("merch: signed tee unlocked with FAMILY flag", "FAMILY" in page.locator("#merchGrid").inner_text().upper()
          and "H4B SIGNED TEE" in page.locator("#merchGrid").inner_text().upper())
    # select size L on the first product, add x2
    page.locator("#merchGrid .product").first.locator("label.size-pill").filter(has_text=re.compile("^L$")).click()
    page.locator("#merchGrid .product").first.locator("button", has_text="Add to cart").click()
    page.locator("#cartBtn").click()
    page.locator(".qty button[aria-label='Increase quantity']").first.click()
    check("merch: badge = 2", page.locator("#cartCount").inner_text() == "2")
    cart_txt = page.locator("#cartItems").inner_text()
    check("cart shows size L", "[L]" in cart_txt, cart_txt[:80].replace("\n", " | "))
    check("cart total 2x tee", "R598.00" in page.locator("#drawerTotal").inner_text())
    page.locator("#drawerClose").click()

    # ---------- cross-page cart + checkout with size ----------
    page.goto(BASE + "/bookings.html", wait_until="networkidle")
    check("cart follows across pages", page.locator("#cartCount").inner_text() == "2")
    page.locator("#cartBtn").click()
    page.locator("#checkoutBtn").click()
    check("checkout shows size", "(L)" in page.locator("#coSummary").inner_text())
    page.fill("#coName", "Family Tester")           # same name/email as the signup -> CRM merge
    page.fill("#coContact", "family@example.com")
    page.locator("#coPlace").click()
    page.wait_for_selector("#coSuccess:not(.hidden)", timeout=5000)
    ref = page.locator("#coRef").inner_text()
    check("order placed (member, sized)", ref.startswith("NM-"), ref)
    st = page.evaluate("JSON.parse(localStorage.getItem('tnm.v1'))")
    check("order persisted with size L", st["orders"][0]["items"][0]["size"] == "L" and st["orders"][0]["totalCents"] == 59800)
    page.locator("#coDone").click()
    page.wait_for_timeout(400)

    # ---------- BOOKINGS form (same email again -> CRM merge) ----------
    page.fill("#bkName", "Family Tester"); page.fill("#bkEmail", "family@example.com")
    page.fill("#bkDate", "2026-12-05"); page.fill("#bkVenue", "Community Hall")
    page.locator("#bookingForm button[type=submit]").click()
    page.wait_for_selector("#bookingDone:not(.hidden)", timeout=5000)
    bk = page.locator("#bookingRef").inner_text()
    check("booking ref BK-", bk.startswith("BK-"), bk)

    # ---------- PARTNERS ----------
    page.goto(BASE + "/partners.html", wait_until="networkidle")
    check("partners: Play is Title partner", "PLAY" in page.locator("#partnerStrip").inner_text().upper())
    check("partners: 2 open placeholder slots", page.locator("#partnerStrip .partner-slot").count() == 3)
    page.fill("#ivCompany", "Brand Co"); page.fill("#ivName", "Ms Exec"); page.fill("#ivEmail", "exec@brand.example")
    page.locator("#investForm button[type=submit]").click()
    page.wait_for_selector("#investDone:not(.hidden)", timeout=5000)
    check("invest ref IN-", page.locator("#investRef").inner_text().startswith("IN-"))

    # ---------- GALLERY ----------
    page.goto(BASE + "/gallery.html", wait_until="networkidle")
    check("gallery: 5 IG windows", page.locator("#igWindows .ig-window").count() == 5)
    check("gallery: 5 live follow buttons", page.locator("#igWindows a.btn").count() == 5)
    check("gallery: 8 photos", page.locator("#igFeed button").count() == 8)
    page.locator("#igFeed button").nth(0).click()
    check("gallery: lightbox opens", "open" in page.locator("#lightbox").get_attribute("class"))
    page.locator("#lbNext").click(); page.locator("#lbClose").click()

    # ---------- desktop ----------
    page.set_viewport_size({"width": 1280, "height": 800})
    for f in PAGES:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        check(f"{f}: no h-overflow @1280", page.evaluate("document.documentElement.scrollWidth <= 1281"))
    for f, shot in [("index.html","desktop-home.png"), ("the-mob.html","desktop-the-mob.png"),
                    ("gigs.html","desktop-gigs.png"), ("merch.html","desktop-merch.png"),
                    ("partners.html","desktop-partners.png"), ("bookings.html","desktop-bookings.png"),
                    ("community.html","desktop-community.png"), ("gallery.html","desktop-gallery.png")]:
        page.goto(BASE + "/" + f, wait_until="networkidle")
        page.screenshot(path=f"/home/user/the-north-mob/shots/{shot}", full_page=True)

    # ---------- ADMIN ----------
    page.goto(BASE + "/admin.html", wait_until="networkidle")
    check("admin: order visible with size", "[L]" in page.locator("#panel-orders").inner_text() and ref in page.locator("#panel-orders").inner_text())
    # order note
    page.locator("#ordersBody input.admin-input").first.fill("print L first")
    page.locator("#ordersBody input.admin-input").first.dispatch_event("change")
    check("admin: order note saved", "print L first" in page.evaluate("JSON.parse(localStorage.getItem('tnm.v1')).orders[0].note"))
    # CRM tab
    page.locator(".tab[data-panel='panel-crm']").click()
    crm_txt = page.locator("#panel-crm").inner_text()
    check("crm: contact rows", page.locator("#crmBody tr").count() >= 2, str(page.locator("#crmBody tr").count()))
    check("crm: Family Tester present", "Family Tester" in crm_txt)
    check("crm: order + signup + booking merged on one contact",
          page.evaluate("""(() => {
            const c = JSON.parse(localStorage.getItem('tnm.v1')).contacts;
            const ft = c.filter(x => x.email === 'family@example.com')[0];
            return ft && ft.events.filter(e => ['order','signup','newsletter','booking'].includes(e.type)).length >= 4;
          })()"""))
    page.locator("#crmBody tr").first.click()
    check("crm: detail opens with timeline", page.locator("#crmDetail .crm-event").count() >= 1)
    page.locator("#crmDetail .row-actions button", has_text="contacted").click()
    check("crm: status change persists", "contacted" in page.evaluate(
        "JSON.parse(localStorage.getItem('tnm.v1')).contacts.filter(x=>x.email==='family@example.com')[0].status"))
    page.get_by_placeholder("met at Soshanguve party, wants collab…").fill("wants the signed tee in XXL")
    page.locator("#crmDetail button", has_text="Add").click()
    check("crm: note added", "XXL" in page.evaluate(
        "JSON.stringify(JSON.parse(localStorage.getItem('tnm.v1')).contacts.filter(x=>x.email==='family@example.com')[0].notes)"))
    # Family tab
    page.locator(".tab[data-panel='panel-community']").click()
    fam_txt = page.locator("#panel-community").inner_text()
    check("family: member listed", "Family Tester" in fam_txt and "family@example.com" in fam_txt)
    check("family: newsletter subscriber shown", "SUBSCRIBED" in fam_txt.upper())
    check("family: subscriber count", "1 newsletter subscriber" in fam_txt)
    # Members tab (editors + uploads present)
    page.locator(".tab[data-panel='panel-members']").click()
    check("members: 4 editor cards", page.locator("#memberList .panel-card").count() == 4)
    check("members: upload buttons present", page.locator("#memberList .upload-wrap button").count() == 4)
    # Catalogue tab: sizes + exclusive + upload
    page.locator(".tab[data-panel='panel-catalogue']").click()
    check("catalogue: 2 items", page.locator("#catList .panel-card").count() == 2)
    cat_txt = page.locator("#panel-catalogue").inner_text()
    check("catalogue: sizes editable", page.evaluate("document.querySelector(\"#catList input[data-f='sizes']\").value") == "S, M, L, XL, XXL")
    check("catalogue: exclusive toggle present", "Exclusive (family unlock)" in cat_txt)
    check("catalogue: image upload present", page.locator("#catList .upload-wrap button").count() == 2)
    # Content tab: gallery manager
    page.locator(".tab[data-panel='panel-content']").click()
    check("content: gallery manager with 8 thumbs", page.locator("#galleryMgr .pm-cell").count() == 8)
    check("content: add-photos input present", page.locator("#galleryUpload").count() == 1)
    # orders flow still works
    page.locator(".tab[data-panel='panel-orders']").click()
    page.locator("#panel-orders .row-actions button", has_text="Confirm").first.click()
    check("admin: confirm works", "CONFIRMED" in page.locator("#ordersBody").inner_text().upper())
    page.screenshot(path="/home/user/the-north-mob/shots/admin-desktop.png", full_page=True)
    page.locator(".tab[data-panel='panel-crm']").click()
    page.screenshot(path="/home/user/the-north-mob/shots/admin-crm.png", full_page=True)

    check("zero JS errors across all pages", len(errors) == 0, "; ".join(errors[:4]))
    ctx.close(); browser.close()

for st, name, extra in results:
    print(f"{st}  {name}" + (f"  [{extra}]" if extra else ""))
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
