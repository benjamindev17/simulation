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
    return { label, values, formatter, bestSet, total: !!opts.total };
  }

  function build(entries) {
    const summaries = entries.map(e => computeSummary(e.state));

    // Meilleure offre = coût du crédit le plus faible. En cas d'égalité parfaite, on ne
    // désigne personne : mettre l'une des deux en avant serait arbitraire.
    const couts = summaries.map(s => s.coutCredit);
    const minCout = Math.min(...couts);
    const exAequo = couts.filter(v => v === minCout).length > 1;
    const gagnant = exAequo ? -1 : couts.indexOf(minCout);

    // Le classement ne vaut que si les simulations portent sur le même emprunt : à montant
    // ou durée différents, le moins cher est simplement celui qui emprunte moins ou moins
    // longtemps, pas celui qui propose la meilleure offre. On le dit plutôt que de laisser
    // croire à une comparaison d'offres bancaires.
    const memeMontant = summaries.every(s => Math.round(s.montant) === Math.round(summaries[0].montant));
    const memeDuree = entries.every(e => e.state.dureeChoisie === entries[0].state.dureeChoisie);

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

    const euros = (v) => (v == null ? '—' : fmt(Math.round(v)));
    const eurosPerMois = (v) => (v == null ? '—' : fmt(Math.round(v)) + '/mois');
    const eurosPerAn = (v) => (v == null ? '—' : fmt(Math.round(v)) + '/an');

    // Regroupé en petites tables thématiques (5 critères max) plutôt qu'une seule table de
    // 25 colonnes : même en A4 paysage, autant de colonnes forçait un défilement horizontal
    // permanent. Chaque groupe tient seul dans la largeur de l'écran ; .cmp-scroll ne sert
    // alors plus que de filet de sécurité sur les très petits écrans.
    const groups = [
      { titre: 'Bien & apport', cols: [
        col('Mode', entries.map((e, i) => summaries[i].isSolo ? 'Seul(e)' : 'À deux')),
        col('Emprunteur(s)', entries.map((e, i) => summaries[i].isSolo ? e.state.nomA : e.state.nomA + ' / ' + e.state.nomB)),
        col('Prix de l’appartement', entries.map((e) => e.state.prixAppart), { formatter: euros }),
        col('Aménagement', entries.map((e) => e.state.travaux || 0), { formatter: euros }),
        col('Apport total', entries.map((e) => e.state.apport), { formatter: euros })
      ]},
      { titre: 'Financement', cols: [
        col('Coût total du projet', summaries.map((s) => s.coutTotal), { formatter: euros }),
        col('Montant emprunté', summaries.map((s) => s.montant), { formatter: euros }),
        col('Quotité empruntée', summaries.map((s) => s.quotiteEmpruntee), { formatter: (v) => v.toFixed(2) + ' %' }),
        col('Taux annuel', entries.map((e) => e.state.tauxPct.toFixed(2) + ' %')),
        col('Durée', entries.map((e) => e.state.dureeChoisie + ' ans'))
      ]},
      { titre: 'Mensualité & frais du prêt', cols: [
        col('Mensualité', summaries.map((s) => s.mensualite), { best: true, formatter: eurosPerMois }),
        col('Coût total des intérêts', summaries.map((s) => s.totalInterest), { best: true, formatter: euros }),
        col('Frais bancaires (frais de dossier)', entries.map((e) => e.state.fraisBancaires || 0), { best: true, formatter: euros }),
        col('Frais d’hypothèque', entries.map((e) => e.state.fraisHypo || 0), { best: true, formatter: euros }),
        col('— garantie retenue', entries.map((e) => HYPO_LABELS[e.state.hypoType] || HYPO_LABELS.inscription))
      ]},
      { titre: 'Assurances & charges', cols: [
        col('Assurance solde restant dû (ADI)', entries.map((e) => (e.state.cout && e.state.cout.asrd) || 0), { best: true, formatter: eurosPerAn }),
        col('Assurance habitation (incendie + RC)', entries.map((e) => (e.state.cout && e.state.cout.incendie) || 0), { best: true, formatter: eurosPerAn }),
        col('— souscription', summaries.map((s) => s.incendieExterne
          ? 'Chez un assureur (hors total)' : 'Proposée par la banque')),
        col('Compte bancaire', entries.map((e) => (e.state.cout && e.state.cout.compte) || 0), { best: true, formatter: eurosPerAn })
      ]},
      { titre: 'Coût de possession', cols: [
        col('Coût annuel de possession', summaries.map((s) => s.totalAn), { best: bestPossession, formatter: eurosPerAn }),
        col('Total prêt + charges', summaries.map((s) => s.totalMois), { best: bestPossession, formatter: eurosPerMois }),
        col('Coût réel hors capital', summaries.map((s) => s.coutReelAn), { best: bestPossession, formatter: eurosPerAn })
      ]},
      { titre: 'Remboursement anticipé & synthèse', cols: [
        col('Indemnité de remboursement anticipé', entries.map((e) => e.state.iraMois != null ? e.state.iraMois : 3), {
          best: true,
          formatter: (v) => (v == null ? '—' : (v.toFixed(1).replace(/\.0$/, '') + ' mois'))
        }),
        col('Conditions particulières (remb. anticipé)', entries.map((e) => e.state.iraConditions || null)),
        col('Coût total du crédit', summaries.map((s) => s.coutCredit), { best: true, formatter: euros, total: true })
      ]}
    ];

    // Rendu transposé : banques en ordonnée (une ligne chacune, sticky à gauche pendant le
    // défilement horizontal), critères en abscisse (une colonne chacun, sticky en haut).
    groups.forEach((g) => {
      html += '<h2>' + g.titre + '</h2>' +
        '<div class="cmp-scroll"><table class="c-table c-table--data cmp-table cmp-table--transposed"><thead><tr>' +
        '<th class="cmp-corner">Simulation</th>' +
        g.cols.map(c => '<th' + (c.total ? ' class="cmp-total-col"' : '') + '>' + c.label + '</th>').join('') +
        '</tr></thead><tbody>';

      entries.forEach((e, i) => {
        const isWinner = i === gagnant;
        html += '<tr>' +
          '<th scope="row"' + (isWinner ? ' class="cmp-winner"' : '') + '>' + (e.nom || 'Sans nom') +
          (isWinner ? '<span class="cmp-winner__tag">Meilleure offre</span>' : '') + '</th>' +
          g.cols.map(c => {
            const classes = [];
            if (c.bestSet.has(i)) classes.push('cmp-best');
            if (c.total) classes.push('cmp-total-col');
            return '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + c.formatter(c.values[i]) + '</td>';
          }).join('') +
          '</tr>';
      });

      html += '</tbody></table></div>';
    });

    html += '<p class="c-annex-note"><b>Meilleure offre</b> = coût total du crédit le plus bas : ' +
      'intérêts + frais de dossier + frais d’hypothèque + assurance solde restant dû + compte imposé, ' +
      'sur toute la durée. ' +
      'Le capital emprunté en est exclu (il se rembourse quelle que soit la banque), ainsi que les ' +
      'charges du bien (précompte, copropriété, énergie, assurance habitation), qui ne dépendent pas ' +
      'du prêteur. L’indemnité de remboursement anticipé n’y entre pas non plus : elle n’est due que ' +
      'si tu rembourses par anticipation — à comparer à part, sur sa ligne.</p>';

    if (summaries.some(s => s.incendieExterne)) {
      html += '<p class="c-annex-note">Quand l’assurance habitation est <b>prise chez un assureur</b>, ' +
        'sa prime sort du <b>coût annuel de possession</b> : ce total ne retient alors que ce qui passe ' +
        'par l’offre bancaire. Le montant reste affiché sur sa ligne — il est ré-attribué, pas supprimé, ' +
        'et tu continues bien sûr à le payer. L’outil et le récapitulatif, eux, affichent le coût réellement ' +
        'déboursé, assurance comprise.' +
        (memeSourceAssurance ? '' : ' Les simulations comparées ne souscrivant pas toutes au même endroit, ' +
          'le repérage du montant le plus bas est désactivé sur les trois lignes de possession : ' +
          'elles ne portent pas sur le même périmètre.') + '</p>';
    }

    if (!memeMontant || !memeDuree) {
      const cause = !memeMontant && !memeDuree ? 'le montant emprunté et la durée diffèrent'
        : (!memeMontant ? 'le montant emprunté diffère' : 'la durée diffère');
      html += '<p class="c-annex-note cmp-warn"><b>Attention</b> — ' + cause +
        ' d’une simulation à l’autre. Le classement reflète alors autant le scénario ' +
        '(emprunter moins, ou moins longtemps, coûte mécaniquement moins cher) que la qualité de ' +
        'l’offre bancaire. Pour comparer réellement des banques, garde le même montant et la même durée.</p>';
    }

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
