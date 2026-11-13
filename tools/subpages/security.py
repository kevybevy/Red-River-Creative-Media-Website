"""Static-page browser policy. Hosting response headers remain deployment work."""
import base64
import hashlib
import html
import re


def secure_html(document):
    hashes = set()
    for match in re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script>', document, re.I):
        if not re.search(r'\bsrc\s*=', match[1], re.I):
            digest = base64.b64encode(hashlib.sha256(match[2].encode()).digest()).decode()
            hashes.add("'sha256-" + digest + "'")
        else:
            integrity = re.search(r'\bintegrity="([^"]+)"', match[1], re.I)
            if re.search(r'\bsrc=["\'](?:https?:)?//', match[1], re.I) and not integrity:
                raise ValueError('External scripts must have verified integrity metadata')
            if integrity:
                for value in integrity[1].split():
                    if re.fullmatch(r'sha(?:256|384|512)-[A-Za-z0-9+/=]+', value):
                        hashes.add("'" + value + "'")
    policy = "; ".join([
        "default-src 'none'",
        "script-src 'self' " + " ".join(sorted(hashes)),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "form-action 'none'",
    ])
    tags = '\n  <meta http-equiv="Content-Security-Policy" content="' + html.escape(policy, quote=True) + '">'
    tags += '\n  <meta name="referrer" content="no-referrer">'
    document = re.sub(r'\s*<meta\b[^>]*(?:http-equiv="Content-Security-Policy"|name="referrer")[^>]*>', '', document, flags=re.I)
    return re.sub(r'(<meta charset="utf-8">)', lambda m: m[1] + tags, document, count=1, flags=re.I)
