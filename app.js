/* Οικογένεια — οικογενειακός σύμβουλος υγείας & σπιτιού */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sb = window.supabase.createClient(window.CFG.url, window.CFG.key);
const BUCKET = 'health-docs';
const S = { user: null, members: [], mid: localStorage.getItem('mid'), charts: [], seg: {} };

/* ---------- σταθερές ---------- */
const MOODS = ['', '😣', '🙁', '😐', '🙂', '😄'];
const MEAL_TYPES = ['πρωινό', 'δεκατιανό', 'μεσημεριανό', 'απογευματινό', 'βραδινό', 'σνακ'];
const MEAS = {
  'βάρος': 'kg', 'πίεση': 'mmHg', 'σάκχαρο': 'mg/dL', 'σφυγμοί': 'bpm',
  'περίμετρος μέσης': 'cm', 'θερμοκρασία': '°C'
};
const LAB_CATS = ['λιπίδια', 'σάκχαρο', 'νεφρικά', 'ηπατικά', 'ουρικό', 'αιματολογικά', 'σίδηρος', 'βιταμίνες', 'θυρεοειδής', 'ηλεκτρολύτες', 'άλλο'];
const LAB_NAMES = {
  'Ολική χοληστερίνη': ['λιπίδια', 'mg/dL'], 'HDL': ['λιπίδια', 'mg/dL'], 'LDL': ['λιπίδια', 'mg/dL'], 'Τριγλυκερίδια': ['λιπίδια', 'mg/dL'],
  'Γλυκόζη νηστείας': ['σάκχαρο', 'mg/dL'], 'HbA1c': ['σάκχαρο', '%'],
  'Κρεατινίνη': ['νεφρικά', 'mg/dL'], 'Ουρία': ['νεφρικά', 'mg/dL'], 'eGFR': ['νεφρικά', 'mL/min/1.73m²'],
  'Ουρικό οξύ': ['ουρικό', 'mg/dL'],
  'SGOT (AST)': ['ηπατικά', 'U/L'], 'SGPT (ALT)': ['ηπατικά', 'U/L'], 'γ-GT': ['ηπατικά', 'U/L'], 'ALP': ['ηπατικά', 'U/L'], 'Χολερυθρίνη ολική': ['ηπατικά', 'mg/dL'],
  'Αιμοσφαιρίνη': ['αιματολογικά', 'g/dL'], 'Αιματοκρίτης': ['αιματολογικά', '%'], 'Λευκά': ['αιματολογικά', 'K/μL'], 'Αιμοπετάλια': ['αιματολογικά', 'K/μL'],
  'Σίδηρος': ['σίδηρος', 'μg/dL'], 'Φερριτίνη': ['σίδηρος', 'ng/mL'],
  'Βιταμίνη D (25-OH)': ['βιταμίνες', 'ng/mL'], 'Βιταμίνη B12': ['βιταμίνες', 'pg/mL'], 'Φυλλικό οξύ': ['βιταμίνες', 'ng/mL'],
  'TSH': ['θυρεοειδής', 'μIU/mL'], 'FT4': ['θυρεοειδής', 'ng/dL'],
  'Νάτριο': ['ηλεκτρολύτες', 'mmol/L'], 'Κάλιο': ['ηλεκτρολύτες', 'mmol/L']
};
const SHOP_CATS = ['τρόφιμα', 'φρούτα & λαχανικά', 'φαρμακείο', 'καθαριστικά', 'παιδί', 'σπίτι', 'συσκευές'];

/* ---------- βοηθητικά ---------- */
const fmtDate = d => d ? new Date(d).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtDay = d => new Date(d).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = d => new Date(d).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
const fmtNum = n => n == null ? '' : Number(n).toLocaleString('el-GR', { maximumFractionDigits: 2 });
const localDT = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const localD = (d = new Date()) => localDT(d).slice(0, 10);
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const member = (id = S.mid) => S.members.find(m => m.id === id);
const num = v => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));
const nul = v => (v === '' || v == null) ? null : v;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
function fail(e) { console.error(e); toast('Κάτι πήγε στραβά: ' + (e.message || e)); }
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
function range(label, lo, hi) {
  if (lo != null && hi != null) return `${label} ${fmtNum(lo)}–${fmtNum(hi)}`;
  if (hi != null) return `${label}: έως ${fmtNum(hi)}`;
  if (lo != null) return `${label}: από ${fmtNum(lo)}`;
  return '';
}
function age(bd) { if (!bd) return ''; const b = new Date(bd), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }

/* ---------- αρχεία ---------- */
async function shrink(file, max = 1600) {
  if (!file.type.startsWith('image/')) return file;
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', .85));
}
async function upload(file, folder) {
  const blob = await shrink(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${S.user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  await q(sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type }));
  return path;
}
async function signed(path) {
  if (!path) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl;
}

/* ---------- φύλλο (dialog) ---------- */
function sheet(title, body, onSubmit, opts = {}) {
  const d = $('#sheet'), f = $('#sheetForm');
  f.innerHTML = `<h3 tabindex="-1" autofocus>${esc(title)}</h3>${body}
    <div class="actions">
      ${opts.del ? '<button type="button" class="btn danger" data-act="del">Διαγραφή</button>' : ''}
      <button type="button" class="btn ghost" data-act="close">Άκυρο</button>
      ${onSubmit ? `<button type="submit" class="btn">${esc(opts.ok || 'Αποθήκευση')}</button>` : ''}
    </div>`;
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Περιμένετε…';
    try { const keep = await onSubmit(new FormData(f), f); if (keep !== true) d.close(); }
    catch (err) { fail(err); }
    finally { btn.disabled = false; btn.textContent = opts.ok || 'Αποθήκευση'; }
  };
  f.querySelector('[data-act=close]').onclick = () => d.close();
  const del = f.querySelector('[data-act=del]');
  if (del) del.onclick = async () => { if (confirm('Σίγουρα διαγραφή;')) { try { await opts.del(); d.close(); } catch (e) { fail(e); } } };
  opts.after?.(f);
  d.showModal();
}
const opt = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const memberOpts = sel => S.members.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

/* ---------- σύνδεση ---------- */
function showLogin(mode = 'in') {
  $('.top').classList.add('hide'); $('#tabs').classList.add('hide');
  $('#view').innerHTML = `<div class="login">
    <h1>Οικογένεια</h1><p class="sub">Υγεία, διατροφή και σπίτι, όλα σε ένα μέρος.</p>
    <form class="card" id="lf">
      <label for="em">Email</label><input id="em" name="email" type="email" autocomplete="email" required>
      <label for="pw">Κωδικός</label><input id="pw" name="pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" minlength="8" required>
      <div class="actions"><button class="btn wide">${mode === 'up' ? 'Δημιουργία λογαριασμού' : 'Είσοδος'}</button></div>
      <p class="hint" style="text-align:center"><a href="#" id="sw">${mode === 'up' ? 'Έχω ήδη λογαριασμό' : 'Πρώτη φορά; Δημιουργία λογαριασμού'}</a></p>
    </form></div>`;
  $('#sw').onclick = e => { e.preventDefault(); showLogin(mode === 'up' ? 'in' : 'up'); };
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    try {
      if (mode === 'up') {
        const { data } = await sb.auth.signUp({ email: f.get('email'), password: f.get('pw'), options: { emailRedirectTo: location.origin + location.pathname } }).then(r => { if (r.error) throw r.error; return r; });
        if (!data.session) { toast('Στάλθηκε email επιβεβαίωσης. Άνοιξέ το και μετά κάνε είσοδο.'); showLogin('in'); }
      } else {
        const r = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('pw') });
        if (r.error) throw new Error('Λάθος email ή κωδικός');
      }
    } catch (err) { fail(err); }
  };
}

/* ---------- μέλη ---------- */
async function loadMembers() {
  S.members = await q(sb.from('members').select('*').order('created_at'));
  if (!member()) S.mid = S.members[0]?.id || null;
  renderMemberBar();
}
function renderMemberBar() {
  $('#memberBar').innerHTML = S.members.map(m =>
    `<button class="chip" role="tab" aria-selected="${m.id === S.mid}" data-m="${m.id}"><span class="sw" style="background:${esc(m.color || '#2f6f5e')}"></span>${esc(m.name)}</button>`
  ).join('') + `<button class="chip" data-m="+" aria-label="Προσθήκη μέλους">＋</button><button class="chip" data-m="settings" aria-label="Ρυθμίσεις">⚙︎</button>`;
  $$('#memberBar .chip').forEach(b => b.onclick = () => {
    const v = b.dataset.m;
    if (v === '+') return editMember();
    if (v === 'settings') return location.hash = '#/settings';
    S.mid = v; localStorage.setItem('mid', v); renderMemberBar(); route();
  });
}
/* λίστες επιλογών για μέλη */
const CONDITIONS = {
  child: ['Άσθμα', 'Αλλεργική ρινίτιδα', 'Ατοπική δερματίτιδα (έκζεμα)', 'Τροφική αλλεργία', 'Υποτροπιάζουσες ωτίτιδες', 'Συχνές αμυγδαλίτιδες',
    'Σιδηροπενική αναιμία', 'Δυσκοιλιότητα', 'Γαστροοισοφαγική παλινδρόμηση', 'Αυξημένο βάρος', 'Κοιλιοκάκη', 'ΔΕΠΥ', 'Διαβήτης τύπου 1', 'Πυρετικοί σπασμοί'],
  teen: ['Άσθμα', 'Αλλεργική ρινίτιδα', 'Ακμή', 'Ημικρανίες', 'Σιδηροπενική αναιμία', 'Άγχος', 'ΔΕΠΥ', 'Αυξημένο βάρος', 'Σκολίωση',
    'Κοιλιοκάκη', 'Διαβήτης τύπου 1', 'Επώδυνη περίοδος'],
  adult: ['Αλλεργική ρινίτιδα', 'Άσθμα', 'Ημικρανίες', 'Άγχος', 'Κατάθλιψη', 'Υποθυρεοειδισμός / Hashimoto', 'Σιδηροπενική αναιμία',
    'Ευερέθιστο έντερο', 'Γαστρίτιδα / παλινδρόμηση', 'Οσφυαλγία / αυχενικό', 'Υψηλή χοληστερίνη', 'Αυξημένο βάρος', 'Λιπώδες ήπαρ',
    'Ανεπάρκεια βιταμίνης D', 'Πολυκυστικές ωοθήκες', 'Ενδομητρίωση'],
  middle: ['Υπέρταση', 'Υψηλή χοληστερίνη', 'Υψηλά τριγλυκερίδια', 'Προδιαβήτης / αντίσταση στην ινσουλίνη', 'Διαβήτης τύπου 2', 'Λιπώδες ήπαρ',
    'Αυξημένο ουρικό οξύ / ουρική αρθρίτιδα', 'Υποθυρεοειδισμός / Hashimoto', 'Αυξημένο βάρος', 'Γαστρίτιδα / παλινδρόμηση',
    'Οσφυαλγία / αυχενικό', 'Άπνοια ύπνου', 'Ανεπάρκεια βιταμίνης D', 'Άγχος', 'Κατάθλιψη', 'Καλοήθης υπερπλασία προστάτη',
    'Εμμηνόπαυση', 'Οστεοπενία'],
  senior: ['Υπέρταση', 'Διαβήτης τύπου 2', 'Υψηλή χοληστερίνη', 'Στεφανιαία νόσος', 'Κολπική μαρμαρυγή', 'Καρδιακή ανεπάρκεια',
    'Χρόνια νεφρική νόσος', 'Οστεοπόρωση', 'Οστεοαρθρίτιδα', 'ΧΑΠ', 'Υποθυρεοειδισμός', 'Ανεπάρκεια βιταμίνης B12', 'Καταρράκτης',
    'Γλαύκωμα', 'Βαρηκοΐα', 'Διαταραχή μνήμης', 'Καλοήθης υπερπλασία προστάτη', 'Δυσκοιλιότητα']
};
const ONLY_SEX = { 'Πολυκυστικές ωοθήκες': 'Θ', 'Ενδομητρίωση': 'Θ', 'Εμμηνόπαυση': 'Θ', 'Οστεοπενία': 'Θ', 'Επώδυνη περίοδος': 'Θ', 'Καλοήθης υπερπλασία προστάτη': 'Α' };
const DIETS = ['Μεσογειακή', 'Χωρίς περιορισμούς', 'Χορτοφαγική', 'Vegan', 'Νηστεία (Ορθόδοξη)', 'Χαμηλή σε αλάτι', 'Χαμηλή σε ζάχαρη',
  'Χαμηλή σε κορεσμένα λιπαρά', 'Χαμηλή σε πουρίνες', 'Χαμηλή σε υδατάνθρακες', 'Υψηλή σε φυτικές ίνες', 'Υψηλή σε πρωτεΐνη',
  'Χωρίς γλουτένη', 'Χωρίς λακτόζη', 'Χωρίς χοιρινό', 'Δεν τρώει ψάρι', 'Δεν τρώει όσπρια', 'Δεν τρώει λαχανικά', 'Αποφεύγει τα πικάντικα'];
const DIETS_CHILD = ['Επιλεκτικός στο φαγητό', 'Λίγα γλυκά', 'Χωρίς αναψυκτικά', 'Ακόμα με γάλα σε μπιμπερό'];
function ageGroup(bd) {
  const a = age(bd);
  if (a === '') return null;
  return a < 13 ? 'child' : a < 18 ? 'teen' : a < 40 ? 'adult' : a < 65 ? 'middle' : 'senior';
}
const splitList = v => (v || '').split(/\s*[,;\n]\s*/).map(x => x.trim()).filter(Boolean);
/* επιλογή από λίστα: κουμπιά-ετικέτες + πεδίο «Άλλο»· γράφει στο κρυφό input name=… ως «α, β, γ» */
function picker(f, name, getOptions, initial) {
  const box = $(`[data-pick="${name}"]`, f), hidden = $(`input[name="${name}"]`, f), extra = $(`[data-extra="${name}"]`, f);
  const sel = new Set(splitList(initial));
  const sync = () => { hidden.value = [...sel, ...splitList(extra.value).filter(x => !sel.has(x))].join(', '); };
  const draw = () => {
    const opts = getOptions();
    // ό,τι έχει ήδη επιλεγεί και δεν υπάρχει στη λίστα μένει στο «Άλλο»
    const known = new Set(opts);
    const others = [...sel].filter(x => !known.has(x));
    others.forEach(x => sel.delete(x));
    extra.value = [...new Set([...splitList(extra.value), ...others])].join(', ');
    box.innerHTML = opts.map(o => `<button type="button" class="opt" aria-pressed="${sel.has(o)}">${esc(o)}</button>`).join('');
    $$('.opt', box).forEach(b => b.onclick = () => {
      const o = b.textContent; sel.has(o) ? sel.delete(o) : sel.add(o); b.setAttribute('aria-pressed', sel.has(o)); sync();
    });
    sync();
  };
  extra.oninput = sync;
  draw();
  return draw;
}
function editMember(m = {}) {
  sheet(m.id ? 'Επεξεργασία μέλους' : 'Νέο μέλος', `
    <label>Όνομα</label><input name="name" required value="${esc(m.name)}">
    <div class="two"><div><label>Σχέση</label><input name="relation" placeholder="εγώ, σύζυγος, παιδί…" value="${esc(m.relation)}"></div>
    <div><label>Φύλο</label><select name="sex"><option value=""></option>${['Α', 'Θ'].map(s => `<option ${s === m.sex ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <div class="two"><div><label>Ημ. γέννησης</label><input type="date" name="birth_date" value="${esc(m.birth_date)}"></div>
    <div><label>Ύψος (cm)</label><input name="height_cm" inputmode="decimal" value="${esc(m.height_cm)}"></div></div>
    <label>Αλλεργίες</label><input name="allergies" value="${esc(m.allergies)}" placeholder="π.χ. πενικιλίνη, γύρη, ξηροί καρποί">
    <label>Χρόνια θέματα υγείας</label>
    <p class="hint" data-agehint style="margin-top:0"></p>
    <input type="hidden" name="chronic_conditions"><div class="opts" data-pick="chronic_conditions"></div>
    <input data-extra="chronic_conditions" placeholder="Άλλο (χωρισμένα με κόμμα)">
    <label>Διατροφικές προτιμήσεις / περιορισμοί</label>
    <input type="hidden" name="diet_notes"><div class="opts" data-pick="diet_notes"></div>
    <input data-extra="diet_notes" placeholder="Άλλο (π.χ. δεν του αρέσει το ψάρι)">
    <label>Χρώμα</label><input type="color" name="color" value="${esc(m.color || '#2f6f5e')}">`,
    async f => {
      const row = { name: f.get('name').trim(), relation: nul(f.get('relation')), sex: nul(f.get('sex')), birth_date: nul(f.get('birth_date')),
        height_cm: num(f.get('height_cm')), allergies: nul(f.get('allergies')), chronic_conditions: nul(f.get('chronic_conditions')),
        diet_notes: nul(f.get('diet_notes')), color: f.get('color') };
      if (m.id) await q(sb.from('members').update(row).eq('id', m.id));
      else { const [n] = await q(sb.from('members').insert(row).select()); S.mid = n.id; localStorage.setItem('mid', n.id); }
      await loadMembers(); route(); toast('Αποθηκεύτηκε');
    }, {
      del: m.id ? async () => { await q(sb.from('members').delete().eq('id', m.id)); S.mid = null; await loadMembers(); route(); } : null,
      after: f => {
        const bd = $('[name=birth_date]', f), sx = $('[name=sex]', f), hint = $('[data-agehint]', f);
        const LABEL = { child: 'παιδιά έως 12', teen: 'εφήβους 13–17', adult: 'ενήλικες 18–39', middle: 'ηλικίες 40–64', senior: 'ηλικίες 65+' };
        const condOpts = () => {
          const g = ageGroup(bd.value);
          hint.textContent = g ? `Συχνά θέματα για ${LABEL[g]}. Πάτα όσα ισχύουν.` : 'Βάλε ημερομηνία γέννησης για λίστα ανάλογη της ηλικίας.';
          const list = g ? CONDITIONS[g] : [...new Set(Object.values(CONDITIONS).flat())];
          return list.filter(c => !ONLY_SEX[c] || !sx.value || ONLY_SEX[c] === sx.value);
        };
        const dietOpts = () => ageGroup(bd.value) === 'child' ? [...DIETS_CHILD, ...DIETS.filter(d => !['Vegan', 'Χαμηλή σε υδατάνθρακες'].includes(d))] : DIETS;
        const redrawC = picker(f, 'chronic_conditions', condOpts, m.chronic_conditions);
        const redrawD = picker(f, 'diet_notes', dietOpts, m.diet_notes);
        bd.addEventListener('change', () => { redrawC(); redrawD(); });
        sx.addEventListener('change', redrawC);
      }
    });
}

/* ---------- δρομολόγηση ---------- */
const ROUTES = { '': home, labs, meds, log: logView, shop, settings };
async function route() {
  S.charts.forEach(c => c.destroy()); S.charts = [];
  const r = (location.hash.replace(/^#\/?/, '').split('/')[0]) || '';
  $$('#tabs a').forEach(a => a.classList.toggle('on', (a.dataset.r === 'home' ? '' : a.dataset.r) === r));
  const v = $('#view'); v.classList.remove('has-fab'); v.innerHTML = '<p class="sub">Φόρτωση…</p>';
  if (!S.members.length && r !== 'settings') return onboarding();
  try { await (ROUTES[r] || home)(v); } catch (e) { v.innerHTML = `<div class="empty">Δεν φορτώθηκαν τα δεδομένα.<br>${esc(e.message)}</div>`; console.error(e); }
  window.scrollTo(0, 0);
}
function onboarding() {
  $('#view').innerHTML = `<h1>Καλώς ήρθες</h1><p class="sub">Ξεκίνα προσθέτοντας τα μέλη της οικογένειας. Ξεκίνα από εσένα.</p>
    <button class="btn wide" id="addm">Προσθήκη πρώτου μέλους</button>`;
  $('#addm').onclick = () => editMember({ relation: 'εγώ' });
}
function fab(fn, label = 'Προσθήκη') {
  $('#view').classList.add('has-fab');
  const b = document.createElement('button'); b.className = 'fab'; b.textContent = '+'; b.setAttribute('aria-label', label); b.onclick = fn;
  $('#view').append(b);
}
function segment(key, items, cb) {
  S.seg[key] = S.seg[key] || items[0][0];
  const html = `<div class="seg" role="group">${items.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${S.seg[key] === k}">${l}</button>`).join('')}</div>`;
  setTimeout(() => $$(`.seg button`).forEach(b => b.onclick = () => { S.seg[key] = b.dataset.k; cb(); }));
  return html;
}

/* ---------- ΑΡΧΙΚΗ ---------- */
async function home(v) {
  const m = member(), since = startOfDay().toISOString();
  const [medsL, logs, flags, appts, notes] = await Promise.all([
    q(sb.from('medications').select('*').eq('member_id', m.id).eq('active', true).order('name')),
    q(sb.from('med_logs').select('*').eq('member_id', m.id).gte('taken_at', since)),
    q(sb.from('v_latest_results').select('*').eq('member_id', m.id).in('flag', ['υψηλό', 'χαμηλό'])),
    q(sb.from('appointments').select('*,members(name)').gte('starts_at', new Date().toISOString()).eq('done', false).order('starts_at').limit(4)),
    q(sb.from('advisor_notes').select('*').or(`member_id.eq.${m.id},member_id.is.null`).order('created_at', { ascending: false }).limit(1))
  ]);
  const hello = new Date().getHours() < 12 ? 'Καλημέρα' : (new Date().getHours() < 18 ? 'Καλησπέρα' : 'Καλό βράδυ');
  v.innerHTML = `
    <h1>${hello}</h1>
    <p class="sub">${esc(m.name)} · ${esc(fmtDay(new Date()))}</p>
    <div class="quick">
      <button class="qbtn" data-q="meal"><span class="ic">🍽️</span><span>Φαγητό</span></button>
      <button class="qbtn" data-q="mood"><span class="ic">🙂</span><span>Διάθεση</span></button>
      <button class="qbtn" data-q="meas"><span class="ic">⚖️</span><span>Μέτρηση</span></button>
      <button class="qbtn" data-q="doc"><span class="ic">📄</span><span>Εξετάσεις</span></button>
    </div>
    <h2>Φάρμακα σήμερα</h2>
    <div class="list">${medsToday(medsL, logs) || '<div class="empty">Δεν υπάρχουν ενεργά φάρμακα.</div>'}</div>
    ${flags.length ? `<h2>Τιμές εκτός ορίων</h2><div class="list">${flags.map(labCard).join('')}</div>` : ''}
    <h2>Επόμενα ραντεβού</h2>
    <div class="list">${appts.length ? appts.map(apptCard).join('') : '<div class="empty">Κανένα προγραμματισμένο ραντεβού.</div>'}</div>
    ${notes[0] ? `<h2>Από τον σύμβουλο</h2><div class="card"><div class="title">${esc(notes[0].title)}</div>
      <div class="meta">${fmtDate(notes[0].created_at)}</div><p style="white-space:pre-wrap;margin:8px 0 0;overflow-wrap:anywhere">${esc(notes[0].body)}</p></div>` : ''}
    <button class="btn ghost wide" id="addAppt" style="margin-top:8px">＋ Νέο ραντεβού / εξέταση / εμβόλιο</button>`;
  $$('.qbtn').forEach(b => b.onclick = () => ({ meal: addMeal, mood: addMood, meas: addMeasure, doc: addDoc })[b.dataset.q]());
  bindMedChecks(v, medsL, logs);
  bindLabCards(v);
  $$('[data-appt]').forEach(c => c.onclick = () => editAppt(appts.find(a => a.id === c.dataset.appt)));
  $('#addAppt').onclick = () => editAppt();
}
function medsToday(list, logs) {
  return list.map(md => {
    const slots = md.times?.length ? md.times : [''];
    const n = logs.filter(l => l.medication_id === md.id && l.status === 'πάρθηκε').length;
    const allDone = n >= slots.length;
    return `<div class="card row ${allDone ? 'done' : ''}">
      <div class="grow"><div class="title">${esc(md.name)} ${md.dose ? `<span class="meta">· ${esc(md.dose)}</span>` : ''}</div>
      <div class="meta">${esc(md.schedule || slots.filter(Boolean).join(', ') || '')}</div></div>
      <div class="row" style="gap:6px;flex:0 0 auto">${slots.map((t, i) =>
        `<button class="check ${i < n ? 'on' : ''}" data-med="${md.id}" data-i="${i}" aria-label="${esc(md.name)} ${esc(t)}" title="${esc(t)}">${i < n ? '✓' : ''}</button>`).join('')}</div>
    </div>`;
  }).join('');
}
function bindMedChecks(v, medsL, logs) {
  $$('[data-med]', v).forEach(b => b.onclick = async () => {
    try {
      const mine = logs.filter(l => l.medication_id === b.dataset.med).sort((a, c) => c.taken_at.localeCompare(a.taken_at));
      if (b.classList.contains('on')) await q(sb.from('med_logs').delete().eq('id', mine[0].id));
      else await q(sb.from('med_logs').insert({ medication_id: b.dataset.med, member_id: S.mid }));
      route();
    } catch (e) { fail(e); }
  });
}
function apptCard(a) {
  return `<div class="card row" data-appt="${a.id}" style="cursor:pointer">
    <div class="grow"><div class="title">${esc(a.title)}</div>
    <div class="meta">${esc(fmtDate(a.starts_at))} · ${esc(fmtTime(a.starts_at))}${a.members ? ' · ' + esc(a.members.name) : ''}${a.doctor ? ' · ' + esc(a.doctor) : ''}</div></div>
    <span class="badge b-info">${esc(a.kind)}</span></div>`;
}
function editAppt(a = {}) {
  sheet(a.id ? 'Ραντεβού' : 'Νέο ραντεβού', `
    <label>Τίτλος</label><input name="title" required value="${esc(a.title)}" placeholder="π.χ. Παθολόγος, αιματολογικές">
    <div class="two"><div><label>Είδος</label><select name="kind">${opt(['ραντεβού', 'εξετάσεις', 'εμβόλιο', 'επανέλεγχος'], a.kind)}</select></div>
    <div><label>Για</label><select name="member_id">${memberOpts(a.member_id || S.mid)}</select></div></div>
    <label>Ημερομηνία & ώρα</label><input type="datetime-local" name="starts_at" required value="${a.starts_at ? localDT(new Date(a.starts_at)) : ''}">
    <div class="two"><div><label>Γιατρός</label><input name="doctor" value="${esc(a.doctor)}"></div>
    <div><label>Τοποθεσία</label><input name="location" value="${esc(a.location)}"></div></div>
    <label>Σημειώσεις</label><textarea name="notes">${esc(a.notes)}</textarea>
    ${a.id ? `<label><input type="checkbox" name="done" ${a.done ? 'checked' : ''} style="width:auto;min-height:0"> Ολοκληρώθηκε</label>` : ''}
    <p class="hint">Για να μπει και στο Google Calendar, πες στο Claude «πέρασε τα ραντεβού στο ημερολόγιο».</p>`,
    async f => {
      const row = { title: f.get('title'), kind: f.get('kind'), member_id: f.get('member_id'), starts_at: new Date(f.get('starts_at')).toISOString(),
        doctor: nul(f.get('doctor')), location: nul(f.get('location')), notes: nul(f.get('notes')), done: f.get('done') === 'on' };
      if (a.id) await q(sb.from('appointments').update(row).eq('id', a.id)); else await q(sb.from('appointments').insert(row));
      toast('Αποθηκεύτηκε'); route();
    }, { del: a.id ? async () => { await q(sb.from('appointments').delete().eq('id', a.id)); route(); } : null });
}

/* ---------- ΕΞΕΤΑΣΕΙΣ ---------- */
function labCard(r) {
  const val = r.value != null ? fmtNum(r.value) : esc(r.value_text || '—');
  const b = r.flag === 'υψηλό' ? '<span class="badge b-hi">↑ υψηλό</span>' : r.flag === 'χαμηλό' ? '<span class="badge b-lo">↓ χαμηλό</span>' : r.flag === 'εντός' ? '<span class="badge b-ok">εντός</span>' : '';
  const ref = range('όρια', r.ref_low, r.ref_high);
  return `<div class="card row" data-lab="${esc(r.test_name)}" style="cursor:pointer">
    <div class="grow"><div class="title">${esc(r.test_name)}</div><div class="meta">${esc(fmtDate(r.test_date))}${ref ? ' · ' + ref : ''}</div></div>
    <div style="text-align:right;flex:0 0 auto"><div class="big">${val}<span class="unit">${esc(r.unit || '')}</span></div>${b}</div></div>`;
}
function bindLabCards(v) { $$('[data-lab]', v).forEach(c => c.onclick = () => labDetail(c.dataset.lab)); }

async function labs(v) {
  const m = member();
  const draw = async () => {
    if (S.seg.labs === 'docs') {
      const docs = await q(sb.from('documents').select('*').eq('member_id', m.id).order('doc_date', { ascending: false }));
      v.innerHTML = head() + (docs.length ? `<div class="list">${docs.map(d => `<div class="card row" data-doc="${d.id}" style="cursor:pointer">
        <div style="font-size:26px;flex:0 0 auto">${/\.pdf$/i.test(d.storage_path || '') ? '📄' : '🖼️'}</div>
        <div class="grow"><div class="title">${esc(d.title)}</div><div class="meta">${esc(fmtDate(d.doc_date))} · ${esc(d.kind)}${d.source ? ' · ' + esc(d.source) : ''}</div>
        <div style="margin-top:6px">${d.processed ? '<span class="badge b-ok">τιμές καταχωρήθηκαν</span>' : '<span class="badge b-warn">αναμένει καταχώρηση</span>'}</div></div></div>`).join('')}</div>`
        : '<div class="empty">Ανέβασε PDF από το myHealth ή φωτογραφία από χαρτί εξετάσεων.</div>');
      $$('[data-doc]').forEach(c => c.onclick = () => openDoc(docs.find(d => d.id === c.dataset.doc)));
    } else {
      const rows = await q(sb.from('v_latest_results').select('*').eq('member_id', m.id).order('test_name'));
      const by = {}; rows.forEach(r => (by[r.category || 'άλλο'] ||= []).push(r));
      v.innerHTML = head() + (rows.length ? LAB_CATS.filter(c => by[c]).concat(Object.keys(by).filter(c => !LAB_CATS.includes(c)))
        .map(c => `<h2 style="text-transform:capitalize">${esc(c)}</h2><div class="list">${by[c].map(labCard).join('')}</div>`).join('')
        : '<div class="empty">Δεν υπάρχουν ακόμη αποτελέσματα. Ανέβασε εξετάσεις ή πρόσθεσε μια τιμή.</div>');
      bindLabCards(v);
    }
    fab(() => sheet('Προσθήκη', `<div class="actions" style="flex-direction:column">
        <button type="button" class="btn" id="o1">📄 Ανέβασμα PDF / φωτογραφίας εξετάσεων</button>
        <button type="button" class="btn ghost" id="o2">✏️ Καταχώρηση τιμής με το χέρι</button></div>`, null,
      { after: f => { $('#o1', f).onclick = () => { $('#sheet').close(); addDoc(); }; $('#o2', f).onclick = () => { $('#sheet').close(); addLab(); }; } }));
  };
  const head = () => `<h1>Εξετάσεις</h1><p class="sub">${esc(m.name)}</p>` + segment('labs', [['latest', 'Τελευταίες τιμές'], ['docs', 'Έγγραφα']], draw);
  await draw();
}
async function labDetail(name) {
  const rows = await q(sb.from('lab_results').select('*').eq('member_id', S.mid).eq('test_name', name).order('test_date'));
  const tgt = (await q(sb.from('targets').select('*').eq('member_id', S.mid).eq('test_name', name)))[0];
  sheet(name, `
    <div class="chart-wrap"><canvas id="lc" aria-label="Γράφημα ${esc(name)}"></canvas></div>
    ${tgt ? `<p class="hint">🎯 ${range('Στόχος', tgt.target_low, tgt.target_high)} ${esc(tgt.unit || '')}${tgt.set_by ? ' (' + esc(tgt.set_by) + ')' : ''}</p>` : ''}
    <div class="list" style="margin-top:12px">${rows.slice().reverse().map(r => `<div class="card row" data-r="${r.id}" style="cursor:pointer">
      <div class="grow"><div class="title">${esc(fmtDate(r.test_date))}</div><div class="meta">${esc(r.lab || '')}</div></div>
      <div class="big">${r.value != null ? fmtNum(r.value) : esc(r.value_text)}<span class="unit">${esc(r.unit || '')}</span></div></div>`).join('')}</div>
    <button type="button" class="btn ghost wide" id="tg">🎯 ${tgt ? 'Αλλαγή' : 'Ορισμός'} στόχου</button>`, null, {
    after: f => {
      const pts = rows.filter(r => r.value != null), last = rows[rows.length - 1] || {};
      if (pts.length && window.Chart) {
        const css = getComputedStyle(document.documentElement), green = css.getPropertyValue('--green-2').trim(), muted = css.getPropertyValue('--muted').trim();
        const ds = [{ label: name, data: pts.map(r => r.value), borderColor: green, backgroundColor: green, tension: .25, pointRadius: 4 }];
        if (last.ref_high != null) ds.push({ label: 'Ανώτ. όριο', data: pts.map(() => last.ref_high), borderColor: '#c0564b', borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5 });
        if (last.ref_low != null) ds.push({ label: 'Κατώτ. όριο', data: pts.map(() => last.ref_low), borderColor: '#c08a3a', borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5 });
        S.charts.push(new Chart($('#lc', f), { type: 'line', data: { labels: pts.map(r => new Date(r.test_date).toLocaleDateString('el-GR', { month: 'short', year: '2-digit' })), datasets: ds },
          options: { maintainAspectRatio: false, plugins: { legend: { display: ds.length > 1, labels: { color: muted, boxWidth: 12 } } },
            scales: { x: { ticks: { color: muted, maxRotation: 0, autoSkip: true } }, y: { ticks: { color: muted } } } } }));
      } else $('.chart-wrap', f).innerHTML = '<div class="empty">Χρειάζονται αριθμητικές τιμές για γράφημα.</div>';
      $$('[data-r]', f).forEach(c => c.onclick = () => { $('#sheet').close(); addLab(rows.find(r => r.id === c.dataset.r)); });
      $('#tg', f).onclick = () => { $('#sheet').close(); editTarget(name, tgt, last.unit); };
    }
  });
}
function editTarget(name, t = {}, unit) {
  sheet('Στόχος · ' + name, `<div class="two"><div><label>Από</label><input name="lo" inputmode="decimal" value="${esc(t?.target_low)}"></div>
    <div><label>Έως</label><input name="hi" inputmode="decimal" value="${esc(t?.target_high)}"></div></div>
    <label>Ορίστηκε από</label><select name="by">${opt(['γιατρός', 'εγώ'], t?.set_by)}</select>
    <label>Σημείωση</label><input name="notes" value="${esc(t?.notes)}">`,
    async f => {
      await q(sb.from('targets').upsert({ member_id: S.mid, test_name: name, target_low: num(f.get('lo')), target_high: num(f.get('hi')), unit, set_by: f.get('by'), notes: nul(f.get('notes')) }, { onConflict: 'member_id,test_name' }));
      toast('Ο στόχος αποθηκεύτηκε'); route();
    });
}
function addLab(r = {}) {
  sheet(r.id ? 'Επεξεργασία τιμής' : 'Νέα τιμή εξέτασης', `
    <label>Εξέταση</label><input name="test_name" list="labnames" required value="${esc(r.test_name)}">
    <datalist id="labnames">${Object.keys(LAB_NAMES).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="two"><div><label>Τιμή</label><input name="value" inputmode="decimal" value="${esc(r.value ?? r.value_text)}"></div>
    <div><label>Μονάδα</label><input name="unit" value="${esc(r.unit)}"></div></div>
    <div class="two"><div><label>Κατώτερο όριο</label><input name="ref_low" inputmode="decimal" value="${esc(r.ref_low)}"></div>
    <div><label>Ανώτερο όριο</label><input name="ref_high" inputmode="decimal" value="${esc(r.ref_high)}"></div></div>
    <div class="two"><div><label>Ημερομηνία</label><input type="date" name="test_date" required value="${esc(r.test_date || localD())}"></div>
    <div><label>Κατηγορία</label><select name="category">${opt(LAB_CATS, r.category || 'άλλο')}</select></div></div>
    <label>Εργαστήριο</label><input name="lab" value="${esc(r.lab)}">`,
    async f => {
      const v = f.get('value'), n = num(v);
      const row = { member_id: r.member_id || S.mid, test_name: f.get('test_name').trim(), category: f.get('category'), unit: nul(f.get('unit')),
        value: Number.isFinite(n) ? n : null, value_text: Number.isFinite(n) ? null : nul(v), ref_low: num(f.get('ref_low')), ref_high: num(f.get('ref_high')),
        test_date: f.get('test_date'), lab: nul(f.get('lab')) };
      if (r.id) await q(sb.from('lab_results').update(row).eq('id', r.id)); else await q(sb.from('lab_results').insert(row));
      toast('Αποθηκεύτηκε'); route();
    }, {
      del: r.id ? async () => { await q(sb.from('lab_results').delete().eq('id', r.id)); route(); } : null,
      after: f => {
        const tn = $('[name=test_name]', f);
        tn.onchange = () => { const k = LAB_NAMES[tn.value]; if (k) { $('[name=category]', f).value = k[0]; if (!$('[name=unit]', f).value) $('[name=unit]', f).value = k[1]; } };
      }
    });
}
function addDoc() {
  sheet('Ανέβασμα εξετάσεων', `
    <label>Αρχείο (PDF ή φωτογραφία)</label><input type="file" name="file" accept="application/pdf,image/*" required>
    <label>Τίτλος</label><input name="title" placeholder="π.χ. Αιματολογικές Νοεμβρίου" required>
    <div class="two"><div><label>Ημερομηνία</label><input type="date" name="doc_date" value="${localD()}"></div>
    <div><label>Για</label><select name="member_id">${memberOpts(S.mid)}</select></div></div>
    <div class="two"><div><label>Είδος</label><select name="kind">${opt(['εξετάσεις', 'συνταγή', 'γνωμάτευση', 'απεικόνιση', 'άλλο'])}</select></div>
    <div><label>Πηγή</label><select name="source">${opt(['myHealth', 'μικροβιολογικό', 'γιατρός', 'φωτογραφία', 'άλλο'])}</select></div></div>
    <p class="hint">Μετά πες στο Claude «πέρασε τις νέες εξετάσεις». Θα διαβάσει το αρχείο και θα καταχωρήσει όλες τις τιμές.</p>`,
    async f => {
      const path = await upload(f.get('file'), 'docs');
      await q(sb.from('documents').insert({ member_id: f.get('member_id'), title: f.get('title'), doc_date: f.get('doc_date'), kind: f.get('kind'), source: f.get('source'), storage_path: path }));
      toast('Ανέβηκε'); S.seg.labs = 'docs'; if (location.hash !== '#/labs') location.hash = '#/labs'; else route();
    }, { ok: 'Ανέβασμα' });
}
async function openDoc(d) {
  const url = await signed(d.storage_path);
  sheet(d.title, `<p class="meta">${esc(fmtDate(d.doc_date))} · ${esc(d.kind)} · ${esc(d.source || '')}</p>
    ${url && !/\.pdf$/i.test(d.storage_path) ? `<img src="${esc(url)}" alt="${esc(d.title)}" style="width:100%;border-radius:12px;margin-top:8px">` : ''}
    ${url ? `<a class="btn wide" style="display:block;text-align:center;text-decoration:none;margin-top:12px" href="${esc(url)}" target="_blank" rel="noopener">Άνοιγμα αρχείου</a>` : ''}
    ${d.notes ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(d.notes)}</p>` : ''}`, null,
    { del: async () => { if (d.storage_path) await sb.storage.from(BUCKET).remove([d.storage_path]); await q(sb.from('documents').delete().eq('id', d.id)); route(); } });
}

/* ---------- ΦΑΡΜΑΚΑ ---------- */
async function meds(v) {
  const m = member();
  const [all, logs] = await Promise.all([
    q(sb.from('medications').select('*').eq('member_id', m.id).order('active', { ascending: false }).order('name')),
    q(sb.from('med_logs').select('*').eq('member_id', m.id).gte('taken_at', startOfDay().toISOString()))
  ]);
  const act = all.filter(x => x.active), old = all.filter(x => !x.active);
  v.innerHTML = `<h1>Φάρμακα</h1><p class="sub">${esc(m.name)} · πάτα τον κύκλο όταν παίρνεις τη δόση</p>
    <div class="list">${medsToday(act, logs) || '<div class="empty">Δεν υπάρχουν ενεργά φάρμακα.</div>'}</div>
    <h2>Λεπτομέρειες</h2><div class="list">${act.map(medRow).join('')}</div>
    ${old.length ? `<h2>Παλαιότερα</h2><div class="list">${old.map(medRow).join('')}</div>` : ''}
    <p class="hint">Για υπενθυμίσεις στο κινητό, πες στο Claude «βάλε υπενθυμίσεις για τα φάρμακα».</p>`;
  bindMedChecks(v, act, logs);
  $$('[data-edit]', v).forEach(c => c.onclick = () => editMed(all.find(x => x.id === c.dataset.edit)));
  fab(() => editMed(), 'Νέο φάρμακο');
}
const medRow = x => `<div class="card row" data-edit="${x.id}" style="cursor:pointer">
  <div class="grow"><div class="title">${esc(x.name)}</div>
  <div class="meta">${[x.dose, x.schedule, x.reason, x.start_date && 'από ' + fmtDate(x.start_date), x.end_date && 'έως ' + fmtDate(x.end_date)].filter(Boolean).map(esc).join(' · ')}</div></div>
  ${x.active ? '<span class="badge b-ok">ενεργό</span>' : '<span class="badge b-info">σταμάτησε</span>'}</div>`;
function editMed(x = {}) {
  sheet(x.id ? 'Επεξεργασία φαρμάκου' : 'Νέο φάρμακο', `
    <label>Όνομα</label><input name="name" required value="${esc(x.name)}">
    <div class="two"><div><label>Δόση</label><input name="dose" placeholder="π.χ. 10 mg" value="${esc(x.dose)}"></div>
    <div><label>Για</label><select name="member_id">${memberOpts(x.member_id || S.mid)}</select></div></div>
    <label>Οδηγίες</label><input name="schedule" placeholder="π.χ. 1 το πρωί μετά το φαγητό" value="${esc(x.schedule)}">
    <label>Ώρες λήψης (χωρισμένες με κόμμα)</label><input name="times" placeholder="08:00, 20:00" value="${esc((x.times || []).join(', '))}">
    <div class="two"><div><label>Αιτία</label><input name="reason" value="${esc(x.reason)}"></div>
    <div><label>Γιατρός</label><input name="prescribed_by" value="${esc(x.prescribed_by)}"></div></div>
    <div class="two"><div><label>Έναρξη</label><input type="date" name="start_date" value="${esc(x.start_date || localD())}"></div>
    <div><label>Λήξη</label><input type="date" name="end_date" value="${esc(x.end_date)}"></div></div>
    <label><input type="checkbox" name="active" ${x.active === false ? '' : 'checked'} style="width:auto;min-height:0"> Ενεργό</label>
    <label>Σημειώσεις</label><textarea name="notes">${esc(x.notes)}</textarea>`,
    async f => {
      const times = f.get('times').split(',').map(s => s.trim()).filter(Boolean);
      const row = { name: f.get('name'), dose: nul(f.get('dose')), member_id: f.get('member_id'), schedule: nul(f.get('schedule')), times: times.length ? times : null,
        reason: nul(f.get('reason')), prescribed_by: nul(f.get('prescribed_by')), start_date: nul(f.get('start_date')), end_date: nul(f.get('end_date')),
        active: f.get('active') === 'on', notes: nul(f.get('notes')) };
      if (x.id) await q(sb.from('medications').update(row).eq('id', x.id)); else await q(sb.from('medications').insert(row));
      toast('Αποθηκεύτηκε'); route();
    }, { del: x.id ? async () => { await q(sb.from('medications').delete().eq('id', x.id)); route(); } : null });
}

/* ---------- ΗΜΕΡΟΛΟΓΙΟ ---------- */
async function logView(v) {
  const m = member(), since = new Date(Date.now() - 30 * 864e5).toISOString();
  const draw = async () => {
    const k = S.seg.log;
    const [meals, moods, meas] = await Promise.all([
      k === 'all' || k === 'meal' ? q(sb.from('meals').select('*').eq('member_id', m.id).gte('eaten_at', since).order('eaten_at', { ascending: false })) : [],
      k === 'all' || k === 'mood' ? q(sb.from('wellbeing').select('*').eq('member_id', m.id).gte('logged_at', since).order('logged_at', { ascending: false })) : [],
      k === 'all' || k === 'meas' ? q(sb.from('measurements').select('*').eq('member_id', m.id).gte('measured_at', since).order('measured_at', { ascending: false })) : []
    ]);
    const items = [
      ...meals.map(x => ({ t: x.eaten_at, type: 'meal', x })), ...moods.map(x => ({ t: x.logged_at, type: 'mood', x })), ...meas.map(x => ({ t: x.measured_at, type: 'meas', x }))
    ].sort((a, b) => b.t.localeCompare(a.t));
    const days = {}; items.forEach(i => (days[localD(new Date(i.t))] ||= []).push(i));
    v.innerHTML = `<h1>Ημερολόγιο</h1><p class="sub">${esc(m.name)} · τελευταίες 30 ημέρες</p>` +
      segment('log', [['all', 'Όλα'], ['meal', 'Φαγητό'], ['mood', 'Διάθεση'], ['meas', 'Μετρήσεις']], draw) +
      (k === 'meas' ? '<div class="card"><div class="chart-wrap"><canvas id="mc"></canvas></div><p class="hint" id="mch"></p></div>' : '') +
      (items.length ? Object.entries(days).map(([d, arr]) => `<h2>${esc(fmtDay(d))}</h2><div class="list">${arr.map(logCard).join('')}</div>`).join('')
        : '<div class="empty">Τίποτα ακόμη. Πάτα + για καταγραφή.</div>');
    $$('[data-log]', v).forEach(c => c.onclick = () => {
      const it = items.find(i => i.x.id === c.dataset.log); ({ meal: addMeal, mood: addMood, meas: addMeasure })[it.type](it.x);
    });
    $$('img[data-p]', v).forEach(async im => { im.src = await signed(im.dataset.p) || ''; });
    if (k === 'meas') measChart(meas);
    fab(() => sheet('Καταγραφή', `<div class="actions" style="flex-direction:column">
      <button type="button" class="btn" data-o="meal">🍽️ Φαγητό</button><button type="button" class="btn ghost" data-o="mood">🙂 Πώς νιώθω</button>
      <button type="button" class="btn ghost" data-o="meas">⚖️ Μέτρηση</button></div>`, null,
      { after: f => $$('[data-o]', f).forEach(b => b.onclick = () => { $('#sheet').close(); ({ meal: addMeal, mood: addMood, meas: addMeasure })[b.dataset.o](); }) }));
  };
  S.seg.log ||= 'all';
  await draw();
}
function logCard(i) {
  const x = i.x;
  if (i.type === 'meal') return `<div class="card row" data-log="${x.id}" style="cursor:pointer">
    ${x.photo_path ? `<img class="thumb" data-p="${esc(x.photo_path)}" alt="">` : '<div class="thumb" style="display:grid;place-items:center;font-size:24px">🍽️</div>'}
    <div class="grow"><div class="title">${esc(x.meal_type || 'Γεύμα')} · ${esc(fmtTime(x.eaten_at))}</div>
    <div class="meta">${esc(x.description || '')}</div>
    ${x.analyzed ? `<div class="meta">${[x.kcal && fmtNum(x.kcal) + ' kcal', x.carbs_g && 'Υδ/κες ' + fmtNum(x.carbs_g) + 'g', x.sat_fat_g && 'Κορεσμ. ' + fmtNum(x.sat_fat_g) + 'g', x.purines && 'πουρίνες ' + x.purines].filter(Boolean).map(esc).join(' · ')}</div>
      ${x.advisor_note ? `<div class="meta" style="color:var(--green-2)">💬 ${esc(x.advisor_note)}</div>` : ''}` : '<span class="badge b-warn">αναμένει ανάλυση</span>'}</div></div>`;
  if (i.type === 'mood') return `<div class="card row" data-log="${x.id}" style="cursor:pointer">
    <div style="font-size:30px;flex:0 0 auto">${MOODS[x.mood] || '📝'}</div>
    <div class="grow"><div class="title">Διάθεση · ${esc(fmtTime(x.logged_at))}</div>
    <div class="meta">${[x.energy && 'ενέργεια ' + x.energy + '/5', x.sleep_hours && 'ύπνος ' + fmtNum(x.sleep_hours) + 'ω', x.symptoms].filter(Boolean).map(esc).join(' · ')}</div>
    ${x.notes ? `<div class="meta">${esc(x.notes)}</div>` : ''}</div></div>`;
  return `<div class="card row" data-log="${x.id}" style="cursor:pointer">
    <div class="grow"><div class="title" style="text-transform:capitalize">${esc(x.kind)}</div><div class="meta">${esc(fmtTime(x.measured_at))}${x.context ? ' · ' + esc(x.context) : ''}</div></div>
    <div class="big">${fmtNum(x.value)}${x.value2 != null ? '/' + fmtNum(x.value2) : ''}<span class="unit">${esc(x.unit || '')}</span></div></div>`;
}
function measChart(meas) {
  const kinds = [...new Set(meas.map(x => x.kind))];
  if (!kinds.length || !window.Chart) { $('#mc')?.closest('.card')?.remove(); return; }
  const kind = S.seg.mkind && kinds.includes(S.seg.mkind) ? S.seg.mkind : kinds[0];
  const pts = meas.filter(x => x.kind === kind).reverse();
  const css = getComputedStyle(document.documentElement), green = css.getPropertyValue('--green-2').trim(), muted = css.getPropertyValue('--muted').trim();
  const ds = [{ label: kind, data: pts.map(x => x.value), borderColor: green, backgroundColor: green, tension: .25 }];
  if (kind === 'πίεση') ds.push({ label: 'διαστολική', data: pts.map(x => x.value2), borderColor: '#c08a3a', backgroundColor: '#c08a3a', tension: .25 });
  S.charts.push(new Chart($('#mc'), { type: 'line', data: { labels: pts.map(x => new Date(x.measured_at).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })), datasets: ds },
    options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: muted, boxWidth: 12 } } }, scales: { x: { ticks: { color: muted, maxRotation: 0 } }, y: { ticks: { color: muted } } } } }));
  $('#mch').innerHTML = kinds.map(k => `<button type="button" class="btn small ${k === kind ? '' : 'ghost'}" data-mk="${esc(k)}" style="margin:4px 4px 0 0">${esc(k)}</button>`).join('');
  $$('[data-mk]').forEach(b => b.onclick = () => { S.seg.mkind = b.dataset.mk; route(); });
}
function addMeal(x = {}) {
  const h = new Date().getHours();
  const guess = h < 10 ? 'πρωινό' : h < 12 ? 'δεκατιανό' : h < 16 ? 'μεσημεριανό' : h < 19 ? 'απογευματινό' : 'βραδινό';
  sheet(x.id ? 'Γεύμα' : 'Τι έφαγες;', `
    <label>Φωτογραφία (προαιρετικά)</label><input type="file" name="photo" accept="image/*" capture="environment">
    <label>Περιγραφή</label><textarea name="description" placeholder="π.χ. φακές, ψωμί ολικής, φέτα, σαλάτα">${esc(x.description)}</textarea>
    <div class="two"><div><label>Γεύμα</label><select name="meal_type">${opt(MEAL_TYPES, x.meal_type || guess)}</select></div>
    <div><label>Για</label><select name="member_id">${memberOpts(x.member_id || S.mid)}</select></div></div>
    <label>Πότε</label><input type="datetime-local" name="eaten_at" value="${localDT(x.eaten_at ? new Date(x.eaten_at) : new Date())}">
    <p class="hint">Τα θρεπτικά (θερμίδες, υδατάνθρακες, λιπαρά, πουρίνες) τα υπολογίζει το Claude όταν του πεις «ανάλυσε τα γεύματα».</p>`,
    async f => {
      const file = f.get('photo');
      const row = { description: nul(f.get('description')), meal_type: f.get('meal_type'), member_id: f.get('member_id'), eaten_at: new Date(f.get('eaten_at')).toISOString() };
      if (file && file.size) { row.photo_path = await upload(file, 'meals'); row.analyzed = false; }
      if (!row.description && !row.photo_path && !x.photo_path) throw new Error('Γράψε τι έφαγες ή βάλε φωτογραφία');
      if (x.id) { if (row.description !== x.description) row.analyzed = false; await q(sb.from('meals').update(row).eq('id', x.id)); }
      else await q(sb.from('meals').insert(row));
      toast('Καταγράφηκε'); route();
    }, { del: x.id ? async () => { if (x.photo_path) await sb.storage.from(BUCKET).remove([x.photo_path]); await q(sb.from('meals').delete().eq('id', x.id)); route(); } : null });
}
const scale = (name, val, icons) => `<div class="scale">${[1, 2, 3, 4, 5].map(i =>
  `<label><input type="radio" name="${name}" value="${i}" ${+val === i ? 'checked' : ''}><span>${icons ? icons[i] : i}</span></label>`).join('')}</div>`;
function addMood(x = {}) {
  sheet(x.id ? 'Διάθεση' : 'Πώς νιώθεις;', `
    <label>Διάθεση</label>${scale('mood', x.mood, MOODS)}
    <label>Ενέργεια</label>${scale('energy', x.energy)}
    <div class="two"><div><label>Ύπνος (ώρες)</label><input name="sleep_hours" inputmode="decimal" value="${esc(x.sleep_hours)}"></div>
    <div><label>Για</label><select name="member_id">${memberOpts(x.member_id || S.mid)}</select></div></div>
    <label>Συμπτώματα</label><input name="symptoms" placeholder="π.χ. πονοκέφαλος, φούσκωμα" value="${esc(x.symptoms)}">
    <label>Σημειώσεις</label><textarea name="notes" placeholder="Ό,τι θέλεις να θυμάται ο σύμβουλος">${esc(x.notes)}</textarea>`,
    async f => {
      const row = { mood: num(f.get('mood')), energy: num(f.get('energy')), sleep_hours: num(f.get('sleep_hours')), member_id: f.get('member_id'),
        symptoms: nul(f.get('symptoms')), notes: nul(f.get('notes')) };
      if (x.id) await q(sb.from('wellbeing').update(row).eq('id', x.id)); else await q(sb.from('wellbeing').insert(row));
      toast('Καταγράφηκε'); route();
    }, { del: x.id ? async () => { await q(sb.from('wellbeing').delete().eq('id', x.id)); route(); } : null });
}
function addMeasure(x = {}) {
  sheet(x.id ? 'Μέτρηση' : 'Νέα μέτρηση', `
    <div class="two"><div><label>Είδος</label><select name="kind">${opt(Object.keys(MEAS), x.kind || 'βάρος')}</select></div>
    <div><label>Για</label><select name="member_id">${memberOpts(x.member_id || S.mid)}</select></div></div>
    <div class="two"><div><label id="l1">Τιμή</label><input name="value" inputmode="decimal" required value="${esc(x.value)}"></div>
    <div id="v2w"><label>Διαστολική</label><input name="value2" inputmode="decimal" value="${esc(x.value2)}"></div></div>
    <label>Συνθήκες</label><input name="context" list="ctx" value="${esc(x.context)}" placeholder="νηστεία, μετά φαγητού, πρωί…">
    <datalist id="ctx"><option value="νηστεία"><option value="2 ώρες μετά φαγητού"><option value="πρωί"><option value="βράδυ"></datalist>
    <label>Πότε</label><input type="datetime-local" name="measured_at" value="${localDT(x.measured_at ? new Date(x.measured_at) : new Date())}">`,
    async f => {
      const row = { kind: f.get('kind'), member_id: f.get('member_id'), value: num(f.get('value')), value2: f.get('kind') === 'πίεση' ? num(f.get('value2')) : null,
        unit: MEAS[f.get('kind')], context: nul(f.get('context')), measured_at: new Date(f.get('measured_at')).toISOString() };
      if (x.id) await q(sb.from('measurements').update(row).eq('id', x.id)); else await q(sb.from('measurements').insert(row));
      toast('Καταγράφηκε'); route();
    }, {
      del: x.id ? async () => { await q(sb.from('measurements').delete().eq('id', x.id)); route(); } : null,
      after: f => {
        const k = $('[name=kind]', f), up = () => { const p = k.value === 'πίεση'; $('#v2w', f).style.visibility = p ? 'visible' : 'hidden'; $('#l1', f).textContent = p ? 'Συστολική' : `Τιμή (${MEAS[k.value]})`; };
        k.onchange = up; up();
      }
    });
}

/* ---------- ΑΓΟΡΕΣ ---------- */
async function shop(v) {
  const draw = async () => {
    if (S.seg.shop === 'home') {
      const items = await q(sb.from('household_items').select('*').order('status').order('name'));
      v.innerHTML = head() + (items.length ? ['θέλουμε', 'σε έρευνα', 'έχουμε'].filter(s => items.some(i => i.status === s)).map(s =>
        `<h2 style="text-transform:capitalize">${s}</h2><div class="list">${items.filter(i => i.status === s).map(i => `<div class="card row" data-h="${i.id}" style="cursor:pointer">
          <div class="grow"><div class="title">${esc(i.name)}</div><div class="meta">${[i.brand, i.model, i.category, i.warranty_until && 'εγγύηση έως ' + fmtDate(i.warranty_until)].filter(Boolean).map(esc).join(' · ')}</div>
          ${i.notes ? `<div class="meta">${esc(i.notes)}</div>` : ''}</div>${i.price != null ? `<div class="big">${fmtNum(i.price)}<span class="unit">€</span></div>` : ''}</div>`).join('')}</div>`).join('')
        : '<div class="empty">Κατέγραψε τις συσκευές του σπιτιού (εγγυήσεις) ή όσες σκέφτεστε να αγοράσετε.</div>');
      $$('[data-h]', v).forEach(c => c.onclick = () => editHome(items.find(i => i.id === c.dataset.h)));
      fab(() => editHome(), 'Νέα συσκευή');
    } else {
      const items = await q(sb.from('shopping_items').select('*,members(name)').neq('status', 'ακυρώθηκε').order('created_at', { ascending: false }));
      const need = items.filter(i => i.status === 'χρειάζεται'), got = items.filter(i => i.status === 'αγοράστηκε').slice(0, 15);
      const by = {}; need.forEach(i => (by[i.category || 'τρόφιμα'] ||= []).push(i));
      const total = need.reduce((s, i) => s + (Number(i.best_price) || 0), 0);
      v.innerHTML = head() + (need.length ? `${total ? `<p class="sub">Εκτιμώμενο σύνολο: <b>${fmtNum(total)} €</b></p>` : ''}` +
        Object.entries(by).map(([c, arr]) => `<h2 style="text-transform:capitalize">${esc(c)}</h2><div class="list">${arr.map(shopRow).join('')}</div>`).join('')
        : '<div class="empty">Η λίστα είναι άδεια. Πρόσθεσε προϊόντα ή ζήτα από το Claude «φτιάξε λίστα για την εβδομάδα».</div>') +
        (got.length ? `<h2>Αγοράστηκαν πρόσφατα</h2><div class="list">${got.map(shopRow).join('')}</div>` : '');
      $$('[data-buy]', v).forEach(b => b.onclick = async e => {
        e.stopPropagation(); const it = items.find(i => i.id === b.dataset.buy);
        try { await q(sb.from('shopping_items').update({ status: it.status === 'αγοράστηκε' ? 'χρειάζεται' : 'αγοράστηκε' }).eq('id', it.id)); draw(); } catch (er) { fail(er); }
      });
      $$('[data-s]', v).forEach(c => c.onclick = () => editShop(items.find(i => i.id === c.dataset.s)));
      fab(() => editShop(), 'Νέο προϊόν');
    }
  };
  const head = () => `<h1>Αγορές</h1><p class="sub">Κοινή λίστα για όλο το σπίτι</p>` + segment('shop', [['list', 'Λίστα'], ['home', 'Συσκευές σπιτιού']], draw);
  await draw();
}
const shopRow = i => `<div class="card row ${i.status === 'αγοράστηκε' ? 'done' : ''}" data-s="${i.id}" style="cursor:pointer">
  <button class="check ${i.status === 'αγοράστηκε' ? 'on' : ''}" data-buy="${i.id}" aria-label="Αγοράστηκε: ${esc(i.name)}">${i.status === 'αγοράστηκε' ? '✓' : ''}</button>
  <div class="grow"><div class="title">${esc(i.name)}${i.qty ? ` <span class="meta">· ${fmtNum(i.qty)} ${esc(i.unit || '')}</span>` : ''}</div>
  ${i.reason || i.members ? `<div class="meta">${[i.reason, i.members && 'για ' + i.members.name].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
  ${i.best_store ? `<div class="meta">🏷️ ${esc(i.best_store)}${i.link ? ` · <a href="${esc(i.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">σύνδεσμος</a>` : ''}</div>` : ''}</div>
  ${i.best_price != null ? `<div class="big" style="font-size:17px">${fmtNum(i.best_price)}<span class="unit">€</span></div>` : ''}</div>`;
function editShop(i = {}) {
  sheet(i.id ? 'Προϊόν' : 'Προσθήκη στη λίστα', `
    <label>Προϊόν</label><input name="name" required value="${esc(i.name)}">
    <div class="two"><div><label>Ποσότητα</label><input name="qty" inputmode="decimal" value="${esc(i.qty)}"></div>
    <div><label>Μονάδα</label><input name="unit" placeholder="τεμ, kg…" value="${esc(i.unit)}"></div></div>
    <div class="two"><div><label>Κατηγορία</label><select name="category">${opt(SHOP_CATS, i.category)}</select></div>
    <div><label>Για</label><select name="for_member"><option value="">όλο το σπίτι</option>${memberOpts(i.for_member)}</select></div></div>
    <label>Σημείωση</label><input name="reason" value="${esc(i.reason)}">`,
    async f => {
      const row = { name: f.get('name'), qty: num(f.get('qty')), unit: nul(f.get('unit')), category: f.get('category'), for_member: nul(f.get('for_member')), reason: nul(f.get('reason')) };
      if (i.id) await q(sb.from('shopping_items').update(row).eq('id', i.id)); else await q(sb.from('shopping_items').insert(row));
      toast('Αποθηκεύτηκε'); route();
    }, { del: i.id ? async () => { await q(sb.from('shopping_items').delete().eq('id', i.id)); route(); } : null });
}
function editHome(i = {}) {
  sheet(i.id ? 'Συσκευή' : 'Νέα συσκευή', `
    <label>Όνομα</label><input name="name" required value="${esc(i.name)}" placeholder="π.χ. Πλυντήριο πιάτων">
    <div class="two"><div><label>Κατάσταση</label><select name="status">${opt(['έχουμε', 'θέλουμε', 'σε έρευνα'], i.status)}</select></div>
    <div><label>Κατηγορία</label><input name="category" value="${esc(i.category)}"></div></div>
    <div class="two"><div><label>Μάρκα</label><input name="brand" value="${esc(i.brand)}"></div><div><label>Μοντέλο</label><input name="model" value="${esc(i.model)}"></div></div>
    <div class="two"><div><label>Τιμή (€)</label><input name="price" inputmode="decimal" value="${esc(i.price)}"></div><div><label>Κατάστημα</label><input name="store" value="${esc(i.store)}"></div></div>
    <div class="two"><div><label>Αγορά</label><input type="date" name="purchase_date" value="${esc(i.purchase_date)}"></div><div><label>Εγγύηση έως</label><input type="date" name="warranty_until" value="${esc(i.warranty_until)}"></div></div>
    <label>Σημειώσεις</label><textarea name="notes" placeholder="π.χ. θέλουμε αθόρυβο, ενεργειακή Α">${esc(i.notes)}</textarea>`,
    async f => {
      const row = Object.fromEntries(['name', 'status', 'category', 'brand', 'model', 'store', 'purchase_date', 'warranty_until', 'notes'].map(k => [k, nul(f.get(k))]));
      row.price = num(f.get('price'));
      if (i.id) await q(sb.from('household_items').update(row).eq('id', i.id)); else await q(sb.from('household_items').insert(row));
      toast('Αποθηκεύτηκε'); route();
    }, { del: i.id ? async () => { await q(sb.from('household_items').delete().eq('id', i.id)); route(); } : null });
}

/* ---------- ΡΥΘΜΙΣΕΙΣ ---------- */
async function settings(v) {
  v.innerHTML = `<h1>Ρυθμίσεις</h1><p class="sub">${esc(S.user.email)}</p>
    <h2>Μέλη οικογένειας</h2><div class="list">${S.members.map(m => `<div class="card row" data-me="${m.id}" style="cursor:pointer">
      <span class="sw" style="width:14px;height:14px;border-radius:50%;flex:0 0 14px;background:${esc(m.color)}"></span>
      <div class="grow"><div class="title">${esc(m.name)}</div><div class="meta">${[m.relation, m.birth_date && age(m.birth_date) + ' ετών'].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('')}</div>
    <button class="btn ghost wide" id="am">＋ Προσθήκη μέλους</button>
    <h2>Με το Claude</h2>
    <div class="card"><p style="margin:0;overflow-wrap:anywhere">Σε οποιαδήποτε συζήτηση μπορείς να πεις π.χ.:</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:var(--muted)"><li>«Πέρασε τις νέες εξετάσεις»</li><li>«Ανάλυσε τα σημερινά γεύματα»</li>
      <li>«Πώς πάει η χοληστερίνη μου;»</li><li>«Φτιάξε λίστα για την εβδομάδα»</li><li>«Βρες φθηνότερα τα προϊόντα της λίστας»</li><li>«Εβδομαδιαία αναφορά»</li></ul></div>
    <p class="hint">Η εφαρμογή κρατά πληροφορίες και βοηθά στην οργάνωση. Δεν αντικαθιστά τον γιατρό. Για αλλαγές σε φάρμακα ή δόσεις, μίλα πάντα πρώτα με τον γιατρό σου.</p>
    <button class="btn danger wide" id="lo" style="margin-top:12px">Αποσύνδεση</button>`;
  $$('[data-me]').forEach(c => c.onclick = () => editMember(member(c.dataset.me)));
  $('#am').onclick = () => editMember();
  $('#lo').onclick = async () => { await sb.auth.signOut(); };
}

/* ---------- εκκίνηση ---------- */
async function start(session) {
  if (!session) { S.user = null; return showLogin(); }
  if (S.user?.id === session.user.id) return;
  S.user = session.user;
  if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/');
  $('.top').classList.remove('hide'); $('#tabs').classList.remove('hide');
  try { await loadMembers(); } catch (e) { return fail(e); }
  route();
}
window.addEventListener('hashchange', () => S.user && route());
sb.auth.onAuthStateChange((_e, session) => start(session));
sb.auth.getSession().then(({ data }) => start(data.session));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
