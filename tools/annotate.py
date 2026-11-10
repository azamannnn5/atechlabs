#!/usr/bin/env python3
"""
Annotator for the A-Tech Labs static site.

Usage:  python3 annotate.py <source_site_dir> <output_site_dir>

Reads every page of the clean source site, tags every editable text, link,
image and alt text with data-cms attributes, and writes:
  - the annotated pages into <output_site_dir>
  - <output_site_dir>/cms/defaults.json (every field with its original value)

It is safe to re-run from a clean source. It never edits the source folder.
"""
import hashlib, json, os, re, shutil, sys
from collections import defaultdict
from posixpath import normpath, join, dirname, relpath
from bs4 import BeautifulSoup, NavigableString, Tag

SRC, OUT = sys.argv[1], sys.argv[2]

INLINE = {"a", "b", "strong", "i", "em", "span", "br", "small", "sup", "sub", "u", "mark", "font", "code", "abbr"}
SKIP_TAGS = {"script", "style", "svg", "noscript", "template", "iframe", "select", "textarea", "input", "head", "source_"}
PRODUCT_RE = re.compile(r"(?:^|/)product/([^/]+)\.html$")


def h6(s):
    return hashlib.sha1(s.encode("utf8")).hexdigest()[:6]


def page_list():
    pages = []
    for root, _, files in os.walk(SRC):
        rel = os.path.relpath(root, SRC).replace("\\", "/")
        if rel.split("/")[0] in ("build", "static", "uploads", "storage", "cms", "admin", "node_modules", "netlify"):
            continue
        for f in files:
            if f.endswith(".html"):
                pages.append(normpath(join(rel, f)).lstrip("./") if rel != "." else f)
    return sorted(pages)


def norm_url(url, page):
    """Make a relative URL root-relative so it can be shared by pages at any depth."""
    u = url.strip()
    if not u or u.startswith(("#", "http:", "https:", "//", "mailto:", "tel:", "javascript:", "data:", "wa.me")):
        return u
    base = dirname(page)
    return normpath(join(base, u)) if base else normpath(u)


def collapse(s):
    return re.sub(r"\s+", " ", s).strip()


def kind_label(tag, kind):
    names = {"h1": "Heading", "h2": "Heading", "h3": "Heading", "h4": "Heading", "h5": "Heading", "h6": "Heading",
             "p": "Paragraph", "li": "List item", "button": "Button", "a": "Link text", "td": "Table cell",
             "th": "Table cell", "label": "Label", "span": "Text", "div": "Text", "small": "Small text"}
    return names.get(tag, "Text")


class Field:
    __slots__ = ("key", "kind", "value", "label", "section", "region")

    def __init__(self, key, kind, value, label, section, region):
        self.key, self.kind, self.value, self.label, self.section, self.region = key, kind, value, label, section, region


def region_of(el):
    for p in [el] + list(el.parents):
        if not isinstance(p, Tag):
            continue
        if p.get("id") == "contactsModal":
            return "contact"
        if p.name == "header":
            return "header"
        if p.name == "footer":
            return "footer"
        if p.name == "main":
            return "main"
        if p.name == "div" and "alert" in (p.get("class") or []) and p.parent is not None and p.parent.name == "body":
            return "banner"
    return "other"


def build_page(page, shared_counts, assign=False):
    """Parse a page. If assign is False: return list of raw (hashid, region) used to count sharing.
    If assign is True: tag the DOM and return fields in page order."""
    path = os.path.join(SRC, page)
    soup = BeautifulSoup(open(path, encoding="utf8"), "html.parser")
    is_product = bool(PRODUCT_RE.search(page))
    pkey = page[:-5].replace("/", "-")
    fields = []
    seen = {}
    section_state = {"n": 0, "cur": None, "labels": {}}

    def scope_for(region, hid):
        if region in ("header", "footer", "contact", "banner"):
            return "g." + region
        if is_product and shared_counts.get(("main", hid), 0) >= 20:
            return "product"
        return pkey

    def section_for(el, region):
        names = {"header": "Header and menu", "footer": "Footer", "contact": "Contact popup",
                 "banner": "Top banner", "other": "Other"}
        if region != "main":
            return names[region]
        if is_product:
            return "Product page text"
        sec = None
        for p in el.parents:
            if isinstance(p, Tag) and p.name == "section":
                sec = p
                break
        if sec is None:
            return "Page content"
        if "_label" not in sec.attrs:
            section_state["n"] += 1
            head = sec.find(["h1", "h2", "h3"])
            ht = collapse(head.get_text()) if head else ""
            cls = [c for c in (sec.get("class") or []) if not c.startswith(("py", "my", "pt", "pb", "mt", "mb"))]
            base = (cls[0] if cls else "section").replace("-", " ").replace("_", " ").title()
            sec.attrs["_label"] = "Section %d: %s%s" % (section_state["n"], ht[:40] if ht else base, "")
        return sec.attrs["_label"]

    def register(el, region, kind, raw, extra_id="", label=None):
        hid = h6(extra_id or raw)
        if not assign:
            fields.append(("main" if region == "main" else region, hid))
            return None
        scope = scope_for(region, hid)
        key = "%s.%s" % (scope, hid)
        suffix = {"text": "", "html": "", "href": "~h", "src": "~s", "alt": "~a", "srcset": "~m"}[kind if kind in ("href", "src", "alt", "srcset") else "text"]
        fkey = key + suffix
        sec = section_for(el, region)
        label = label or ""
        if fkey not in seen:
            seen[fkey] = Field(fkey, kind, raw, label, sec, region)
            fields.append(seen[fkey])
        return fkey

    def set_attr(el, name, v):
        el.attrs[name] = v

    def handle_link(a, region, text_id):
        href = a.get("href")
        if href is None or href.strip() in ("", "#") or href.startswith(("javascript:",)):
            return
        nu = norm_url(href, page)
        k = register(a, region, "href", nu, extra_id="h|" + nu + "|" + text_id, label="Link to " + (nu[:50]))
        if k:
            set_attr(a, "data-cms-href", k)

    def handle_img(img, region):
        src = img.get("src")
        if src and not src.startswith("data:"):
            nu = norm_url(src, page)
            k = register(img, region, "src", nu, extra_id="s|" + nu, label="Image " + os.path.basename(nu)[:36])
            if k:
                set_attr(img, "data-cms-src", k)
                alt = img.get("alt", "")
                ka = register(img, region, "alt", alt, extra_id="a|" + nu, label="Alt text for " + os.path.basename(nu)[:30])
                if ka:
                    set_attr(img, "data-cms-alt", ka)

    def handle_source(src, region):
        v = src.get("srcset")
        if v and not v.startswith("data:") and "," not in v:
            nu = norm_url(v, page)
            k = register(src, region, "srcset", nu, extra_id="m|" + nu, label="Mobile image " + os.path.basename(nu)[:30])
            if k:
                set_attr(src, "data-cms-srcset", k)

    def tag_product_parts(soup):
        """Product data is handled by the products module, not the generic text fields."""
        if is_product:
            slug = PRODUCT_RE.search(page).group(1)
            info = soup.select_one(".product__info")
            h2 = info.find("h2") if info else None
            if h2: set_attr(h2, "data-pf", "name")
            n = soup.select_one(".product__name span")
            if n: set_attr(n, "data-pf", "full")
            g = soup.select_one(".product__grammage span")
            if g: set_attr(g, "data-pf", "pack")
            im = soup.select_one(".product__image img")
            if im: set_attr(im, "data-pf", "image")
            main = soup.find("main")
            if main: set_attr(main, "data-pslug", slug)
        for a in soup.select('a.card[href*="product/"]'):
            m = PRODUCT_RE.search(a["href"])
            if not m: continue
            set_attr(a, "data-pslug", m.group(1))
            p = a.find("p"); h = a.find("h5"); im = a.find("img")
            if p: set_attr(p, "data-pf", "sub")
            if h: set_attr(h, "data-pf", "name")
            if im: set_attr(im, "data-pf", "image")

    tag_product_parts(soup)

    def skipped(el):
        if el.name in SKIP_TAGS:
            return True
        if el.has_attr("data-buy") or el.has_attr("data-cart-count") or el.has_attr("data-pf") or el.has_attr("data-pslug") and el.name == "a":
            return True
        if el.find(attrs={"data-cart-count": True}) is not None or el.find(attrs={"data-pf": True}) is not None:
            if el.name in INLINE or el.name in ("li", "p", "h5", "h4", "h2", "h3"):
                return True
        cls = el.get("class") or []
        if "cart-page" in cls or el.get("id") == "cart-root":
            return True
        return False

    def visit(el, region):
        if not isinstance(el, Tag):
            return
        if skipped(el):
            # still descend into a product card? no: handled by products module
            return
        if el.name == "picture":
            for ch in el.children:
                if isinstance(ch, Tag):
                    if ch.name == "source":
                        handle_source(ch, region)
                    elif ch.name == "img":
                        handle_img(ch, region)
            return
        if el.name == "img":
            handle_img(el, region)
            return
        children = [c for c in el.children if isinstance(c, Tag)]
        direct_text = any(isinstance(c, NavigableString) and str(c).strip() and not str(c).strip().startswith("<!") for c in el.children if not isinstance(c, Tag) and type(c).__name__ == "NavigableString")
        # wrapper with a single inline child and no text: look inside the child
        if not direct_text and len(children) == 1 and children[0].name in INLINE:
            if el.name == "a":
                pass
            else:
                visit(children[0], region)
                return
        all_inline = all(c.name in INLINE for c in children)
        if (direct_text or children) and all_inline and el.get_text(strip=True) and el.name not in ("html", "body") and not any(
                c.find(["img", "svg"]) is not None for c in children):
            html_kind = any(c.name != "br" for c in children)
            if html_kind and el.name == "a":
                html_kind = any(c.name != "br" for c in children)
            if html_kind:
                frag = BeautifulSoup(el.decode_contents(formatter="minimal"), "html.parser")
                for a2 in frag.find_all("a", href=True):
                    a2["href"] = norm_url(a2["href"], page)
                for i2 in frag.find_all("img", src=True):
                    i2["src"] = norm_url(i2["src"], page)
                raw = collapse(frag.decode(formatter="minimal"))
            else:
                raw = collapse(el.get_text())
            kind = "html" if html_kind else "text"
            lab = kind_label(el.name, kind)
            k = register(el, region, kind, raw, label=lab + ": " + collapse(el.get_text())[:60])
            if k:
                set_attr(el, "data-cms", k)
                if kind == "html":
                    set_attr(el, "data-cms-html", "1")
            if el.name == "a":
                handle_link(el, region, raw)
            return
        # block with mixed children: wrap orphan text nodes, then descend
        for c in list(el.children):
            if isinstance(c, NavigableString) and type(c).__name__ == "NavigableString" and str(c).strip():
                span = soup.new_tag("span")
                span.string = str(c)
                c.replace_with(span)
        if el.name == "a":
            handle_link(el, region, "")
        for c in list(el.children):
            visit(c, region)

    # Walk the whole body, region decided from the element
    for top in list(soup.body.children) if soup.body else []:
        if isinstance(top, Tag):
            walk_region(top, visit)

    return soup, fields


def walk_region(el, visit):
    """Descend until we hit header/footer/main/modal/banner so region is correct, then visit."""
    r = region_of(el)
    # structural containers: go deeper to find the proper regions
    if el.name in ("header", "footer", "main") or el.get("id") == "contactsModal" or (r == "banner" and el.name == "div" and "alert" in (el.get("class") or [])):
        visit(el, r)
        return
    kids = [c for c in el.children if isinstance(c, Tag)]
    if el.name in ("script", "style"):
        return
    if kids and any(k.name in ("header", "footer", "main") or k.get("id") == "contactsModal" or k.find(["header", "footer", "main"]) or k.find(id="contactsModal") for k in kids):
        for c in kids:
            walk_region(c, visit)
    else:
        visit(el, region_of(el))


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(SRC, OUT)
    pages = page_list()

    # pass 1: count how many product pages use each main-region text
    counts = defaultdict(set)
    raw_by_page = {}
    for p in pages:
        if PRODUCT_RE.search(p):
            _, flds = build_page(p, {}, assign=False)
            for r, hid in flds:
                counts[(r, hid)].add(p)
    shared_counts = {k: len(v) for k, v in counts.items()}

    defaults = {"fields": {}, "pages": {}, "generated_from": "annotate.py"}
    for p in pages:
        soup, flds = build_page(p, shared_counts, assign=True)
        # remove temp attrs
        for t in soup.find_all(attrs={"_label": True}):
            del t.attrs["_label"]
        # relative prefix to root for assets
        depth = p.count("/")
        pre = "../" * depth
        head = soup.head
        if head and not soup.find("script", attrs={"data-cms-boot": True}):
            for src in ("static/js/cms-config.js", "static/js/cms-loader.js"):
                tag = soup.new_tag("script", src=pre + src)
                tag.attrs["data-cms-boot"] = "1"
                head.append(tag)
        open(os.path.join(OUT, p), "w", encoding="utf8").write(str(soup))
        title = ""
        for sel in ("h1", "h2"):
            t = soup.find(sel)
            if t and t.get_text(strip=True):
                title = collapse(t.get_text())
                break
        if p == "index.html": title = "Home (About)"
        grp = ("Product pages" if PRODUCT_RE.search(p) else "Category pages" if p.startswith("category/")
               else "Cart page" if p == "cart.html" else "Main pages")
        keys = []
        for f in flds:
            if f.key not in defaults["fields"]:
                defaults["fields"][f.key] = {"kind": f.kind, "value": f.value, "label": f.label,
                                             "section": f.section, "region": f.region, "pages": [p]}
            else:
                lst = defaults["fields"][f.key]["pages"]
                if p not in lst: lst.append(p)
            keys.append(f.key)
        defaults["pages"][p] = {"title": title or p, "group": grp, "keys": keys}

    os.makedirs(os.path.join(OUT, "cms"), exist_ok=True)
    json.dump(defaults, open(os.path.join(OUT, "cms", "defaults.json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    product_defaults(OUT)
    n = len(defaults["fields"])
    print("pages:", len(pages), "fields:", n)
    by = defaultdict(int)
    for f in defaults["fields"].values(): by[f["kind"]] += 1
    print(dict(by))


def product_defaults(out):
    """cms/products.json: original product data (cards, product pages, cart prices)."""
    prods = {}
    cart = open(os.path.join(SRC, "static/js/cart.js"), encoding="utf8").read()
    for m in re.finditer(r'"([a-z0-9-]+)":\s*\{\s*name:\s*"([^"]*)",\s*pack:\s*"([^"]*)",\s*price:\s*(null|[0-9.]+)\s*\}', cart):
        slug, nm, pk, pr = m.groups()
        prods[slug] = {"cartName": nm, "cartPack": pk, "price": None if pr == "null" else float(pr)}
    for p in page_list():
        m = PRODUCT_RE.search(p)
        if not m: continue
        slug = m.group(1)
        soup = BeautifulSoup(open(os.path.join(SRC, p), encoding="utf8"), "html.parser")
        d = prods.setdefault(slug, {"cartName": "", "cartPack": "", "price": None})
        g = lambda sel: collapse(soup.select_one(sel).get_text()) if soup.select_one(sel) else ""
        d["name"] = g(".product__info h2"); d["full"] = g(".product__name span"); d["pack"] = g(".product__grammage span")
        im = soup.select_one(".product__image img")
        d["image"] = norm_url(im["src"], p) if im and im.get("src") else ""
        d["page"] = p
    for p in page_list():
        if p == "catalog.html" or p.startswith("category/"):
            soup = BeautifulSoup(open(os.path.join(SRC, p), encoding="utf8"), "html.parser")
            for a in soup.select('a.card[href*="product/"]'):
                m = PRODUCT_RE.search(a["href"])
                if not m or m.group(1) not in prods: continue
                d = prods[m.group(1)]
                pe = a.find("p")
                if pe and "sub" not in d: d["sub"] = collapse(pe.get_text())
                if p.startswith("category/"):
                    d.setdefault("category", os.path.basename(p)[:-5])
                im = a.find("img")
                if im and im.get("src"): d.setdefault("cardImage", norm_url(im["src"], p))
    json.dump(prods, open(os.path.join(out, "cms", "products.json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    print("products:", len(prods))


if __name__ == "__main__":
    main()
