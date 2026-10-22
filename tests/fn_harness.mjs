// In-memory stand-in for Supabase REST + a fake translation provider, so the real core.js can be exercised end to end.
import { handle, resetCorpusCache } from '../supabase/functions/translate/core.js';

export function makeWorld(opts = {}) {
  const W = {
    tables: {
      programs: [{ slug: 'beginners', title: 'Quran Reading for Beginners', short_description: 'A gentle start for new readers.', description: 'We begin with letters and sounds.\n\n- Letters\n- Short words', objectives: ['Read the letters'], sort_order: 1 }],
      program_levels: [{ level_number: 1, title: 'Reading Foundations', description: '' }],
      faqs: [{ category: 'General', question: 'Who can join?', answer: 'Children and adults of every age and level.' }],
      public_pages: [{ slug: 'camp', title: 'Summer Camp', sections: [{ id: 's1', type: 'rich_text', heading: 'Join our camp', body: 'Two weeks of Quran practice. Read Surah Al-Fatiha: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' }] }],
      site_settings: [{ id: 1, data: { academy_name: 'Inaya Quran Academy', tagline: 'Learn · Practice · Grow', translate: opts.translate || { enabled: true, languages: ['bn', 'ar', 'fr'] } } }],
      translations: [], translation_usage: []
    },
    providerCalls: 0, providerTexts: [], providerMode: 'ok', apiCalls: [],
    env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-secret', ANTHROPIC_API_KEY: opts.noKey ? undefined : 'sk-test-secret', TRANSLATE_PROVIDER: opts.provider, GEMINI_API_KEY: opts.gemini ? 'gem-test-secret' : undefined }
  };
  let id = 1;
  const filt = (rows, params) => {
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
      if (v.startsWith('eq.')) { const x = v.slice(3); rows = rows.filter(r => String(r[k]) === x); }
      else if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(','); rows = rows.filter(r => set.includes(String(r[k]))); }
    }
    return rows;
  };
  const sel = (rows, s) => { if (!s || s === '*') return rows; const cols = s.split(','); return rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))); };
  W.fetch = async (url, init = {}) => {
    const u = new URL(url), json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.hostname === 'api.anthropic.com') {
      W.providerCalls++;
      if (W.providerMode === 'error') return json({ error: 'boom' }, 500);
      if (W.providerMode === 'timeout') { await new Promise((_, rej) => init.signal && init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); })); }
      if (W.providerMode === 'ratelimit') return json({ error: 'slow down' }, 429);
      const items = JSON.parse(JSON.parse(init.body).messages[0].content);
      W.providerTexts.push(...items);
      const lang = (JSON.parse(init.body).system.match(/into (\w+)/) || [])[1];
      const out = W.providerMode === 'garbage' ? items.map(() => '<script>alert(1)</script>') : items.map(t => `[${lang}] ${t}`);
      return json({ content: [{ type: 'text', text: JSON.stringify(out) }] });
    }
    if (u.hostname === 'generativelanguage.googleapis.com') {
      W.providerCalls++; W.geminiSeen = { url: String(url), key: init.headers['x-goog-api-key'] };
      if (W.providerMode === 'error') return json({ error: 'boom' }, 500);
      const b = JSON.parse(init.body), items = JSON.parse(b.contents[0].parts[0].text);
      W.providerTexts.push(...items);
      const lang = (b.systemInstruction.parts[0].text.match(/into (\w+)/) || [])[1];
      return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(items.map(t => `[${lang}] ${t}`)) }] } }] });
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) {
      const ok = (init.headers.Authorization || '') === 'Bearer staff-token' || ((init.headers.Authorization || '') === 'Bearer owner-token');
      const admin = (init.headers.Authorization || '') === 'Bearer owner-token';
      return json(u.pathname.endsWith('is_admin') ? admin : ok);
    }
    const table = u.pathname.replace('/rest/v1/', ''), t = W.tables[table];
    if (!t) return json([], 404);
    const m = (init.method || 'GET').toUpperCase();
    W.apiCalls.push(m + ' ' + table);
    if (m === 'GET') { let rows = filt(t, [...u.searchParams]); return json(sel(rows, u.searchParams.get('select'))); }
    if (m === 'POST') {
      const rows = JSON.parse(init.body), conflict = (u.searchParams.get('on_conflict') || '').split(','), ignore = /ignore/.test(init.headers.Prefer || '');
      for (const r of rows) {
        const ex = t.find(e => conflict.every(c => e[c] === r[c]));
        if (ex) { if (!ignore && !(ex.is_override && table === 'translations')) Object.assign(ex, r); }
        else t.push(Object.assign({ id: id++, is_override: false }, r));
      }
      return new Response(null, { status: 201 });
    }
    if (m === 'DELETE') { const kill = new Set(filt(t, [...u.searchParams])); W.tables[table] = t.filter(r => !kill.has(r)); return new Response(null, { status: 204 }); }
    return json({}, 400);
  };
  W.call = async (body, token) => {
    const res = await handle(new Request('https://x.supabase.co/functions/v1/translate', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body) }), W.env, W.fetch);
    return { status: res.status, body: await res.json() };
  };
  resetCorpusCache();
  return W;
}
