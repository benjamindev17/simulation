/* ==========================================================================
   Comparaison de simulations — accessible uniquement depuis "Mes simulations"
   (dashboard.js fournit les entrées sélectionnées via window.openCompare).
   Recalcule chaque simulation à partir de son état sauvegardé SANS jamais
   appeler applyState()/renderCalc() : ça éviterait d'écraser silencieusement
   la simulation actuellement affichée/en cours d'édition à l'écran. Les
   formules dupliquent donc volontairement celles de rate-simulation.js /
   ownership.js plutôt que de réutiliser leurs fonctions liées aux variables
   globales "live".
   ========================================================================== */
(function () {
  const overlay = document.getElementById('compare-overlay');
  const doc = document.getElementById('compare-doc');
  const btnClose = document.getElementById('btn-close-compare');
  if (!overlay || !doc) return;

  // Recalcule les grandeurs d'une simulation à partir de son état sauvegardé (captureState()).
  function computeSummary(s) {
    const isSolo = s.mode === 'solo';
    const fraisEnreg = s.prixAppart * 0.03;
    const fraisTotal = fraisEnreg + s.fraisNotaire + s.fraisBancaires;
    const coutTotal = s.fraisHorsEmprunt ? (s.prixAppart + s.travaux) : (s.prixAppart + s.travaux + fraisTotal);
    const montant = Math.max(0, coutTotal - s.apport);

    const r = s.tauxPct / 100 / 12;
    const n = s.dureeChoisie * 12;
    const annuityFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
    const mensualite = montant > 0 ? montant / annuityFactor : 0;
    const totalInterest = mensualite * n - montant;

    const c = s.cout || {};
    const anMensualite = mensualite * 12;
    const totalAn = anMensualite + (c.asrd || 0) + (c.incendie || 0) + (c.compte || 0) + (c.copro || 0) * 12 +
      (c.reserve || 0) * 12 + (c.precompte || 0) + (c.dechets || 0) + (c.charges || 0) * 12 + (c.energie || 0) * 12;
    const chargesMois = (totalAn - anMensualite) / 12;
    const totalMois = mensualite + chargesMois;
    const capitalMoyenAn = s.dureeChoisie > 0 ? montant / s.dureeChoisie : 0;
    const coutReelAn = totalAn - capitalMoyenAn;

    // Quotité empruntée = part du coût total financée par l'emprunt (même formule que
    // "Quotité empruntée" dans l'onglet Simulation taux) — le % emprunté à la banque.
    const quotiteEmpruntee = coutTotal > 0 ? (montant / coutTotal) * 100 : 0;

    return { isSolo, coutTotal, montant, mensualite, totalInterest, totalAn, totalMois, coutReelAn, quotiteEmpruntee };
  }

  // Ligne de tableau : "values" sont des valeurs BRUTES (nombre ou null/chaîne), formatées via
  // opts.formatter pour l'affichage. Avec opts.best, la (ou les) plus petite(s) valeur(s)
  // numérique(s) sont mises en évidence — utile pour les postes de coût, où moins cher = mieux.
  // Pas de mise en évidence si toutes les valeurs numériques sont à égalité (rien à distinguer).
  function row(label, values, opts) {
    opts = opts || {};
    const formatter = opts.formatter || ((v) => (v == null ? '—' : String(v)));
    const nums = values.map(v => (typeof v === 'number' ? v : null));
    const validNums = nums.filter(v => v !== null);
    const min = opts.best && validNums.length ? Math.min(...validNums) : null;
    const allTied = opts.best && validNums.length === values.length && validNums.every(v => v === min);
    const tds = values.map((v, i) => {
      const isBest = opts.best && !allTied && nums[i] !== null && nums[i] === min;
      return '<td' + (isBest ? ' class="cmp-best"' : '') + '>' + formatter(v) + '</td>';
    }).join('');
    return '<tr><td>' + label + '</td>' + tds + '</tr>';
  }

  function build(entries) {
    const summaries = entries.map(e => computeSummary(e.state));
    const today = new Date().toLocaleDateString('fr-BE');

    let html =
      '<div class="c-head">' +
        '<h1>Comparaison de simulations</h1>' +
        '<p class="c-sub">' + entries.length + ' simulations — générée le ' + today + '</p>' +
      '</div>';

    html += '<table class="c-table c-table--data cmp-table"><thead><tr><th>Critère</th>' +
      entries.map(e => '<th>' + (e.nom || 'Sans nom') + '</th>').join('') + '</tr></thead><tbody>';

    const euros = (v) => (v == null ? '—' : fmt(Math.round(v)));
    const eurosPerMois = (v) => (v == null ? '—' : fmt(Math.round(v)) + '/mois');
    const eurosPerAn = (v) => (v == null ? '—' : fmt(Math.round(v)) + '/an');

    html += row('Mode', entries.map((e, i) => summaries[i].isSolo ? 'Seul(e)' : 'À deux'));
    html += row('Emprunteur(s)', entries.map((e, i) => summaries[i].isSolo ? e.state.nomA : e.state.nomA + ' / ' + e.state.nomB));
    html += row('Prix de l’appartement', entries.map((e) => e.state.prixAppart), { formatter: euros });
    html += row('Aménagement', entries.map((e) => e.state.travaux || 0), { formatter: euros });
    html += row('Coût total du projet', summaries.map((s) => s.coutTotal), { formatter: euros });
    html += row('Frais bancaires (frais de dossier)', entries.map((e) => e.state.fraisBancaires || 0), { best: true, formatter: euros });
    html += row('Apport total', entries.map((e) => e.state.apport), { formatter: euros });
    html += row('Montant emprunté', summaries.map((s) => s.montant), { formatter: euros });
    html += row('Taux annuel', entries.map((e) => e.state.tauxPct.toFixed(2) + ' %'));
    html += row('Durée', entries.map((e) => e.state.dureeChoisie + ' ans'));
    html += row('Mensualité', summaries.map((s) => s.mensualite), { best: true, formatter: eurosPerMois });
    html += row('Quotité empruntée', summaries.map((s) => s.quotiteEmpruntee), { formatter: (v) => v.toFixed(2) + ' %' });
    html += row('Coût total des intérêts', summaries.map((s) => s.totalInterest), { best: true, formatter: euros });
    html += row('Assurance solde restant dû (ADI)', entries.map((e) => (e.state.cout && e.state.cout.asrd) || 0), { best: true, formatter: eurosPerAn });
    html += row('Compte bancaire', entries.map((e) => (e.state.cout && e.state.cout.compte) || 0), { best: true, formatter: eurosPerAn });
    html += row('Coût annuel de possession', summaries.map((s) => s.totalAn), { best: true, formatter: eurosPerAn });
    html += row('Total prêt + charges', summaries.map((s) => s.totalMois), { best: true, formatter: eurosPerMois });
    html += row('Coût réel hors capital', summaries.map((s) => s.coutReelAn), { best: true, formatter: eurosPerAn });
    html += row('Indemnité de remboursement anticipé', entries.map((e) => e.state.iraMois != null ? e.state.iraMois : 3), {
      best: true,
      formatter: (v) => (v == null ? '—' : (v.toFixed(1).replace(/\.0$/, '') + ' mois'))
    });
    html += row('Conditions particulières (remb. anticipé)', entries.map((e) => e.state.iraConditions || null));

    html += '</tbody></table>';
    html += '<p class="c-annex-note">Les cases en vert repèrent, pour chaque ligne, la valeur la plus favorable (coût le plus bas, ou indemnité de remboursement anticipé la moins pénalisante). Le tableau d’étalement mensuel et l’onglet Placement ETF ne font pas partie de cette comparaison.</p>';

    doc.innerHTML = html;
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('recap-open');
  }

  window.openCompare = function (entries) {
    if (!entries || entries.length < 2) return;
    build(entries);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('recap-open');
    overlay.scrollTop = 0;
  };

  if (btnClose) btnClose.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();
