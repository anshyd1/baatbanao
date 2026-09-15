#!/usr/bin/env python3
import argparse, base64, datetime as dt, json, os, subprocess, tempfile, urllib.parse, urllib.request
from pathlib import Path

SCOPE = 'https://www.googleapis.com/auth/webmasters'
TOKEN_URL = 'https://oauth2.googleapis.com/token'


def b64url(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b'=')


def sign_jwt(private_key: str, client_email: str) -> str:
    now = int(dt.datetime.utcnow().timestamp())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": client_email,
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "exp": now + 3600,
        "iat": now,
    }
    unsigned = b'.'.join([
        b64url(json.dumps(header, separators=(',', ':')).encode()),
        b64url(json.dumps(payload, separators=(',', ':')).encode()),
    ])
    with tempfile.NamedTemporaryFile('w', delete=False) as f:
        f.write(private_key)
        keyfile = f.name
    try:
        sig = subprocess.check_output(['openssl', 'dgst', '-sha256', '-sign', keyfile], input=unsigned)
    finally:
        os.unlink(keyfile)
    return (unsigned + b'.' + b64url(sig)).decode()


def get_token(creds_path: Path) -> str:
    creds = json.loads(creds_path.read_text())
    assertion = sign_jwt(creds['private_key'], creds['client_email'])
    data = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': assertion,
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data)
    with urllib.request.urlopen(req, timeout=30) as res:
        payload = json.loads(res.read().decode())
    return payload['access_token']


def api(method: str, url: str, token: str, body=None):
    headers = {'Authorization': f'Bearer {token}'}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            txt = res.read().decode()
            return res.status, json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            obj = json.loads(txt) if txt else {}
        except Exception:
            obj = {'raw': txt}
        return e.code, obj


def md_table(headers, rows):
    out = ['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join(['---']*len(headers)) + ' |']
    for row in rows:
        out.append('| ' + ' | '.join(str(x) for x in row) + ' |')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser(description='Generate a Search Console status report')
    ap.add_argument('--credentials', required=True)
    ap.add_argument('--site', default='sc-domain:baatbanao.shop')
    ap.add_argument('--days', type=int, default=28)
    ap.add_argument('--output', default='GSC_STATUS_REPORT.md')
    args = ap.parse_args()

    creds = Path(args.credentials)
    token = get_token(creds)
    site_enc = urllib.parse.quote(args.site, safe='')

    today = dt.date.today()
    end = today - dt.timedelta(days=3)
    start = end - dt.timedelta(days=max(args.days-1, 0))

    status, sites = api('GET', 'https://www.googleapis.com/webmasters/v3/sites', token)
    s_status, sitemaps = api('GET', f'https://www.googleapis.com/webmasters/v3/sites/{site_enc}/sitemaps', token)
    q_status, queries = api('POST', f'https://www.googleapis.com/webmasters/v3/sites/{site_enc}/searchAnalytics/query', token, {
        'startDate': str(start), 'endDate': str(end), 'dimensions': ['query'], 'rowLimit': 10
    })
    p_status, pages = api('POST', f'https://www.googleapis.com/webmasters/v3/sites/{site_enc}/searchAnalytics/query', token, {
        'startDate': str(start), 'endDate': str(end), 'dimensions': ['page'], 'rowLimit': 10
    })

    lines = []
    lines.append('# GSC Status Report')
    lines.append('')
    lines.append(f'- Generated: {dt.datetime.now().isoformat(timespec="seconds")}')
    lines.append(f'- Property: `{args.site}`')
    lines.append(f'- Range: `{start}` to `{end}`')
    lines.append('')

    entries = sites.get('siteEntry', []) if status == 200 else []
    lines.append('## Accessible Properties')
    if entries:
        rows = [(e.get('siteUrl',''), e.get('permissionLevel','')) for e in entries]
        lines.append(md_table(['Site', 'Permission'], rows))
    else:
        lines.append(f'- Could not list properties (status {status})')
    lines.append('')

    lines.append('## Sitemap Status')
    if s_status == 200 and sitemaps.get('sitemap'):
        rows = []
        for sm in sitemaps['sitemap']:
            rows.append((sm.get('path',''), sm.get('isPending',''), sm.get('warnings',''), sm.get('errors',''), sm.get('lastSubmitted','')))
        lines.append(md_table(['Path','Pending','Warnings','Errors','Last Submitted'], rows))
    else:
        lines.append(f'- No sitemap data returned (status {s_status})')
        if sitemaps:
            lines.append('```json\n' + json.dumps(sitemaps, indent=2)[:2000] + '\n```')
    lines.append('')

    lines.append('## Top Queries')
    q_rows = queries.get('rows', []) if q_status == 200 else []
    if q_rows:
        rows = [(r['keys'][0], r.get('clicks',0), r.get('impressions',0), round(r.get('ctr',0)*100,2), round(r.get('position',0),2)) for r in q_rows]
        lines.append(md_table(['Query','Clicks','Impressions','CTR %','Position'], rows))
    else:
        lines.append(f'- No query data yet (status {q_status})')
    lines.append('')

    lines.append('## Top Pages')
    p_rows = pages.get('rows', []) if p_status == 200 else []
    if p_rows:
        rows = [(r['keys'][0], r.get('clicks',0), r.get('impressions',0), round(r.get('ctr',0)*100,2), round(r.get('position',0),2)) for r in p_rows]
        lines.append(md_table(['Page','Clicks','Impressions','CTR %','Position'], rows))
    else:
        lines.append(f'- No page data yet (status {p_status})')
    lines.append('')

    Path(args.output).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Wrote {args.output}')


if __name__ == '__main__':
    main()
