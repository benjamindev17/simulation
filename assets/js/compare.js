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
  const btnPrint = document.getElementById('btn-print-compare');
  if (!overlay || !doc) return;

  // Recalcule les grandeurs d'une simulation à partir de son état sauvegardé (captureState()).
  function computeSummary(s) {
    const isSolo = s.mode === 'solo';
    // Coût total et montant emprunté : formule partagée (state.js), pour qu'elle ne
    // puisse pas diverger de celle de l'onglet Simulation taux ni de celle du titre.
    const { coutTotal, montant } = coutsDeState(s);

    const r = tauxMensuel(s.tauxPct);
    const n = s.dureeChoisie * 12;
    const annuityFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
    const mensualite = montant > 0 ? montant / annuityFactor : 0;
    const totalInterest = mensualite * n - montant;

    const c = s.cout || {};
    const anMensualite = mensualite * 12;

    // Assurance habitation souscrite hors banque : elle sort du coût annuel de possession,
    // qui ne retient alors que ce qui passe par l'offre bancaire. Elle reste affichée sur sa
    // propre ligne, donc rien n'est masqué — c'est une ré-attribution, pas une disparition.
    // Attention : ce choix ne vaut QUE pour le comparateur, où l'on met des offres de banques
    // en regard. L'outil, le récapitulatif et l'onglet Coût de la vie continuent d'afficher
    // le coût réellement déboursé, assurance comprise — sinon le budget serait sous-estimé.
    const incendieExterne = !!c.incendieExterne;
    const incendieDansTotal = incendieExterne ? 0 : (c.incendie || 0);

    const totalAn = anMensualite + (c.asrd || 0) + incendieDansTotal + (c.compte || 0) + (c.copro || 0) * 12 +
      (c.reserve || 0) * 12 + (c.precompte || 0) + (c.dechets || 0) + (c.charges || 0) * 12 + (c.energie || 0) * 12;
    const chargesMois = (totalAn - anMensualite) / 12;
    const totalMois = mensualite + chargesMois;
    const capitalMoyenAn = s.dureeChoisie > 0 ? montant / s.dureeChoisie : 0;
    const coutReelAn = totalAn - capitalMoyenAn;

    // Quotité (loan-to-value) : montant emprunté rapporté au PRIX du bien, comme la
    // calculent les banques belges — cf. quotiteCalc() dans rate-simulation.js. Ni les
    // frais ni l'aménagement au dénominateur : ils ne font pas partie de la garantie.
    const quotiteEmpruntee = s.prixAppart > 0 ? (montant / s.prixAppart) * 100 : 0;

    // Ce que le crédit coûte réellement sur toute sa durée, une fois le capital mis de côté :
    // intérêts + frais de dossier + assurance solde restant dû + compte imposé par la banque.
    // C'est le seul agrégat qui permette de départager deux offres sur autre chose que le
    // taux affiché — une banque au taux plus bas peut coûter davantage via l'ADI ou ses frais.
    // Volontairement exclus : le capital (remboursé quelle que soit la banque), les charges
    // du bien (précompte, copropriété, énergie, déchets, assurance habitation) qui ne
    // dépendent pas du prêteur, et l'indemnité de remboursement anticipé, qui n'est due
    // qu'en cas de remboursement anticipé — elle reste affichée à part, en ligne.
    const dureeAns = s.dureeChoisie || 0;
    const coutCredit = totalInterest
      + (s.fraisBancaires || 0)
      + (s.fraisHypo || 0)
      + (c.asrd || 0) * dureeAns
      + (c.compte || 0) * dureeAns;

    return { isSolo, coutTotal, montant, mensualite, totalInterest, totalAn, totalMois,
      coutReelAn, quotiteEmpruntee, coutCredit, incendieExterne };
  }

  // Tableau transposé (banques en ligne, critères en colonne — cf. #cmp-table--transposed) :
  // on définit d'abord chaque colonne (un critère), puis on la rend une fois par ligne. Les
  // "values" sont des valeurs BRUTES (nombre ou null/chaîne), formatées via opts.formatter.
  // Avec opts.best, la (ou les) plus petite(s) valeur(s) numérique(s) de la colonne sont mises
  // en évidence — utile pour les postes de coût, où moins cher = mieux. Pas de mise en
  // évidence si toutes les valeurs numériques sont à égalité (rien à distinguer).
  function col(label, values, opts) {
    opts = opts || {};
    const formatter = opts.formatter || ((v) => (v == null ? '—' : String(v)));
    const nums = values.map(v => (typeof v === 'number' ? v : null));
    const validNums = nums.filter(v => v !== null);
    const min = opts.best && validNums.length ? Math.min(...validNums) : null;
    const allTied = opts.best && validNums.length === values.length && validNums.every(v => v === min);
    const bestSet = new Set();
    if (opts.best && !allTied) {
      nums.forEach((v, i) => { if (v !== null && v === min) bestSet.add(i); });
    }
    return { label, values, formatter, bestSet, total: !!opts.total, titre: opts.titre || null };
  }

  function build(entries) {
    const summaries = entries.map(e => computeSummary(e.state));

    // Meilleure offre = coût du crédit le plus faible. En cas d'égalité parfaite, on ne
    // désigne personne : mettre l'une des deux en avant serait arbitraire.
    const couts = summaries.map(s => s.coutCredit);
    const minCout = Math.min(...couts);
    const exAequo = couts.filter(v => v === minCout).length > 1;
    const gagnant = exAequo ? -1 : couts.indexOf(minCout);

    // Si l'assurance habitation est externe ici et bancaire là, les totaux de possession ne
    // portent plus sur le même périmètre : désigner un « meilleur » reviendrait à récompenser
    // celui qui a simplement sorti une dépense du total. On retire alors le surlignage de ces
    // trois lignes — les montants restent affichés, seule la comparaison directe est suspendue.
    const memeSourceAssurance = summaries.every(s => s.incendieExterne === summaries[0].incendieExterne);
    const bestPossession = memeSourceAssurance;

    let html =
      '<div class="c-head">' +
        '<h1>Comparaison de simulations</h1>' +
        '<p class="c-sub">' + entries.length + ' simulations</p>' +
      '</div>';

    // fmt() sépare les milliers par une espace insécable (voulu partout ailleurs, pour ne
    // jamais couper juste avant "€"). Dans des colonnes aussi resserrées, ça empêche TOUT
    // retour à la ligne propre : le nombre entier devient un seul "mot" qui, s'il ne tient
    // pas, se coupe n'importe où en plein milieu d'un chiffre. On la remplace par une espace
    // normale ici, pour que le pire cas soit "310" / "000 €" plutôt que "310 00" / "0 €".
    const euros = (v) => (v == null ? '—' : fmt(Math.round(v)).replace(/ /g, ' '));
    const eurosPerMois = (v) => (v == null ? '—' : euros(v) + ' /mois');
    const eurosPerAn = (v) => (v == null ? '—' : euros(v) + ' /an');

    // Une seule table, une ligne par banque : ne garde que l'essentiel pour tenir sur une
    // page A4 paysage sans défilement horizontal. Les critères secondaires (mode, emprunteurs,
    // aménagement, apport, quotité, garantie retenue, compte bancaire, indemnité de
    // remboursement anticipé...) restent dans le récapitulatif de chaque simulation ; ils
    // n'ont plus leur place ici une fois qu'on vise le coup d'œil sur une seule ligne/banque.
    const cols = [
      col('Montant emprunté', summaries.map((s) => s.montant), { formatter: euros }),
      col('Taux annuel', entries.map((e) => e.state.tauxPct.toFixed(2) + ' %')),
      col('Durée', entries.map((e) => e.state.dureeChoisie + ' ans')),
      col('Mensualité', summaries.map((s) => s.mensualite), { best: true, formatter: eurosPerMois }),
      col('Coût total des intérêts', summaries.map((s) => s.totalInterest), { best: true, formatter: euros }),
      col('Frais bancaires', entries.map((e) => e.state.fraisBancaires || 0), { best: true, formatter: euros }),
      // Libellés courts + title=" " (infobulle) : dans une colonne aussi resserrée, un mot
      // plus long que la colonne se coupait en plein milieu même avec un point de coupure —
      // plus fiable de raccourcir que de multiplier les <wbr>.
      col('Hypothèque', entries.map((e) => e.state.fraisHypo || 0), { best: true, formatter: euros, titre: 'Frais d’hypothèque' }),
      col('ADI', entries.map((e) => (e.state.cout && e.state.cout.asrd) || 0), { best: true, formatter: eurosPerAn, titre: 'Assurance solde restant dû (ADI)' }),
      // Reste "apparent" comme demandé : le montant ET l'endroit de souscription, sur une seule
      // colonne (2ème ligne en note), pour ne pas rouvrir une colonne dédiée à la souscription.
      col('Habitation', entries.map((e) => (e.state.cout && e.state.cout.incendie) || 0), {
        best: true,
        titre: 'Assurance habitation (incendie + RC)',
        formatter: (v, i) => eurosPerAn(v) + '<br><span class="cmp-cell-sub">' +
          (summaries[i].incendieExterne ? 'Externe, hors total' : 'Via la banque') + '</span>'
      }),
      // Coût imposé/facturé en €/an dans l'outil (cf. cost.js), affiché ici en €/mois comme
      // demandé — plus parlant à mettre en regard de la mensualité du prêt.
      col('Compte', entries.map((e) => (e.state.cout && e.state.cout.compte) || 0), {
        best: true,
        titre: 'Compte bancaire (imposé par la banque)',
        formatter: (v) => (v == null ? '—' : fmt(Math.round(v / 12)) + ' /mois')
      }),
      col('Coût annuel de possession', summaries.map((s) => s.totalAn), { best: bestPossession, formatter: eurosPerAn }),
      col('Coût total du crédit', summaries.map((s) => s.coutCredit), { best: true, formatter: euros, total: true })
    ];

    // Rendu transposé : banques en ordonnée (une ligne chacune, sticky à gauche pendant le
    // défilement horizontal — filet de sécurité, plus nécessaire qu'aux petits écrans une fois
    // le nombre de colonnes réduit), critères en abscisse (une colonne chacun, sticky en haut).
    html += '<div class="cmp-scroll"><table class="c-table c-table--data cmp-table cmp-table--transposed"><thead><tr>' +
      '<th class="cmp-corner">Simulation</th>' +
      cols.map(c => '<th' + (c.total ? ' class="cmp-total-col"' : '') + (c.titre ? ' title="' + c.titre + '"' : '') + '>' + c.label + '</th>').join('') +
      '</tr></thead><tbody>';

    entries.forEach((e, i) => {
      const isWinner = i === gagnant;
      // Le logo + nom de la banque remplacent le titre complet de la simulation (qui répète
      // montant et taux, déjà présents en colonne) — plus lisible, et demandé tel quel.
      const banque = (typeof banqueParId === 'function') ? banqueParId(e.state.banqueId) : null;
      const nomAffiche = banque ? banque.nom : (e.nom || 'Sans nom');
      const badge = (typeof banqueBadge === 'function') ? banqueBadge(e.state.banqueId, 'sm') : '';
      html += '<tr>' +
        '<th scope="row"' + (isWinner ? ' class="cmp-winner"' : '') + '>' +
          '<span class="cmp-bank-cell">' + badge + '<span class="cmp-bank-name">' + nomAffiche + '</span></span>' +
        (isWinner ? '<span class="cmp-winner__tag">Meilleure offre</span>' : '') + '</th>' +
        cols.map(c => {
          const classes = [];
          if (c.bestSet.has(i)) classes.push('cmp-best');
          if (c.total) classes.push('cmp-total-col');
          return '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + c.formatter(c.values[i], i) + '</td>';
        }).join('') +
        '</tr>';
    });

    html += '</tbody></table></div>';

    doc.innerHTML = html;
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('recap-open');
  }

  // Impression / export PDF : le document est déjà large (format A4 paysage à l'écran) —
  // on force l'orientation "paysage" de la page imprimée elle-même, via une règle @page
  // injectée juste pour cette impression puis retirée (pas d'impact sur le contrat/récap,
  // qui restent en portrait par défaut du navigateur).
  function print() {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 landscape; margin: 12mm; }';
    document.head.appendChild(style);
    const cleanup = () => style.remove();
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
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
  if (btnPrint) btnPrint.addEventListener('click', print);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();
