// pcloud-photos-proxy（Cloudflare Worker）
// 写真アプリ（skiep7.github.io/pcloud-photos）から呼ばれ、pCloudの動画をそのまま流す中継役。
// 秘密は持たない。トークンは写真アプリが毎回渡す。
// 使い方：GET https://<worker>/video?host=api.pcloud.com&token=...&fileid=123
const ALLOW_ORIGIN = 'https://skiep7.github.io';
const HOSTS = ['api.pcloud.com', 'eapi.pcloud.com'];

export default {
  async fetch(req) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const u = new URL(req.url);
    if (u.pathname !== '/video') return new Response('pcloud-photos-proxy', { headers: cors });
    const host = u.searchParams.get('host') || 'api.pcloud.com';
    const token = u.searchParams.get('token');
    const fileid = u.searchParams.get('fileid');
    if (!HOSTS.includes(host) || !token || !/^\d+$/.test(fileid || '')) return new Response('bad request', { status: 400, headers: cors });

    const api = new URL('https://' + host + '/getfilelink');
    api.searchParams.set('access_token', token);
    api.searchParams.set('fileid', fileid);
    const r = await (await fetch(api)).json();
    if (r.result !== 0) return new Response('pCloud: ' + (r.error || r.result), { status: 502, headers: cors });

    const h = {};
    const range = req.headers.get('Range');
    if (range) h.Range = range;
    const up = await fetch('https://' + r.hosts[0] + r.path, { headers: h });
    const out = new Headers(cors);
    for (const k of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
      const v = up.headers.get(k);
      if (v) out.set(k, v);
    }
    if (!out.get('Accept-Ranges')) out.set('Accept-Ranges', 'bytes');
    out.set('Cache-Control', 'private, max-age=3600');
    return new Response(up.body, { status: up.status, headers: out });
  },
};
