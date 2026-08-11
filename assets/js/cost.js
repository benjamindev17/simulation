/* ==========================================================================
   Onglet « Coût total annuel » — coût de possession de l'appartement.
   Mensualités (reprises de la simu) + charges récurrentes → coût annuel total,
   équivalent mensuel, part par personne (50/50), et coût réel hors capital.
   refreshCout() est rappelée par renderCalc (garde) pour suivre la mensualité.
   ========================================================================== */
(function () {
  const el = (id) => document.getElementById(id);
  const elMensualite = el('cout-mensualite');
  const elAsrd = el('in-cout-asrd');
  const elIncendie = el('in-cout-incendie');
  const elCopro = el('in-cout-copro');
  const elReserve = el('in-cout-reserve');
  const elPrecompte = el('in-cout-precompte');
  const elDechets = el('in-cout-dechets');
  const elCharges = el('in-cout-charges');
  const elEnergie = el('in-cout-energie');
  if (!elAsrd) return;

  // Valeurs par défaut (Wallonie) fournies par l'utilisateur.
  let asrd = 220;        // €/an
  let incendie = 300;    // €/an
  let copro = 125;       // €/mois
  let reserve = 100;     // €/mois total (50 € par personne)
  let precompte = 1250;  // €/an
  let dechets = 100;     // €/an
  let charges = 50;      // €/mois (entretien privatif)
  let energie = 0;       // €/mois (optionnel)

  const row = (poste, an, cls) =>
    '<tr><td>' + poste + '</td><td' + (cls ? ' class="' + cls + '"' : '') + '>' + fmt(Math.round(an)) +
    '</td><td' + (cls ? ' class="' + cls + '"' : '') + '>' + fmt(Math.round(an / 12)) + '</td></tr>';

  window.refreshCout = function refreshCout() {
    const loan = (typeof lastLoanData !== 'undefined' && lastLoanData) ? lastLoanData : null;
    const mensualite = loan ? loan.mensualite : 0;
    const loanAmount = loan ? loan.loanAmount : 0;
    const years = (typeof dureeChoisie !== 'undefined') ? dureeChoisie : 20;

    // Réaffiche les champs (au cas où) et l'état courant.
    elMensualite.textContent = fmt(Math.round(mensualite));
    elAsrd.value = Math.round(asrd);
    elIncendie.value = Math.round(incendie);
    elCopro.value = Math.round(copro);
    elReserve.value = Math.round(reserve);
    elPrecompte.value = Math.round(precompte);
    elDechets.value = Math.round(dechets);
    elCharges.value = Math.round(charges);
    elEnergie.value = Math.round(energie);

    const anMensualite = mensualite * 12;
    const anCopro = copro * 12;
    const anReserve = reserve * 12;
    const anCharges = charges * 12;
    const anEnergie = energie * 12;

    const totalAn = anMensualite + asrd + incendie + anCopro + anReserve + precompte + dechets + anCharges + anEnergie;
    const capitalMoyenAn = years > 0 ? loanAmount / years : 0; // capital remboursé moyen par an (= épargne)
    const coutReelAn = totalAn - capitalMoyenAn;

    el('cout-total-an').textContent = fmt(Math.round(totalAn));
    el('cout-mensuel').textContent = fmt(Math.round(totalAn / 12));
    el('cout-pp').textContent = fmt(Math.round(totalAn / 2));
    el('cout-reel').textContent = fmt(Math.round(coutReelAn));
    el('cout-reel-mois').textContent = fmt(Math.round(coutReelAn / 12));

    let html = row('Mensualité du prêt (capital + intérêts)', anMensualite);
    html += row('Assurance solde restant dû (ADI)', asrd);
    html += row('Assurance habitation (incendie + RC)', incendie);
    html += row('Charges de copropriété', anCopro);
    html += row('Fonds de réserve (gros travaux)', anReserve);
    html += row('Précompte immobilier', precompte);
    html += row('Taxe déchets', dechets);
    html += row('Charges appartement (entretien privatif)', anCharges);
    if (energie > 0) html += row('Énergie & eau', anEnergie);
    html += '<tr class="cout-total-row"><td>Total</td><td>' + fmt(Math.round(totalAn)) + '</td><td>' + fmt(Math.round(totalAn / 12)) + '</td></tr>';
    el('cout-tbody').innerHTML = html;
  };

  const num = (v) => Math.max(0, parseFloat(v) || 0);
  elAsrd.addEventListener('change', () => { asrd = num(elAsrd.value); refreshCout(); });
  elIncendie.addEventListener('change', () => { incendie = num(elIncendie.value); refreshCout(); });
  elCopro.addEventListener('change', () => { copro = num(elCopro.value); refreshCout(); });
  elReserve.addEventListener('change', () => { reserve = num(elReserve.value); refreshCout(); });
  elPrecompte.addEventListener('change', () => { precompte = num(elPrecompte.value); refreshCout(); });
  elDechets.addEventListener('change', () => { dechets = num(elDechets.value); refreshCout(); });
  elCharges.addEventListener('change', () => { charges = num(elCharges.value); refreshCout(); });
  elEnergie.addEventListener('change', () => { energie = num(elEnergie.value); refreshCout(); });

  refreshCout();
})();
