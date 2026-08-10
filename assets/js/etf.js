/* ==========================================================================
   Onglet « Placement ETF » — projection d'un investissement.
   Compare, sur le MÊME horizon que le crédit (dureeChoisie), un placement ETF :
   valeur projetée, total investi, plus-value, et évolution année par année.
   Rendement composé mensuellement. refreshEtf() est appelée par renderCalc
   (via un garde) pour rester synchronisée avec la durée cochée.
   ========================================================================== */
(function () {
  const elMontant = document.getElementById('in-etf-montant');
  const elVersement = document.getElementById('in-etf-versement');
  const elRendement = document.getElementById('in-etf-rendement');
  const elSliderRend = document.getElementById('slider-etf-rendement');
  const elDuree = document.getElementById('etf-duree');
  const elValeur = document.getElementById('etf-valeur');
  const elInvesti = document.getElementById('etf-investi');
  const elPlusValue = document.getElementById('etf-plusvalue');
  const tbody = document.getElementById('etf-tbody');
  if (!elMontant) return;

  const ETF_YEARS = 25;   // horizon de placement fixé à 25 ans
  let etfMontant = 50000; // 50 000 € investis par défaut
  let etfVersement = 0;   // versement mensuel optionnel
  let etfRendement = 7;   // rendement annuel moyen (%) — hypothèse

  // Valeur future : capital initial capitalisé + versements mensuels (fin de mois) capitalisés.
  function projete(months, rMonthly) {
    const growth = Math.pow(1 + rMonthly, months);
    const fvInitial = etfMontant * growth;
    const fvVersements = rMonthly === 0 ? etfVersement * months : etfVersement * ((growth - 1) / rMonthly);
    return fvInitial + fvVersements;
  }

  // Exposée en global pour être rappelée par renderCalc quand la durée change.
  window.refreshEtf = function refreshEtf() {
    const rMonthly = etfRendement / 100 / 12;
    const years = ETF_YEARS;
    const n = years * 12;

    elMontant.value = Math.round(etfMontant);
    elVersement.value = Math.round(etfVersement);
    elRendement.value = etfRendement.toFixed(1);
    elSliderRend.value = etfRendement;
    elDuree.textContent = years + ' ans';

    const valeur = projete(n, rMonthly);
    const investi = etfMontant + etfVersement * n;
    elValeur.textContent = fmt(Math.round(valeur));
    elInvesti.textContent = fmt(Math.round(investi));
    elPlusValue.textContent = fmt(Math.round(valeur - investi));

    tbody.innerHTML = '';
    for (let y = 1; y <= years; y++) {
      const m = y * 12;
      const v = projete(m, rMonthly);
      const inv = etfMontant + etfVersement * m;
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + y + '</td><td>' + fmt(Math.round(inv)) + '</td><td>' + fmt(Math.round(v)) + '</td><td class="you">' + fmt(Math.round(v - inv)) + '</td>';
      tbody.appendChild(tr);
    }
  };

  elMontant.addEventListener('change', () => { etfMontant = Math.max(0, parseFloat(elMontant.value) || 0); refreshEtf(); });
  elVersement.addEventListener('change', () => { etfVersement = Math.max(0, parseFloat(elVersement.value) || 0); refreshEtf(); });
  elRendement.addEventListener('change', () => { etfRendement = Math.min(Math.max(0, parseFloat(elRendement.value) || 0), 12); refreshEtf(); });
  elSliderRend.addEventListener('input', () => { etfRendement = Math.min(Math.max(0, parseFloat(elSliderRend.value) || 0), 12); refreshEtf(); });

  refreshEtf();
})();
