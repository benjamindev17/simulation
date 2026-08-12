/* ==========================================================================
   Génération du projet de convention (contrat) imprimable en PDF.
   Lit l'état courant de la simulation (apports, parts, durée, mensualités,
   modèle de remboursement…) et remplit un document mis en forme. Les données
   disponibles sont pré-remplies ; les identités / le bien / la banque restent
   des lignes vides à compléter à la main.
   Belgique — Wallonie. Document préparatoire à faire valider par le notaire.
   ========================================================================== */
(function () {
  const overlay = document.getElementById('contract-overlay');
  const doc = document.getElementById('contract-doc');
  const btnGen = document.getElementById('btn-generate-contract');
  const btnPrint = document.getElementById('btn-print-contract');
  const btnClose = document.getElementById('btn-close-contract');
  if (!overlay || !doc || !btnGen) return;

  const pct = (x) => x.toFixed(2) + ' %';
  const pct0 = (x) => Math.round(x) + ' %';
  const B = (w) => '<span class="c-fill"' + (w ? ' style="min-width:' + w + 'px"' : '') + '></span>';
  const LINE = () => '<span class="c-fill c-fill--wide"></span>';

  // Synthèse annuelle : une ligne par année (capital cumulé, dont chacun, quotités, solde).
  function annualRows(loan) {
    const rows = [];
    for (let y = 1; y <= dureeChoisie; y++) {
      const m = Math.min(y * 12, loan.nTotal);
      const row = loan.schedule[m];
      const { shareA, shareB } = shareAtRow(row);
      const capBen = payBen * m - 0.5 * row.cumInterest;
      const capMarie = payMarie * m - 0.5 * row.cumInterest;
      rows.push(
        '<tr><td>' + y + '</td><td>' + fmt(Math.round(row.cumPrincipal)) + '</td><td>' +
        fmt(Math.round(capBen)) + '</td><td>' + fmt(Math.round(capMarie)) + '</td><td>' +
        pct(shareA) + '</td><td>' + pct(shareB) + '</td><td>' + fmt(Math.round(row.balance)) + '</td></tr>'
      );
    }
    return rows.join('');
  }

  function build() {
    const loan = lastLoanData || buildLoanSchedule();
    const nTotal = loan.nTotal;
    const totalInterest = loan.schedule[nTotal].cumInterest;
    const interetChacun = totalInterest / 2;
    const finShares = shareAtRow(loan.schedule[nTotal]);
    const benPct = Math.round(benRatio * 100);
    const mariePct = 100 - benPct;
    const fraisEnreg = fraisEnregCalc();
    const fraisTot = fraisTotalCalc();
    const horsEmprunt = typeof elChkFraisHorsEmprunt !== 'undefined' && elChkFraisHorsEmprunt && elChkFraisHorsEmprunt.checked;
    const today = new Date().toLocaleDateString('fr-BE');

    const modelHtml = equalizeShares
      ? '<p>Les parties conviennent que les <b>intérêts</b> du crédit, considérés comme un <b>coût commun</b>, sont supportés à parts égales (50 / 50), soit <b>' + fmt(Math.round(interetChacun)) + '</b> pour chacune sur toute la durée. Le <b>capital</b> est réparti de sorte qu’<b>au terme du prêt, chacune détienne 50 % du bien</b>. En conséquence, les remboursements mensuels fixes sont : <b>' + nomA + ' ' + fmt(Math.round(payBen)) + '/mois</b>, <b>' + nomB + ' ' + fmt(Math.round(payMarie)) + '/mois</b>. Ce mécanisme conduit à un <b>total déboursé identique</b> par chacune au terme.</p>'
      : '<p>Les parties remboursent <b>chacune la moitié de la mensualité</b>, soit <b>' + fmt(Math.round(payBen)) + '/mois</b> chacune. La propriété de chacune reflète son apport augmenté de la moitié du capital remboursé ; la quote-part finale résulte donc de l’écart d’apport initial.</p>';

    doc.innerHTML =
      '<div class="c-head">' +
        '<h1>Projet de convention entre acquéreurs en indivision</h1>' +
        '<p class="c-sub">Répartition de la propriété et du financement d’un bien immobilier — Belgique (Wallonie)</p>' +
      '</div>' +
      '<div class="c-disclaimer"><b>Document préparatoire</b> — ce projet, pré-rempli à partir d’une simulation, n’est <b>pas un acte authentique</b>. Il doit être <b>relu, corrigé et validé par le notaire</b>, qui lui donnera sa forme définitive et, le cas échéant, l’annexera à l’acte. Il ne constitue pas un conseil juridique.</div>' +

      '<h2>1. Entre les soussignés</h2>' +
      '<p><b>Partie 1</b> — ' + nomA + ' ' + B(150) + ', né(e) le ' + B(90) + ' à ' + B(110) + ', n° registre national ' + B(130) + ', domicilié(e) ' + LINE() + '.</p>' +
      '<p><b>Partie 2</b> — ' + nomB + ' ' + B(150) + ', né(e) le ' + B(90) + ' à ' + B(110) + ', n° registre national ' + B(130) + ', domicilié(e) ' + LINE() + '.</p>' +
      '<p><b>Statut des parties</b> (cocher / compléter) : ☐ mariées (régime : ' + B(110) + ') · ☐ cohabitantes légales · ☐ cohabitantes de fait.</p>' +

      '<h2>2. Bien concerné</h2>' +
      '<p>Appartement sis ' + LINE() + ', références cadastrales ' + B(150) + ', superficie ' + B(70) + ' m². <b>Prix d’achat : ' + fmt(Math.round(prixAppart)) + '</b>. Date d’acquisition prévue : ' + B(110) + '.</p>' +

      '<h2>3. Frais d’acquisition</h2>' +
      '<table class="c-table c-table--kv">' +
        '<tr><td>Droits d’enregistrement</td><td>' + fmt(Math.round(fraisEnreg)) + '</td></tr>' +
        '<tr><td>Frais de notaire</td><td>' + fmt(Math.round(fraisNotaire)) + '</td></tr>' +
        '<tr><td>Frais bancaires (crédit)</td><td>' + fmt(Math.round(fraisBancaires)) + '</td></tr>' +
        '<tr class="c-total"><td>Total des frais</td><td>' + fmt(Math.round(fraisTot)) + '</td></tr>' +
      '</table>' +
      '<p>Ces frais sont ' + (horsEmprunt ? '<b>payés séparément (hors emprunt), en numéraire</b>' : '<b>inclus dans le financement</b>') + '. Ils ne sont <b>pas récupérables à la revente</b>. Prise en charge : ' + LINE() + '.</p>' +

      '<h2>4. Apports de chacune</h2>' +
      '<table class="c-table c-table--kv">' +
        '<tr><td>Apport de ' + nomA + '</td><td>' + fmt(Math.round(APPORT_A)) + ' (' + pct0(benPct) + ')</td></tr>' +
        '<tr><td>Apport de ' + nomB + '</td><td>' + fmt(Math.round(APPORT_B)) + ' (' + pct0(mariePct) + ')</td></tr>' +
        '<tr class="c-total"><td>Apport total</td><td>' + fmt(Math.round(apport)) + '</td></tr>' +
      '</table>' +
      '<p>Origine des fonds — ' + nomA + ' : ' + LINE() + '. ' + nomB + ' : ' + LINE() + '. <i>(Les parties joignent les preuves bancaires en annexe B afin d’établir le caractère propre de leurs apports.)</i></p>' +

      '<h2>5. Emprunt</h2>' +
      '<p>Montant emprunté : <b>' + fmt(Math.round(loan.loanAmount)) + '</b> · Organisme : ' + B(150) + ' · Taux annuel : <b>' + tauxPct.toFixed(2) + ' %</b> · Durée : <b>' + dureeChoisie + ' ans</b> · Mensualité : <b>' + fmt(Math.round(loan.mensualite)) + '/mois</b> · Coût total des intérêts : <b>' + fmt(Math.round(totalInterest)) + '</b>.</p>' +
      '<p>L’emprunt est contracté <b>solidairement</b> par les deux parties envers l’organisme prêteur. <b>Assurance solde restant dû</b> — ' + nomA + ' : quotité ' + B(50) + ' %, ' + nomB + ' : quotité ' + B(50) + ' % ; bénéficiaire : ' + B(130) + '.</p>' +

      '<h2>6. Répartition du remboursement</h2>' +
      modelHtml +
      '<p>Les remboursements sont effectués depuis le compte joint n° ' + B(150) + ' (ordres permanents) ; les parties conservent la preuve des versements.</p>' +

      '<h2>7. Détermination des quotités de propriété</h2>' +
      '<p>Les parties reconnaissent que <b>seul le capital construit la propriété</b> (les intérêts sont un coût). La quote-part de chacune se calcule selon la formule :</p>' +
      '<p class="c-formula">part = (apport + capital financé) / (apport total + capital total remboursé)</p>' +
      '<table class="c-table c-table--kv">' +
        '<tr><td>Quotité à l’achat (selon les apports)</td><td>' + nomA + ' ' + pct0(benPct) + ' · ' + nomB + ' ' + pct0(mariePct) + '</td></tr>' +
        '<tr><td>Quotité visée au terme du prêt</td><td>' + nomA + ' ' + pct(finShares.shareA) + ' · ' + nomB + ' ' + pct(finShares.shareB) + '</td></tr>' +
      '</table>' +
      '<p><b>Important</b> — l’acte notarié fixe des quotités à un instant donné ; il ne les fait pas évoluer mois par mois. Les parties conviennent d’inscrire à l’acte la quotité ' + B(110) + ' et de régler entre elles, par la présente convention, les compensations correspondant à l’évolution décrite en annexe A. Le notaire arrêtera la formulation définitive.</p>' +

      '<h2>8. Tableau de répartition</h2>' +
      '<p>La synthèse annuelle de la répartition (capital remboursé, capital financé par chacune, quotités, solde) figure en <b>annexe A</b>.</p>' +

      '<h2>9. En cas de revente</h2>' +
      '<p>Le produit net de la vente est réparti selon les quotités convenues. Sont préalablement déduits : le solde restant dû et les frais de vente (agence ' + B(40) + ' %, éventuelle indemnité de remboursement anticipé). La récupération prioritaire des apports est : ☐ prévue · ☐ non prévue. La plus ou moins-value est partagée selon les quotités.</p>' +

      '<h2>10. En cas de séparation</h2>' +
      '<p>Chaque partie dispose d’un <b>droit de rachat prioritaire</b> de la part de l’autre, à une valeur fixée à dire d’expert (' + B(130) + '). La partie sortante sollicite sa <b>désolidarisation</b> du prêt auprès de la banque. Les sommes versées par chacune sont compensées conformément à la présente convention.</p>' +

      '<h2>11. En cas de décès</h2>' +
      '<p>La part du défunt suit sa succession ou son testament. Clause d’accroissement / tontine éventuelle : ' + B(150) + '. L’<b>assurance solde restant dû</b> rembourse le crédit à hauteur des quotités assurées, au bénéfice de ' + B(130) + '.</p>' +

      '<h2>12. Charges et travaux</h2>' +
      '<p>Précompte immobilier, charges de copropriété et entretien courant sont répartis : ☐ 50 / 50 · ☐ selon les quotités. Les gros travaux et améliorations sont financés ' + LINE() + ' et pris en compte dans les quotités par avenant.</p>' +

      '<h2>13. Modification et défaut de paiement</h2>' +
      '<p>Toute modification fait l’objet d’un <b>avenant écrit signé</b>. En cas de défaut de paiement d’une partie : ' + LINE() + '.</p>' +

      '<h2>14. Signatures</h2>' +
      '<p>Fait à ' + B(130) + ', le ' + B(100) + ', en ' + B(40) + ' exemplaires originaux. Projet destiné à être soumis au notaire pour validation.</p>' +
      '<div class="c-sign"><div>' + nomA + '<br><br>' + LINE() + '</div><div>' + nomB + '<br><br>' + LINE() + '</div></div>' +

      '<h2>Annexe A — Répartition annuelle</h2>' +
      '<table class="c-table c-table--data"><thead><tr><th>Année</th><th>Capital remboursé (cumul)</th><th>dont ' + nomA + '</th><th>dont ' + nomB + '</th><th>Part ' + nomA + '</th><th>Part ' + nomB + '</th><th>Solde restant dû</th></tr></thead><tbody>' + annualRows(loan) + '</tbody></table>' +
      '<p class="c-annex-note">Hypothèses : prix ' + fmt(Math.round(prixAppart)) + ', emprunt ' + fmt(Math.round(loan.loanAmount)) + ' au taux de ' + tauxPct.toFixed(2) + ' % sur ' + dureeChoisie + ' ans. Modèle de remboursement : ' + (equalizeShares ? 'équilibré (intérêts 50/50, propriété 50/50 au terme)' : 'moitié-moitié des mensualités') + '. Document généré le ' + today + '.</p>' +

      '<h2>Annexe B — Preuves d’apports</h2>' +
      '<p>À joindre : extraits bancaires établissant l’origine et le versement des apports de chacune.</p>' +
      '<h2>Annexe C — Tableau d’amortissement bancaire</h2>' +
      '<p>À joindre : tableau d’amortissement officiel de l’organisme prêteur.</p>';
  }

  function open() {
    build();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('contract-open');
    overlay.scrollTop = 0;
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('contract-open');
  }

  btnGen.addEventListener('click', open);
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnPrint) btnPrint.addEventListener('click', () => window.print());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();
