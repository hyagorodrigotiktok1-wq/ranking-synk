(function() {
  if (window.__synkRunning) return;
  window.__synkRunning = true;

  const REPO = 'hyagorodrigotiktok1-wq/ranking-synk';
  const FILE = 'data/latest.json';
  const IG_HEADERS = { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' };
  const CANDIDATES = [
    {handle:'rodrigovaladares_',userId:'175656735',name:'Rodrigo Valadares',party:'PL',followers:453679,highlight:true},
    {handle:'alessandrovieirase',userId:'2287854653',name:'Alessandro Vieira',party:'MDB',followers:402120,highlight:false},
    {handle:'del.andredavid',userId:'36740626088',name:'André David',party:'Republicanos',followers:343294,highlight:false},
    {handle:'senadorrogerio',userId:'349334128',name:'Rogério Carvalho',party:'PT',followers:174993,highlight:false},
    {handle:'edvaldonogueira',userId:'4002737',name:'Edvaldo Nogueira',party:'PDT',followers:139459,highlight:false},
    {handle:'andremourase',userId:'290953553',name:'André Moura',party:'União Brasil',followers:70906,highlight:false},
    {handle:'eduardoamorimse',userId:'307906858',name:'Eduardo Amorim',party:'Republicanos',followers:51481,highlight:false},
    {handle:'segueadailton',userId:'8930861847',name:'Adailton de Valmir',party:'Podemos',followers:45962,highlight:false},
    {handle:'iranbarbosaoficial',userId:'1827112243',name:'Iran Barbosa',party:'PSOL',followers:19521,highlight:false},
    {handle:'coronelrochase',userId:'5771219962',name:'Coronel Rocha',party:'PL',followers:16445,highlight:false},
  ];

  // --- UI ---
  const style = document.createElement('style');
  style.textContent = `
    #synk-overlay { position:fixed;inset:0;background:#0008;z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui }
    #synk-box { background:#13131a;border:1px solid #1e1e2e;border-radius:16px;padding:28px;width:420px;max-width:94vw;color:#e2e8f0 }
    #synk-box h2 { font-size:18px;font-weight:800;color:#fff;margin-bottom:4px }
    #synk-box p { font-size:12px;color:#64748b;margin-bottom:18px }
    #synk-box input { width:100%;background:#0d0d14;border:1px solid #1e1e2e;border-radius:8px;padding:9px 12px;color:#e2e8f0;font-size:13px;margin-bottom:14px;outline:none;box-sizing:border-box }
    #synk-box button { width:100%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:12px }
    #synk-box button:disabled { opacity:.4;cursor:not-allowed }
    #synk-log { background:#0d0d14;border:1px solid #1e1e2e;border-radius:8px;padding:12px;font-size:11px;font-family:monospace;max-height:200px;overflow-y:auto;display:none }
    #synk-log .ok { color:#22c55e } #synk-log .err { color:#ef4444 } #synk-log .info { color:#94a3b8 }
    #synk-close { float:right;background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;width:auto;margin:0;padding:0 }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'synk-overlay';
  const savedPat = localStorage.getItem('synk_pat') || '';
  overlay.innerHTML = `
    <div id="synk-box">
      <h2>📊 Synk Produções <button id="synk-close">×</button></h2>
      <p>Coleta os últimos 7 dias de todos os candidatos e publica no ranking.</p>
      <input type="password" id="synk-pat" placeholder="GitHub Token (ghp_...)" value="${savedPat}" />
      <button id="synk-btn">▶ Coletar e publicar</button>
      <div id="synk-log"></div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('synk-close').onclick = () => { overlay.remove(); style.remove(); window.__synkRunning = false; };

  function log(msg, cls = 'info') {
    const el = document.getElementById('synk-log');
    el.style.display = 'block';
    el.innerHTML += `<div class="${cls}">${msg}</div>`;
    el.scrollTop = el.scrollHeight;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function collectUser(cand) {
    const now = Date.now() / 1000;
    const START = now - 7 * 24 * 3600;
    const BUFFER = 7 * 24 * 3600;
    let allItems = [], cursor = null, page = 0;
    while (page < 30) {
      const url = `/api/v1/feed/user/${cand.userId}/?count=50` + (cursor ? `&max_id=${cursor}` : '');
      const r = await fetch(url, { headers: IG_HEADERS });
      if (!r.ok) { log(`  ${cand.handle}: HTTP ${r.status}`, 'err'); break; }
      const data = await r.json();
      const items = data.items || [];
      allItems = allItems.concat(items);
      const oldest = items.length ? items[items.length - 1].taken_at : 0;
      if (!data.more_available || oldest < START - BUFFER) break;
      cursor = data.next_max_id; page++;
      await sleep(600);
    }
    const inRange = allItems.filter(i => i.taken_at >= START && i.taken_at <= now);
    let views = 0, likes = 0, comments = 0, reels = 0, photos = 0, carousels = 0;
    for (const item of inRange) {
      const mt = item.media_type || 1;
      if (mt === 2) { reels++; views += item.play_count || item.view_count || 0; }
      else if (mt === 8) { carousels++; views += item.view_count || 0; }
      else { photos++; views += item.view_count || 0; }
      likes += item.like_count || 0;
      comments += item.comment_count || 0;
    }
    const posts = inRange.length;
    const interactions = likes + comments;
    const engagement = posts && cand.followers ? parseFloat((interactions / posts / cand.followers * 100).toFixed(2)) : 0;
    const fmt = d => new Date(d * 1000).toISOString().slice(0, 10);
    return {
      handle: cand.handle, name: cand.name, party: cand.party,
      followers: cand.followers, highlight: cand.highlight,
      period: { start: fmt(START), end: fmt(now) },
      stats: { posts, reels, photos, carousels, views, likes, comments, interactions, engagement_rate: engagement,
        avg_views_per_post: posts ? Math.round(views / posts) : 0,
        avg_interactions_per_post: posts ? Math.round(interactions / posts) : 0 }
    };
  }

  async function commitToGitHub(pat, content) {
    const apiUrl = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
    const getR = await fetch(apiUrl, { headers: { Authorization: `Bearer ${pat}`, 'User-Agent': 'ranking-synk' } });
    let sha = null;
    if (getR.ok) { const d = await getR.json(); sha = d.sha; }
    const body = { message: `chore: update data ${new Date().toISOString().slice(0, 10)}`, content: btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    const putR = await fetch(apiUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', 'User-Agent': 'ranking-synk' },
      body: JSON.stringify(body)
    });
    if (!putR.ok) throw new Error(`GitHub ${putR.status}: ${await putR.text()}`);
  }

  document.getElementById('synk-btn').onclick = async () => {
    const pat = document.getElementById('synk-pat').value.trim();
    if (!pat) { alert('Informe o GitHub Token'); return; }
    const btn = document.getElementById('synk-btn');
    btn.disabled = true; btn.textContent = '⏳ Coletando...';
    document.getElementById('synk-log').innerHTML = '';

    const results = [];
    for (let i = 0; i < CANDIDATES.length; i++) {
      const cand = CANDIDATES[i];
      log(`[${i + 1}/10] @${cand.handle}...`);
      try {
        const r = await collectUser(cand);
        results.push(r);
        log(`  ✓ ${r.stats.posts} posts · ${r.stats.views.toLocaleString('pt-BR')} views`, 'ok');
      } catch (e) {
        log(`  ✗ ${e.message}`, 'err');
        results.push({ ...cand, period: { start: '', end: '' }, stats: { posts:0,reels:0,photos:0,carousels:0,views:0,likes:0,comments:0,interactions:0,engagement_rate:0,avg_views_per_post:0,avg_interactions_per_post:0 } });
      }
      if (i < CANDIDATES.length - 1) await sleep(1200);
    }

    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    const output = {
      updated_at: now.toISOString(),
      updated_at_display: `${p(now.getDate())}/${p(now.getMonth()+1)}/${now.getFullYear()} às ${p(now.getHours())}:${p(now.getMinutes())} (BRT)`,
      candidates: results
    };

    log('Publicando no GitHub...');
    try {
      await commitToGitHub(pat, JSON.stringify(output, null, 2));
      localStorage.setItem('synk_pat', pat);
      log('✅ Publicado! Ranking atualizado.', 'ok');
      btn.textContent = '✅ Concluído';
    } catch (e) {
      log(`Erro: ${e.message}`, 'err');
      btn.disabled = false; btn.textContent = '▶ Tentar novamente';
    }
  };
})();
