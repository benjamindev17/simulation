/* ==========================================================================
   Récapitulatif d'une simulation consultée depuis « Mes simulations ».
   Vue lecture seule, mise en page façon document (réutilise le style visuel
   de l'aperçu du contrat) — ce n'est jamais un vrai PDF généré/téléchargé.
   Le tableau d'étalement mensuel (mois par mois) n'y figure volontairement pas ;
   il reste disponible après passage en mode modification (bouton crayon).
   ========================================================================== */
(function () {
  const overlay = document.getElementById('recap-overlay');
  const doc = document.getElementById('recap-doc');
  const btnEdit = document.getElementById('btn-recap-edit');
  const btnClose = document.getElementById('btn-close-recap');
  if (!overlay || !doc) return;

  let onEdit = null; // callback fourni par dashboard.js au moment de l'ouverture

  const pct0 = (x) => Math.round(x) + ' %';
  const row = (poste, an) =>
    '<tr><td>' + poste + '</td><td>' + fmt(Math.round(an)) + '</td><td>' + fmt(Math.round(an / 12)) + '</td></tr>';

  function build(nom, updatedAtLabel) {
    const loan = (typeof lastLoanData !== 'undefined' && lastLoanData) ? lastLoanData : buildLoanSchedule();
    const isSolo = mode === 'solo';
    const totalInterest = loan.schedule[loan.nTotal].cumInterest;
    const finShares = !isSolo ? shareAtRow(loan.schedule[loan.nTotal]) : null;
    const benPct = Math.round(benRatio * 100);
    const mariePct = 100 - benPct;
    const horsEmprunt = typeof elChkFraisHorsEmprunt !== 'undefined' && elChkFraisHorsEmprunt && elChkFraisHorsEmprunt.checked;
    const today = new Date().toLocaleDateString('fr-BE');

    // Coût total annuel — mêmes valeurs que l'onglet dédié (les champs sont tenus à jour par cost.js).
    const asrd = numVal('in-cout-asrd');
    const incendie = numVal('in-cout-incendie');
    const compte = numVal('in-cout-compte');
    const copro = numVal('in-cout-copro');
    const reserve = numVal('in-cout-reserve');
    const precompte = numVal('in-cout-precompte');
    const dechets = numVal('in-cout-dechets');
    const charges = numVal('in-cout-charges');
    const energie = numVal('in-cout-energie');
    const anMensualite = loan.mensualite * 12;
    const anCopro = copro * 12, anReserve = reserve * 12, anCharges = charges * 12, anEnergie = energie * 12;
    const totalAn = anMensualite + asrd + incendie + compte + anCopro + anReserve + precompte + dechets + anCharges + anEnergie;
    const chargesMois = (totalAn - anMensualite) / 12;
    const totalMois = loan.mensualite + chargesMois;
    const capitalMoyenAn = dureeChoisie > 0 ? loan.loanAmount / dureeChoisie : 0;
    const coutReelAn = totalAn - capitalMoyenAn;

    let html =
      '<div class="c-head">' +
        '<h1>Récapitulatif de simulation</h1>' +
        '<p class="c-sub">' + (nom || 'Sans nom') + (updatedAtLabel ? ' — mis à jour le ' + updatedAtLabel : '') + '</p>' +
      '</div>';

    html += '<h2>Emprunteur' + (isSolo ? '' : 's') + '</h2>';
    html += '<table class="c-table c-table--kv">';
    html += isSolo
      ? '<tr><td>Emprunteur</td><td>' + nomA + '</td></tr>' +
        '<tr><td>Revenu mensuel net</td><td>' + fmt(Math.round(salaireSolo)) + '</td></tr>'
      : '<tr><td>Emprunteur 1</td><td>' + nomA + ' — salaire ' + fmt(Math.round(salaireBen)) + '/mois</td></tr>' +
        '<tr><td>Emprunteur 2</td><td>' + nomB + ' — salaire ' + fmt(Math.round(salaireMarie)) + '/mois</td></tr>';
    html += '</table>';

    html += '<h2>Bien &amp; frais d’acquisition</h2>';
    html += '<table class="c-table c-table--kv">' +
      '<tr><td>Prix de l’appartement</td><td>' + fmt(Math.round(prixAppart)) + '</td></tr>' +
      (travaux > 0 ? '<tr><td>Aménagement</td><td>' + fmt(Math.round(travaux)) + '</td></tr>' : '') +
      '<tr><td>Frais d’enregistrement (3 %)</td><td>' + fmt(Math.round(fraisEnregCalc())) + '</td></tr>' +
      '<tr><td>Frais de notaire</td><td>' + fmt(Math.round(fraisNotaire)) + '</td></tr>' +
      '<tr><td>Frais bancaires</td><td>' + fmt(Math.round(fraisBancaires)) + '</td></tr>' +
      '<tr class="c-total"><td>Coût total du projet</td><td>' + fmt(Math.round(coutTotalCalc())) + '</td></tr>' +
      '</table>';
    html += '<p>Frais ' + (horsEmprunt ? 'payés séparément, hors emprunt.' : 'inclus dans le financement.') + '</p>';

    html += '<h2>Apport &amp; emprunt</h2>';
    html += '<table class="c-table c-table--kv">';
    html += isSolo
      ? '<tr class="c-total"><td>Apport</td><td>' + fmt(Math.round(apport)) + '</td></tr>'
      : '<tr><td>Apport ' + nomA + '</td><td>' + fmt(Math.round(APPORT_A)) + ' (' + pct0(benPct) + ')</td></tr>' +
        '<tr><td>Apport ' + nomB + '</td><td>' + fmt(Math.round(APPORT_B)) + ' (' + pct0(mariePct) + ')</td></tr>' +
        '<tr class="c-total"><td>Apport total</td><td>' + fmt(Math.round(apport)) + '</td></tr>';
    html += '<tr><td>Montant emprunté</td><td>' + fmt(Math.round(loan.loanAmount)) + '</td></tr>' +
      '<tr><td>Taux annuel</td><td>' + tauxPct.toFixed(2) + ' %</td></tr>' +
      '<tr><td>Durée</td><td>' + dureeChoisie + ' ans</td></tr>' +
      '<tr class="c-total"><td>Mensualité</td><td>' + fmt(Math.round(loan.mensualite)) + '/mois</td></tr>' +
      '<tr><td>Coût total des intérêts sur la durée</td><td>' + fmt(Math.round(totalInterest)) + '</td></tr>' +
      '</table>';

    html += '<h2>Remboursement anticipé</h2>';
    html += '<table class="c-table c-table--kv">' +
      '<tr><td>Indemnité prévue au contrat</td><td>' + iraMois.toFixed(1).replace(/\.0$/, '') + ' mois d’intérêts</td></tr>' +
      '</table>';
    html += '<p>' + (iraConditions
      ? 'Conditions particulières : ' + iraConditions + '.'
      : 'Aucune condition particulière renseignée — plafond légal en Belgique : 3 mois d’intérêts sur le capital remboursé par anticipation.') + '</p>';

    if (!isSolo) {
      html += '<h2>Répartition de la propriété</h2>';
      html += '<p>Modèle : ' + (equalizeShares
        ? '<b>équilibré</b> — intérêts partagés 50/50, propriété visée à 50/50 au terme du prêt.'
        : 'chacun rembourse la moitié de la mensualité.') + '</p>';
      html += '<table class="c-table c-table--kv">' +
        '<tr><td>' + nomA + ' paie</td><td>' + fmt(Math.round(payBen)) + '/mois</td></tr>' +
        '<tr><td>' + nomB + ' paie</td><td>' + fmt(Math.round(payMarie)) + '/mois</td></tr>' +
        '<tr><td>Quotité à l’achat (selon les apports)</td><td>' + nomA + ' ' + pct0(benPct) + ' · ' + nomB + ' ' + pct0(mariePct) + '</td></tr>' +
        '<tr><td>Quotité visée au terme du prêt</td><td>' + nomA + ' ' + fmtPct(finShares.shareA) + ' · ' + nomB + ' ' + fmtPct(finShares.shareB) + '</td></tr>' +
        '</table>';
    }

    html += '<h2>Coût total annuel de possession</h2>';
    html += '<table class="c-table c-table--data"><thead><tr><th>Poste</th><th>Par an</th><th>Par mois</th></tr></thead><tbody>' +
      row('Mensualité du prêt (capital + intérêts)', anMensualite) +
      row('Assurance solde restant dû (ADI)', asrd) +
      row('Assurance habitation', incendie) +
      (compte > 0 ? row('Compte bancaire (imposé par la banque)', compte) : '') +
      row('Charges de copropriété', anCopro) +
      row('Fonds de réserve', anReserve) +
      row('Précompte immobilier', precompte) +
      row('Taxe déchets', dechets) +
      row('Charges appartement', anCharges) +
      (energie > 0 ? row('Énergie &amp; eau', anEnergie) : '') +
      '<tr class="c-total"><td>Total</td><td>' + fmt(Math.round(totalAn)) + '</td><td>' + fmt(Math.round(totalAn / 12)) + '</td></tr>' +
      '</tbody></table>';
    html += '<p class="c-annex-note">Charges mensualisées hors prêt : ' + fmt(Math.round(chargesMois)) + '/mois · Total prêt + charges : ' +
      fmt(Math.round(totalMois)) + '/mois' + (!isSolo ? ' (' + fmt(Math.round(totalMois / 2)) + '/mois chacun)' : '') +
      ' · Coût réel hors capital : ' + fmt(Math.round(coutReelAn)) + '/an.</p>';

    html += '<p class="c-annex-note">Récapitulatif généré le ' + today + '. Le tableau d’étalement mensuel complet reste disponible dans l’onglet « ' +
      (isSolo ? 'Tableau d’étalement' : 'Répartition appartement') + ' » après passage en mode modification.</p>';

    doc.innerHTML = html;
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('recap-open');
  }

  window.openRecap = function (nom, updatedAtLabel, editCallback) {
    build(nom, updatedAtLabel);
    onEdit = editCallback || null;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('recap-open');
    overlay.scrollTop = 0;
  };
  window.closeRecap = close;

  if (btnEdit) btnEdit.addEventListener('click', () => { close(); if (onEdit) onEdit(); });
  if (btnClose) btnClose.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();
