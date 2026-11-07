/* Μηχανή πρότασης επόμενου γεύματος — τρέχει τοπικά, χωρίς AI και χωρίς κόστος.
   Γενικές διατροφικές οδηγίες (WHO, EFSA, ΕΟΔΥ/Εθνικός Διατροφικός Οδηγός). Δεν αντικαθιστά διαιτολόγο ή γιατρό. */
(function () {
  const F = {}; window.FOODS.forEach(r => F[r[0]] = r);
  const PUR = ['χαμηλές', 'μέτριες', 'υψηλές'];
  const N = ['kcal', 'carbs_g', 'sugar_g', 'fiber_g', 'protein_g', 'fat_g', 'sat_fat_g', 'sodium_mg'];

  function food(id) {
    const r = F[id]; if (!r) return null;
    const x = r[13] || {};
    return { id: r[0], name: r[1], cat: r[2], portion: r[3], kcal: r[4], carbs_g: r[5], sugar_g: r[6], fiber_g: r[7], protein_g: r[8],
      fat_g: r[9], sat_fat_g: r[10], sodium_mg: r[11], pur: r[12], caffeine_mg: x.cf || 0, alcohol_g: x.al || 0, water_ml: x.w || 0, tags: x.t || '' };
  }
  /* σύνολα από λίστα επιλεγμένων [{id, q}] */
  function itemsTotals(items) {
    const t = { kcal: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0, protein_g: 0, fat_g: 0, sat_fat_g: 0, sodium_mg: 0, caffeine_mg: 0, alcohol_g: 0, water_ml: 0, added_sugar: 0, pur: 0, tags: '' };
    (items || []).forEach(it => {
      const f = food(it.id); if (!f) return;
      const q = Number(it.q) || 1;
      [...N, 'caffeine_mg', 'alcohol_g', 'water_ml'].forEach(k => t[k] += (f[k] || 0) * q);
      if (/\bsweet\b/.test(f.tags)) t.added_sugar += f.sugar_g * q;
      t.pur = Math.max(t.pur, f.pur); t.tags += ' ' + f.tags;
    });
    t.added_sugar = Math.round(t.added_sugar);
    [...N, 'caffeine_mg', 'alcohol_g', 'water_ml'].forEach(k => t[k] = Math.round(t[k] * 10) / 10);
    return t;
  }
  const itemsText = items => (items || []).map(it => { const f = food(it.id); if (!f) return ''; const q = Number(it.q) || 1;
    return (q === 1 ? '' : (q === .5 ? '½ × ' : String(q).replace('.', ',') + ' × ')) + f.name + ' (' + f.portion + ')'; }).filter(Boolean).join(', ');

  function age(bd) { if (!bd) return null; const b = new Date(bd), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
  const has = (txt, re) => re.test((txt || '').toLowerCase());

  /* προφίλ: στόχοι ημέρας και κανόνες από θέματα υγείας, εξετάσεις, προτιμήσεις */
  function profile(m, labs) {
    const a = age(m.birth_date), sex = m.sex, cond = (m.chronic_conditions || '') + ' ' + (m.notes || '');
    const flag = (name, dir) => (labs || []).some(l => l.test_name === name && l.flag === dir);
    const P = { age: a, child: a != null && a < 13, teen: a != null && a >= 13 && a < 18 };
    P.kcal = a == null ? 2000 : a < 4 ? 1200 : a < 9 ? 1500 : a < 13 ? 1900 : a < 18 ? (sex === 'Θ' ? 2100 : 2600)
      : a < 65 ? (sex === 'Θ' ? 1800 : sex === 'Α' ? 2300 : 2000) : (sex === 'Θ' ? 1650 : 2000);
    P.r = {
      chol: has(cond, /χοληστερ|στεφαν|καρδι/) || flag('LDL', 'υψηλό') || flag('Ολική χοληστερίνη', 'υψηλό'),
      tg: has(cond, /τριγλυκερ/) || flag('Τριγλυκερίδια', 'υψηλό'),
      glu: has(cond, /διαβήτ|προδιαβ|ινσουλ/) || flag('HbA1c', 'υψηλό') || flag('Γλυκόζη νηστείας', 'υψηλό'),
      uric: has(cond, /ουρικ/) || flag('Ουρικό οξύ', 'υψηλό'),
      bp: has(cond, /υπέρτασ|υπερτασ|καρδιακή ανεπ/),
      kidney: has(cond, /νεφρ/) || flag('Κρεατινίνη', 'υψηλό'),
      liver: has(cond, /λιπώδ|ήπαρ/) || flag('SGPT (ALT)', 'υψηλό') || flag('γ-GT', 'υψηλό'),
      weight: has(cond, /βάρος|παχυσαρκ/),
      iron: has(cond, /αναιμ/) || flag('Σίδηρος', 'χαμηλό') || flag('Φερριτίνη', 'χαμηλό') || flag('Αιμοσφαιρίνη', 'χαμηλό'),
      vitd: has(cond, /βιταμίνης d/) || flag('Βιταμίνη D (25-OH)', 'χαμηλό'),
      celiac: has(cond, /κοιλιοκάκ/)
    };
    if (P.r.weight && !P.child && !P.teen) P.kcal = Math.round(P.kcal * 0.85 / 50) * 50;
    P.satfat = Math.round(P.kcal * (P.r.chol ? 0.07 : 0.10) / 9);
    P.sugar = P.child ? (a < 4 ? 15 : 25) : (P.r.glu || P.r.tg || P.r.liver ? 25 : 50);
    P.sodium = P.child ? (a < 4 ? 1000 : a < 9 ? 1200 : 1500) : (P.r.bp || P.r.kidney ? 1500 : 2000);
    P.fiber = P.child ? a + 10 : (sex === 'Θ' ? 25 : 30);
    P.protein = P.child ? 15 + a * 2 : P.teen ? 55 : (sex === 'Θ' ? 55 : 70);
    P.water = P.child ? (a < 4 ? 1000 : a < 9 ? 1300 : 1700) : (sex === 'Θ' ? 2000 : 2500);
    P.caffeine = P.child || P.teen ? 0 : 400;
    // προτιμήσεις & αλλεργίες → αποκλεισμοί ετικετών
    const diet = (m.diet_notes || '').toLowerCase(), all = (m.allergies || '').toLowerCase();
    P.excl = [];
    if (/vegan/.test(diet)) P.need = 'vegan';
    else if (/χορτοφαγ/.test(diet)) P.need = 'veg';
    else if (/νηστεία/.test(diet)) P.need = 'vegan';
    if (/χωρίς γλουτένη/.test(diet) || P.r.celiac || /γλουτ/.test(all)) P.excl.push('glu');
    if (/χωρίς λακτόζη/.test(diet) || /γάλα|λακτ/.test(all)) P.excl.push('milk');
    if (/δεν τρώει ψάρι/.test(diet) || /ψάρ|θαλασσ/.test(all)) P.excl.push('fish');
    if (/χωρίς χοιρινό/.test(diet)) P.excl.push('pork');
    if (/δεν τρώει όσπρια/.test(diet)) P.excl.push('leg');
    if (/ξηρ|καρπ|αμύγδ|καρύδ|φιστ/.test(all)) P.excl.push('nut');
    if (/αυγ/.test(all)) P.excl.push('egg');
    if (/σουσάμ|ταχίν/.test(all)) P.excl.push('ses');
    P.lowcarb = /χαμηλή σε υδατάνθρακες/.test(diet) && !P.child;
    return P;
  }

  /* σύνολα ημέρας από τα γεύματα της βάσης */
  function dayTotals(meals) {
    const t = { kcal: 0, carbs_g: 0, sugar_g: 0, fiber_g: 0, protein_g: 0, fat_g: 0, sat_fat_g: 0, sodium_mg: 0, caffeine_mg: 0, alcohol_g: 0, water_ml: 0,
      added_sugar: 0, logged: 0, unknown: 0, coffees: 0, beers: 0, drinks: 0, pur2: 0, tags: '', names: '' };
    meals.forEach(ml => {
      if (ml.kcal == null && !(ml.items || []).length) { t.unknown++; t.names += ' ' + (ml.description || ''); return; }
      t.logged++;
      N.forEach(k => t[k] += Number(ml[k]) || 0);
      t.added_sugar += (ml.items || []).length ? itemsTotals(ml.items).added_sugar : (Number(ml.sugar_g) || 0) * 0.4;
      t.caffeine_mg += Number(ml.caffeine_mg) || 0; t.alcohol_g += Number(ml.alcohol_g) || 0; t.water_ml += Number(ml.water_ml) || 0;
      if (ml.purines === 'υψηλές') t.pur2++;
      t.names += ' ' + (ml.description || '');
      (ml.items || []).forEach(it => { const f = food(it.id); if (!f) return; t.tags += ' ' + f.tags;
        if (f.caffeine_mg >= 60) t.coffees += Number(it.q) || 1; if (f.id === 'beer') t.beers += Number(it.q) || 1; if (f.alcohol_g) t.drinks += Number(it.q) || 1; });
    });
    return t;
  }

  /* ποιο γεύμα έρχεται */
  function nextSlot(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h < 4) return { k: 'late', label: 'κάτι ελαφρύ (αν πεινάς)', types: 's', share: 0.05 };
    if (h < 10.5) return { k: 'b', label: 'πρωινό', types: 'b', share: 0.25 };
    if (h < 12.5) return { k: 's', label: 'δεκατιανό', types: 's', share: 0.10 };
    if (h < 16) return { k: 'l', label: 'μεσημεριανό', types: 'l', share: 0.35 };
    if (h < 19) return { k: 's', label: 'απογευματινό σνακ', types: 's', share: 0.10 };
    if (h < 22.5) return { k: 'd', label: 'βραδινό', types: 'd', share: 0.25 };
    return { k: 'late', label: 'κάτι ελαφρύ (αν πεινάς)', types: 's', share: 0.05 };
  }

  const fmt = n => Math.round(n).toLocaleString('el-GR');
  const IDX = { kcal: 3, carbs_g: 4, sugar_g: 5, fiber_g: 6, protein_g: 7, fat_g: 8, sat_fat_g: 9, sodium_mg: 10 };

  function suggest(m, meals, labs, now = new Date()) {
    const P = profile(m, labs), T = dayTotals(meals), slot = nextSlot(now);
    // παιδική μερίδα
    const scale = P.age == null ? 1 : P.age < 4 ? 0.45 : P.age < 9 ? 0.6 : P.age < 13 ? 0.8 : 1;
    const remain = Math.max(0, P.kcal - T.kcal);
    const budget = Math.max(slot.k === 'late' ? 80 : 150, Math.min(remain || P.kcal * slot.share, P.kcal * slot.share * 1.15));
    const fiberGap = Math.max(0, P.fiber - T.fiber_g), protGap = Math.max(0, P.protein - T.protein_g);
    const todayText = (T.names + ' ' + T.tags).toLowerCase();

    const ideas = window.MEAL_IDEAS.map(r => {
      const tags = r[12], name = r[1], pur = r[11];
      const v = k => r[IDX[k]] * scale;
      if (!r[2].split(' ').some(t => slot.types.includes(t))) return null;
      if (P.need === 'vegan' && !/vegan/.test(tags)) return null;
      if (P.need === 'veg' && !/veg/.test(tags)) return null;
      if (P.excl.some(e => new RegExp('\\b' + e + '\\b').test(tags))) return null;
      if (P.r.uric && pur >= 2) return null;
      if (P.age != null && P.age < 5 && /\b(nut|choke)\b/.test(tags)) return null; // κίνδυνος πνιγμού σε μικρά παιδιά
      let s = 100; const why = [];
      // θερμίδες κοντά στον προϋπολογισμό
      s -= Math.min(35, Math.abs(v('kcal') - budget) / budget * 30);
      // όρια ημέρας
      const over = (key, lim, w) => { const tot = T[key] + v(key); if (tot > lim) s -= Math.min(40, (tot - lim) / lim * w); return tot; };
      over('sat_fat_g', P.satfat, P.r.chol ? 60 : 30);
      over('sodium_mg', P.sodium, P.r.bp ? 60 : 25);
      { const tot = T.added_sugar + v('sugar_g') * 0.5; if (tot > P.sugar) s -= Math.min(40, (tot - P.sugar) / P.sugar * (P.r.glu || P.r.tg ? 60 : 25)); }
      if (P.r.glu || P.lowcarb) { const lim = slot.types === 's' ? 20 : 50; if (v('carbs_g') > lim) s -= (v('carbs_g') - lim) * 0.8; }
      if (P.r.kidney && v('protein_g') > 35) s -= (v('protein_g') - 35) * 0.8;
      if (P.r.uric && pur === 1) s -= 4;
      // κάλυψη κενών
      if (fiberGap > 0) s += Math.min(v('fiber_g'), fiberGap) / P.fiber * 35;
      if (protGap > 0 && !P.r.kidney) s += Math.min(v('protein_g'), protGap) / P.protein * 15;
      if ((P.r.chol || P.r.tg || P.r.vitd) && /fish/.test(tags)) s += 10;
      if (P.r.iron && /leg|red|egg/.test(tags)) s += 6;
      // ποικιλία: τι έφαγε ήδη σήμερα
      const main = (tags.match(/\b(leg|fish|chick|red|egg)\b/) || [])[1];
      if (main && new RegExp('\\b' + main + '\\b').test(todayText)) s -= 12;
      if (/φακ/.test(name.toLowerCase()) && /φακ/.test(todayText)) s -= 20;
      // λόγοι
      if (fiberGap >= 8 && v('fiber_g') >= 5) why.push(`ανεβάζει τις φυτικές ίνες (σήμερα ${fmt(T.fiber_g)} από ${P.fiber} g)`);
      if (P.r.chol && v('sat_fat_g') <= 4) why.push('λίγα κορεσμένα λιπαρά, καλό για τη χοληστερίνη');
      if ((P.r.chol || P.r.tg) && /fish/.test(tags)) why.push('ω-3 από το ψάρι για λιπίδια και καρδιά');
      if ((P.r.glu || P.lowcarb) && v('carbs_g') <= (slot.types === 's' ? 20 : 50) && v('sugar_g') <= 12) why.push('ήπιο για το σάκχαρο');
      if (P.r.uric && pur === 0) why.push('χαμηλές πουρίνες για το ουρικό');
      if ((P.r.bp || P.r.kidney) && v('sodium_mg') <= 450) why.push('λίγο αλάτι για την πίεση');
      if (protGap >= 20 && v('protein_g') >= 18 && !P.r.kidney) why.push(`καλύπτει πρωτεΐνη (σήμερα ${fmt(T.protein_g)} από ${P.protein} g)`);
      if (P.r.iron && /leg|red|egg/.test(tags)) why.push('σίδηρος — συνδύασέ το με λεμόνι ή ντομάτα');
      if (!why.length) why.push('ισορροπημένο και ταιριάζει στις θερμίδες που μένουν');
      return { id: r[0], name, s, why: why.slice(0, 2), kcal: Math.round(v('kcal')), carbs: Math.round(v('carbs_g')), fiber: Math.round(v('fiber_g')),
        protein: Math.round(v('protein_g')), sat: Math.round(v('sat_fat_g') * 10) / 10, sodium: Math.round(v('sodium_mg')), pur, tags, scale, raw: r };
    }).filter(Boolean).sort((a, b) => b.s - a.s);

    // σημειώσεις για την ημέρα
    const notes = [];
    if (T.unknown) notes.push(`${T.unknown} γεύμα(τα) δεν έχουν ακόμα θρεπτικά — πες στο Claude «ανάλυσε τα γεύματα» για ακριβή εικόνα.`);
    if (T.sat_fat_g > P.satfat) notes.push(`Κορεσμένα σήμερα ${fmt(T.sat_fat_g)} g (όριο ${P.satfat} g) — στο επόμενο αποφύγετε τυριά, αλλαντικά, τηγανητά.`);
    if (T.sodium_mg > P.sodium) notes.push(`Αλάτι σήμερα ≈${fmt(T.sodium_mg)} mg νάτριο (όριο ${fmt(P.sodium)}) — πιο ανάλατα μέχρι το βράδυ.`);
    if (T.added_sugar > P.sugar) notes.push(`Ζάχαρη από γλυκά/ροφήματα σήμερα ≈${fmt(T.added_sugar)} g (όριο ${P.sugar} g) — όχι άλλα γλυκά, χυμούς ή αναψυκτικά σήμερα.`);
    if (P.caffeine && T.caffeine_mg >= 300) notes.push(`Καφεΐνη ≈${fmt(T.caffeine_mg)} mg${now.getHours() >= 16 ? ' — όχι άλλος καφές σήμερα, για καλύτερο ύπνο' : ' — κοντά στο όριο των 400 mg'}.`);
    else if (P.caffeine && T.caffeine_mg > 0 && now.getHours() >= 17) notes.push('Μετά τις 17:00 προτίμησε χαμομήλι ή τσάι του βουνού αντί για καφέ.');
    if ((P.child || P.teen) && T.caffeine_mg > 0) notes.push('Για παιδιά και εφήβους καλύτερα χωρίς καφεΐνη (cola, ice tea, ενεργειακά).');
    if (T.alcohol_g > 0) {
      if (P.r.uric && T.beers) notes.push('Μπύρα με αυξημένο ουρικό: ανεβάζει το ουρικό — καλύτερα να αποφεύγεται.');
      if (P.r.tg || P.r.liver) notes.push('Το αλκοόλ ανεβάζει τριγλυκερίδια και επιβαρύνει το ήπαρ — μέχρι εδώ για σήμερα.');
      if (T.alcohol_g > 20) notes.push(`Αλκοόλ σήμερα ≈${fmt(T.alcohol_g)} g — πάνω από 2 ποτά· νερό ανάμεσα.`);
      if (P.r.glu) notes.push('Με αλκοόλ και διαβήτη: φάε κάτι μαζί, για να μην πέσει το σάκχαρο.');
    }
    if (P.r.uric && T.pur2) notes.push('Έφαγες ήδη τρόφιμο με πολλές πουρίνες σήμερα — το υπόλοιπο της ημέρας χαμηλές πουρίνες και πολύ νερό.');
    const hour = now.getHours();
    const waterGoalNow = P.water * Math.min(1, Math.max(0, (hour - 7) / 14));
    if (T.logged && T.water_ml < waterGoalNow * 0.6 && hour >= 11 && hour < 21) notes.push(`Υγρά που καταγράφηκαν ≈${fmt(T.water_ml)} ml — ${P.child ? 'δώσ\'του 1–2 ποτήρια νερό' : 'πιες 1–2 ποτήρια νερό'} τώρα (στόχος ημέρας ${fmt(P.water)} ml).`);

    return { P, T, slot, budget: Math.round(budget), ideas: ideas.slice(0, 3), notes, scale };
  }

  window.NUTRI = { food, itemsTotals, itemsText, profile, dayTotals, nextSlot, suggest, PUR };
})();
