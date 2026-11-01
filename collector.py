"""Scheduled Deal Scout feed collector.

Only explicitly authorized public RSS/Atom feeds are supported by default.
No login bypass, CAPTCHA solving, stealth or direct Marketplace scraping.
"""
import datetime as dt
import email.utils
import json
import re
import urllib.request
import urllib.parse
import urllib.robotparser
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CONFIG = ROOT / "config" / "feeds.json"
USER_AGENT = "DealScout/0.1 (permitted feed reader)"
MAX_RECORDS = 5000
MAX_HISTORY = 300
MAX_BYTES = 1_500_000

def load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return default

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

def text(node, name, ns=None):
    e = node.find(name, ns or {})
    return (e.text or "").strip() if e is not None else ""

def first_link(node, atom=False):
    if atom:
        for element in node.findall("{http://www.w3.org/2005/Atom}link"):
            if element.get("rel", "alternate") == "alternate":
                return element.get("href", "")
        return ""
    return text(node, "link")

def parse_feed(raw):
    root = ET.fromstring(raw)
    atom = root.tag.endswith("feed")
    entries = root.findall("{http://www.w3.org/2005/Atom}entry") if atom else root.findall("./channel/item")
    results = []
    for entry in entries[:200]:
        if atom:
            ns = "{http://www.w3.org/2005/Atom}"
            title = text(entry, ns + "title")
            url = first_link(entry, True)
            published = text(entry, ns + "published") or text(entry, ns + "updated")
        else:
            title = text(entry, "title")
            url = first_link(entry)
            published = text(entry, "pubDate")
        if not title or not url.startswith("https://"):
            continue
        results.append({"title": title, "url": url, "published": published})
    return results

def allowed(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    robot_url = urllib.parse.urlunparse(("https", parsed.netloc, "/robots.txt", "", "", ""))
    robot = urllib.robotparser.RobotFileParser()
    robot.set_url(robot_url)
    try:
        robot.read()
        return robot.can_fetch(USER_AGENT, url)
    except Exception:
        return False

def fetch(url):
    if not allowed(url):
        raise ValueError("robots policy unavailable or disallows automated retrieval")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, text/xml"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise ValueError(f"HTTP {response.status}")
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Feed too large")
        return raw

def run():
    DATA.mkdir(exist_ok=True)
    config = load(CONFIG, {})
    records = load(DATA / "listings.json", [])
    runs = load(DATA / "runs.json", [])
    indexed = {item.get("url"): item for item in records if item.get("url")}
    timestamp = now()
    feeds = config.get("feeds", [])
    if not any(f.get("enabled") and f.get("authorizationConfirmed") for f in feeds):
        print("No authorized feeds configured; leaving historical data unchanged.")
        return
    for feed in feeds:
        if not feed.get("enabled") or not feed.get("authorizationConfirmed"):
            continue
        name, url = feed.get("name", "rss"), feed.get("url", "")
        log = {"source": name, "completedAt": timestamp, "status": "error", "added": 0}
        try:
            if not url.startswith("https://"):
                raise ValueError("Feed must use HTTPS")
            if urllib.parse.urlparse(url).hostname in {"facebook.com", "www.facebook.com", "craigslist.org", "www.craigslist.org"}:
                raise ValueError("Use notification ingestion for Facebook/Craigslist")
            items = parse_feed(fetch(url))
            for item in items:
                if item["url"] in indexed:
                    continue
                entry = {"searchId": feed.get("searchId", "daytona-675r"), "source": name,
                         "title": item["title"], "url": item["url"], "year": None,
                         "price": None, "miles": None, "location": "", "sellerType": "unknown",
                         "foundAt": timestamp, "discoveredBy": "GitHub collector",
                         "verification": "Public feed result — seller availability unconfirmed",
                         "notes": "Price not supplied by basic feed parser; needs verification"}
                # Do not pretend an item with unknown price is a qualifying deal.
                indexed[item["url"]] = entry
                records.append(entry)
                log["added"] += 1
            log["status"] = "ok"
        except Exception as error:
            log["message"] = str(error)[:240]
        runs.insert(0, log)
    records = records[-MAX_RECORDS:]
    runs = runs[:MAX_HISTORY]
    write(DATA / "listings.json", records)
    write(DATA / "runs.json", runs)
    # Track configured checks even when no feed sources are enabled.
    write(DATA / "collection.json", {
        "lastUpdated": timestamp,
        "mode": "scheduled-collector",
        "configuredFeeds": sum(bool(f.get("enabled") and f.get("authorizationConfirmed")) for f in feeds),
        "liveSourcesConfirmed": len({r["source"] for r in runs if r["status"] == "ok"})
    })
    print(f"Configured feeds: {len(feeds)}; records: {len(records)}; logged runs: {len(runs)}")

if __name__ == "__main__":
    run()
