/* ==========================================================================
   Onglet « Coût de la vie » — budget mensuel par personne : revenu net et
   coût du logement (prêt + charges) repris automatiquement de Simulation
   taux / Coût total annuel, plus une liste libre de dépenses (nourriture,
   loisirs, sport…) qu'on peut ajouter ou supprimer.
   window.refreshBudget est appelé depuis renderCalc() (rate-simulation.js)
   à chaque changement, pour resynchroniser revenu/logement/totaux.
   window.getBudgetState()/setBudgetState() sont utilisés par state.js pour
   sauvegarder/restaurer les dépenses avec le reste de la simulation.
   ========================================================================== */
(function () {
  const elPersonB = document.getElementById('budget-person-b');
  const elCombined = document.getElementById('budget-combined');
  const elTbodyA = document.getElementById('budget-tbody-a');
  const elTbodyB = document.getElementById('budget-tbody-b');
  const elFlowToggle = document.getElementById('flow-toggle');
  const elFlowSummary = document.getElementById('flow-summary');
  const elFlowChart = document.getElementById('flow-chart');
  if (!elTbodyA) return;

  // Dépenses "vierges" par défaut (montant à 0) — la liste est de toute façon librement
  // modifiable (ajout/suppression/renommage), ce ne sont que des points de départ.
  let depensesA = [
    { label: 'Nourriture', montant: 0 },
    { label: 'Loisirs', montant: 0 },
    { label: 'Sport', montant: 0 },
    { label: 'Transport', montant: 0 }
  ];
  let depensesB = [
    { label: 'Nourriture', montant: 0 },
    { label: 'Loisirs', montant: 0 },
    { label: 'Sport', montant: 0 },
    { label: 'Transport', montant: 0 }
  ];

  // Belgique : le salaire net mensuel ne représente qu'une partie du revenu annuel réel —
  // s'y ajoutent le double pécule de vacances et la prime de fin d'année (13e mois), soit
  // l'équivalent d'environ 13,6 mois de salaire net sur l'année (plutôt que 12).
  const MOIS_SALAIRE_PAR_AN = 13.6;

  function sumDepenses(depenses) {
    return depenses.reduce((s, d) => s + (d.montant || 0), 0);
  }

  // Coût logement mensuel, séparé en deux parts — même formule que cost.js/refreshCout,
  // recalculée ici plutôt que lue depuis son état interne (encapsulé dans son IIFE).
  // La mensualité est rendue à part car elle ne se partage pas forcément en deux :
  // chacun porte la sienne (cf. renderBudget).
  function coutLogement() {
    const loan = (typeof lastLoanData !== 'undefined' && lastLoanData) ? lastLoanData : buildLoanSchedule();
    const mensualite = loan.mensualite;
    const asrd = numVal('in-cout-asrd');
    const incendie = numVal('in-cout-incendie');
    const compte = numVal('in-cout-compte');
    const copro = numVal('in-cout-copro');
    const reserve = numVal('in-cout-reserve');
    const precompte = numVal('in-cout-precompte');
    const dechets = numVal('in-cout-dechets');
    const charges = numVal('in-cout-charges');
    const energie = numVal('in-cout-energie');
    const anMensualite = mensualite * 12;
    const totalAn = anMensualite + asrd + incendie + compte + copro * 12 + reserve * 12 + precompte + dechets + charges * 12 + energie * 12;
    return { mensualite, chargesMois: (totalAn - anMensualite) / 12 };
  }

  function renderRows(tbody, depenses) {
    tbody.innerHTML = '';
    depenses.forEach((d, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="budget-label" maxlength="40"></td>' +
        '<td><input type="number" class="budget-amount" step="5" min="0"></td>' +
        '<td><button type="button" class="budget-remove" title="Supprimer">✕</button></td>';
      const elLabel = tr.querySelector('.budget-label');
      const elAmount = tr.querySelector('.budget-amount');
      elLabel.value = d.label;
      elAmount.value = d.montant;
      elLabel.addEventListener('change', () => { d.label = elLabel.value.trim() || 'Dépense'; renderBudget(); });
      elAmount.addEventListener('change', () => { d.montant = Math.max(0, parseFloat(elAmount.value) || 0); renderBudget(); });
      tr.querySelector('.budget-remove').addEventListener('click', () => {
        depenses.splice(i, 1);
        renderBudget();
      });
      tbody.appendChild(tr);
    });
  }

  // Source unique de vérité pour l'onglet : les cartes, les totaux et le
  // diagramme de flux lisent tous ce même calcul.
  function computeBudget() {
    const isSolo = typeof mode !== 'undefined' && mode === 'solo';

    // Part logement de chacun = SA mensualité réelle (payBen/payMarie, calculés dans
    // ownership.js et qui tiennent compte du mode « équilibré ») + sa part des charges.
    // Diviser le tout par deux masquerait l'écart quand l'un rembourse davantage.
    const { mensualite, chargesMois } = coutLogement();
    const mensA = (typeof payBen !== 'undefined') ? payBen : (isSolo ? mensualite : mensualite / 2);
    const mensB = (typeof payMarie !== 'undefined') ? payMarie : mensualite / 2;
    const chargesA = isSolo ? chargesMois : chargesMois / 2;
    const chargesB = chargesMois / 2;

    const person = (nom, revenu, pret, charges, depenses) => {
      const total = pret + charges + sumDepenses(depenses);
      return {
        nom: nom, revenu: revenu, pret: pret, charges: charges,
        logement: pret + charges, depenses: depenses,
        total: total, epargne: revenu - total
      };
    };

    return {
      isSolo: isSolo,
      a: person(nomA, isSolo ? salaireSolo : salaireBen, mensA, chargesA, depensesA),
      b: person(nomB, salaireMarie, mensB, chargesB, depensesB)
    };
  }

  function renderBudget() {
    const b = computeBudget();
    const isSolo = b.isSolo;
    elPersonB.hidden = isSolo;
    elCombined.hidden = isSolo;

    document.getElementById('budget-revenu-a').textContent = fmt(Math.round(b.a.revenu));
    document.getElementById('budget-logement-a').textContent = fmt(Math.round(b.a.logement)) + '/mois';
    document.getElementById('budget-total-a').textContent = fmt(Math.round(b.a.total));
    document.getElementById('budget-epargne-a').textContent = fmt(Math.round(b.a.epargne));
    document.getElementById('budget-epargne-annuelle-a').textContent = fmt(Math.round(b.a.epargne * MOIS_SALAIRE_PAR_AN));

    if (!isSolo) {
      document.getElementById('budget-revenu-b').textContent = fmt(Math.round(b.b.revenu));
      document.getElementById('budget-logement-b').textContent = fmt(Math.round(b.b.logement)) + '/mois';
      document.getElementById('budget-total-b').textContent = fmt(Math.round(b.b.total));
      document.getElementById('budget-epargne-b').textContent = fmt(Math.round(b.b.epargne));
      document.getElementById('budget-epargne-annuelle-b').textContent = fmt(Math.round(b.b.epargne * MOIS_SALAIRE_PAR_AN));

      const epargneCombine = b.a.epargne + b.b.epargne;
      document.getElementById('budget-revenu-combine').textContent = fmt(Math.round(b.a.revenu + b.b.revenu));
      document.getElementById('budget-total-combine').textContent = fmt(Math.round(b.a.total + b.b.total));
      document.getElementById('budget-epargne-combine').textContent = fmt(Math.round(epargneCombine));
      document.getElementById('budget-epargne-annuelle-combine').textContent = fmt(Math.round(epargneCombine * MOIS_SALAIRE_PAR_AN));
    }

    renderRows(elTbodyA, depensesA);
    if (!isSolo) renderRows(elTbodyB, depensesB);

    renderFlow(b);
  }

  /* --- Diagramme de flux (Sankey) ------------------------------------------
     Montre où part chaque euro du revenu mensuel : revenu(s) → budget →
     logement / vie quotidienne / épargne → postes de détail. Consultable pour
     l'une des deux personnes ou pour le ménage. */

  const C_REVENU = '#6a00f4';   // violet — le revenu
  const C_BUDGET = '#4a00ab';   // violet profond — le pot commun
  const C_LOGEMENT = '#6a00f4'; // violet — l'engagement immobilier
  const C_VIE = '#b05e0d';      // ambre — la consommation courante
  const C_EPARGNE = '#2f7d52';  // vert — ce qui reste
  const C_DECOUVERT = '#c0261f';

  let flowWho = 'a';

  // Fusionne les postes de plusieurs personnes : en vue combinée, deux lignes
  // « Nourriture » ne doivent former qu'un seul ruban.
  function aggregate(sources) {
    const map = new Map();
    sources.forEach(p => p.depenses.forEach(d => {
      const label = (d.label || 'Dépense').trim() || 'Dépense';
      map.set(label, (map.get(label) || 0) + (d.montant || 0));
    }));
    return {
      pret: sources.reduce((s, p) => s + p.pret, 0),
      charges: sources.reduce((s, p) => s + p.charges, 0),
      revenu: sources.reduce((s, p) => s + p.revenu, 0),
      epargne: sources.reduce((s, p) => s + p.epargne, 0),
      depenses: [...map.entries()].map(([label, montant]) => ({ label, montant }))
    };
  }

  function buildFlowData(sources) {
    const agg = aggregate(sources);
    const multi = sources.length > 1;
    const deficit = Math.max(0, -agg.epargne);
    // Un nœud « Budget » distinct est nécessaire dès qu'il y a plusieurs entrées :
    // deux salaires, ou un salaire complété par un découvert.
    const useHub = multi || deficit > 0;
    const hub = useHub ? 'hub' : 'src0';
    const catCol = useHub ? 2 : 1;
    const leafCol = catCol + 1;

    const nodes = [], links = [];
    sources.forEach((p, i) => {
      nodes.push({
        id: 'src' + i,
        label: multi ? p.nom : 'Revenu net',
        col: 0,
        color: i === 0 ? C_REVENU : sankeyLighten(C_REVENU, 0.34)
      });
      if (useHub) links.push({ source: 'src' + i, target: 'hub', value: p.revenu, color: C_REVENU });
    });
    if (deficit > 0) {
      nodes.push({ id: 'decouvert', label: 'Manque à financer', col: 0, color: C_DECOUVERT });
      links.push({ source: 'decouvert', target: 'hub', value: deficit, color: C_DECOUVERT });
    }
    if (useHub) nodes.push({ id: 'hub', label: 'Budget', col: 1, color: C_BUDGET });

    const logement = agg.pret + agg.charges;
    const vie = agg.depenses.reduce((s, d) => s + d.montant, 0);

    nodes.push({ id: 'logement', label: 'Logement', col: catCol, color: C_LOGEMENT });
    nodes.push({ id: 'vie', label: 'Vie quotidienne', col: catCol, color: C_VIE });
    nodes.push({ id: 'epargne', label: 'Épargne', col: catCol, color: C_EPARGNE });
    links.push({ source: hub, target: 'logement', value: logement });
    links.push({ source: hub, target: 'vie', value: vie });
    links.push({ source: hub, target: 'epargne', value: Math.max(0, agg.epargne) });

    [
      { id: 'pret', label: 'Mensualité du prêt', value: agg.pret, t: 0.18 },
      { id: 'charges', label: 'Charges & assurances', value: agg.charges, t: 0.42 }
    ].forEach(l => {
      nodes.push({ id: l.id, label: l.label, col: leafCol, color: sankeyLighten(C_LOGEMENT, l.t) });
      links.push({ source: 'logement', target: l.id, value: l.value });
    });

    agg.depenses.forEach((d, i) => {
      const id = 'dep' + i;
      nodes.push({ id: id, label: d.label, col: leafCol, color: sankeyLighten(C_VIE, 0.16 + (i % 4) * 0.14) });
      links.push({ source: 'vie', target: id, value: d.montant });
    });

    return { data: { nodes, links }, agg: agg };
  }

  function flowSentence(agg, multi) {
    const taux = Math.round((agg.epargne / agg.revenu) * 100);
    const b = (v) => '<b>' + fmt(Math.round(v)) + '</b>';
    const sujet = multi
      ? { poss: 'Votre', verbe: 'Vous avez', reste: 'il vous reste', manque: 'il vous manque' }
      : { poss: 'Ton', verbe: 'Tu as', reste: 'il te reste', manque: 'il te manque' };
    const fin = agg.epargne >= 0
      ? sujet.reste + ' ' + b(agg.epargne) + ' disponible.'
      : sujet.manque + ' ' + b(-agg.epargne) + ' chaque mois.';
    return sujet.poss + ' taux d\'épargne est de <b>' + taux + ' %</b>. ' +
      sujet.verbe + ' un revenu total de ' + b(agg.revenu) + ', des dépenses de ' +
      b(agg.revenu - agg.epargne) + ' tous les mois, ' + fin;
  }

  function renderFlow(b) {
    if (!elFlowChart) return;
    // En solo il n'y a qu'une personne : le sélecteur n'a plus de sens.
    elFlowToggle.hidden = b.isSolo;
    if (b.isSolo) flowWho = 'a';
    elFlowToggle.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.flow === flowWho);
    });

    const sources = flowWho === 'combine' ? [b.a, b.b] : [flowWho === 'a' ? b.a : b.b];
    const built = buildFlowData(sources);

    if (built.agg.revenu <= 0) {
      elFlowSummary.innerHTML = 'Renseigne les salaires dans <b>Simulation taux</b> pour voir la répartition du revenu.';
      elFlowChart.innerHTML = '';
      return;
    }
    elFlowSummary.innerHTML = flowSentence(built.agg, sources.length > 1);
    // Sur petit écran on resserre le corps du diagramme : la marge des libellés
    // est incompressible, autant réduire ce qui peut l'être pour limiter le scroll.
    elFlowChart.innerHTML = buildSankeySvg(built.data, {
      width: window.innerWidth < 700 ? 300 : 700,
      padRight: 200,
      fmt: (v) => fmt(Math.round(v)),
      title: 'Répartition du revenu mensuel'
    });
  }

  elFlowToggle.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      flowWho = btn.dataset.flow;
      renderFlow(computeBudget());
    });
  });

  // La largeur du diagramme dépend du palier mobile/desktop : on le retrace au
  // changement de gabarit (rotation de l'écran, redimensionnement).
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderFlow(computeBudget()), 150);
  });

  document.querySelectorAll('.budget-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const depenses = btn.dataset.person === 'a' ? depensesA : depensesB;
      depenses.push({ label: 'Nouvelle dépense', montant: 0 });
      renderBudget();
    });
  });

  window.refreshBudget = renderBudget;

  window.getBudgetState = function () {
    return {
      depensesA: depensesA.map(d => ({ label: d.label, montant: d.montant })),
      depensesB: depensesB.map(d => ({ label: d.label, montant: d.montant }))
    };
  };
  window.setBudgetState = function (data) {
    if (data && Array.isArray(data.depensesA)) depensesA = data.depensesA;
    if (data && Array.isArray(data.depensesB)) depensesB = data.depensesB;
    renderBudget();
  };

  renderBudget();
})();
