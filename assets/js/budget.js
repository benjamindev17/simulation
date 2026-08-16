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
  if (!elTbodyA) return;

  // Dépenses "vierges" par défaut (montant à 0) — la liste est de toute façon librement
  // modifiable (ajout/suppression/renommage), ce ne sont que des points de départ.
  let depensesA = [
    { label: 'Nourriture', montant: 0 },
    { label: 'Loisirs', montant: 0 },
    { label: 'Transport', montant: 0 }
  ];
  let depensesB = [
    { label: 'Nourriture', montant: 0 },
    { label: 'Loisirs', montant: 0 },
    { label: 'Transport', montant: 0 }
  ];

  function sumDepenses(depenses) {
    return depenses.reduce((s, d) => s + (d.montant || 0), 0);
  }

  // Coût logement mensuel total (mensualité + charges) — même formule que cost.js/refreshCout,
  // recalculée ici plutôt que lue depuis son état interne (encapsulé dans son IIFE).
  function coutLogementTotal() {
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
    const chargesMois = (totalAn - anMensualite) / 12;
    return mensualite + chargesMois;
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

  function renderBudget() {
    const isSolo = typeof mode !== 'undefined' && mode === 'solo';
    elPersonB.hidden = isSolo;
    elCombined.hidden = isSolo;

    const revenuA = isSolo ? salaireSolo : salaireBen;
    const revenuB = salaireMarie;
    const logementTotal = coutLogementTotal();
    const logementA = isSolo ? logementTotal : logementTotal / 2;
    const logementB = logementTotal / 2;

    const depensesTotalA = logementA + sumDepenses(depensesA);
    const depensesTotalB = logementB + sumDepenses(depensesB);

    document.getElementById('budget-revenu-a').textContent = fmt(Math.round(revenuA));
    document.getElementById('budget-logement-a').textContent = fmt(Math.round(logementA)) + '/mois';
    document.getElementById('budget-total-a').textContent = fmt(Math.round(depensesTotalA));
    document.getElementById('budget-epargne-a').textContent = fmt(Math.round(revenuA - depensesTotalA));

    if (!isSolo) {
      document.getElementById('budget-revenu-b').textContent = fmt(Math.round(revenuB));
      document.getElementById('budget-logement-b').textContent = fmt(Math.round(logementB)) + '/mois';
      document.getElementById('budget-total-b').textContent = fmt(Math.round(depensesTotalB));
      document.getElementById('budget-epargne-b').textContent = fmt(Math.round(revenuB - depensesTotalB));

      document.getElementById('budget-revenu-combine').textContent = fmt(Math.round(revenuA + revenuB));
      document.getElementById('budget-total-combine').textContent = fmt(Math.round(depensesTotalA + depensesTotalB));
      document.getElementById('budget-epargne-combine').textContent = fmt(Math.round((revenuA + revenuB) - (depensesTotalA + depensesTotalB)));
    }

    renderRows(elTbodyA, depensesA);
    if (!isSolo) renderRows(elTbodyB, depensesB);
  }

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
