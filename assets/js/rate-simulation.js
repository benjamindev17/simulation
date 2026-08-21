/* ==========================================================================
   Onglet « Simulation taux » — apport, quotité, mensualité
   État global partagé (prixAppart, tauxPct, apport, benRatio…) lu par
   ownership.js. renderCalc() est le point d'entrée unique : chaque interaction
   met à jour l'état puis rappelle renderCalc(), qui resynchronise les deux onglets.
   ========================================================================== */

/* --- État ---------------------------------------------------------------- */
// Simulation vierge par défaut (page non chargée depuis une sauvegarde) : les
// montants personnels démarrent à 0/vide, pour que l'outil soit partageable
// sans exposer les données de qui l'a configuré. Seules les charges de
// l'onglet Coût total annuel (assurances, copro…) gardent des valeurs
// indicatives généralistes (cf. cost.js), comme demandé.
let prixAppart = 0;
let travaux = 0; // enveloppe travaux — financée, mais non soumise aux droits d'enregistrement ni au notaire
// Droits d'enregistrement — 3 % : taux wallon de l'habitation propre et unique depuis le
// 1er janvier 2025 (il remplace l'ancien 12,5 % assorti d'un abattement). Un second bien ou
// un achat locatif relèverait du taux plein de 12,5 %. Cette constante est la seule source :
// l'affichage la reprend (#out-taux-enreg), tout comme le récapitulatif.
const TAUX_ENREGISTREMENT = 3;
let fraisNotaire = 0;
let fraisBancaires = 0; // frais de crédit éventuellement imposés par la banque (saisis à la main)
const APPORT_BUDGET = 71000; // enveloppe cash de départ si la case « frais hors emprunt » est (re)cochée manuellement
const FRAIS_STANDARD_HORS_EMPRUNT = 15000; // enreg + notaire retranchés du budget dans ce cas
let apport = 0;
let benRatio = 0.5; // 50/50 par défaut (curseur au milieu) — éditable via les champs Apport 1/2 ou le curseur (pas de 5%)
let tauxPct = 3.70;
let SEUIL_ENDETTEMENT = 33;

/* Indemnité de remboursement anticipé (IRA) — condition du prêt, pas un coût récurrent : affichée
   à titre informatif (recap/comparaison), jamais comptée dans les totaux annuels/mensuels.
   Plafond légal en Belgique : 3 mois d'intérêts. */
let iraMois = 3;
let iraConditions = '';

/* Emprunteur(s) : "duo" (par défaut) ou "solo" — pilote l'affichage des champs
   liés à la 2e personne (apport, salaire) et l'onglet Répartition appartement. */
let mode = 'duo';
let salaireBen = 0;
let salaireMarie = 0;
let salaireSolo = 0;
function salaireCombineCalc() {
  return mode === 'solo' ? salaireSolo : salaireBen + salaireMarie;
}

/* Chèques-repas : avantage extra-légal versé en plus du salaire net. Ils gonflent
   le budget réellement disponible chaque mois, mais les banques ne les retiennent
   PAS comme revenu pour le taux d'endettement (ils ne sont ni garantis dans la
   durée ni librement utilisables). D'où deux notions distinctes :
   - salaireCombineCalc() : ce que la banque regarde (endettement, quotité) — les
     chèques-repas n'y entrent jamais ;
   - le revenu disponible, salaire + chèques, reconstitué par budget.js qui a besoin
     des deux parts séparées (détail affiché, et 13,6 mois pour le salaire contre 12
     pour les chèques). chequesA() lui évite de dupliquer l'aiguillage solo/duo. */
let chequesBen = 0;
let chequesMarie = 0;
let chequesSolo = 0;
function chequesA() { return mode === 'solo' ? chequesSolo : chequesBen; }

/* Banque à l'origine de l'offre simulée (id du registre de banques.js, ou null tant
   qu'aucune n'est choisie). Sert au titre de la simulation enregistrée. */
let banqueId = null;

/* Noms des deux emprunteurs — éditables, utilisés partout où le nom apparaît
   (libellés, tableau de répartition, contrat). Neutres par défaut. */
let nomA = 'Personne 1';
let nomB = 'Personne 2';
function syncNames() {
  document.querySelectorAll('.name-a').forEach(el => { el.textContent = nomA; });
  document.querySelectorAll('.name-b').forEach(el => { el.textContent = nomB; });
}

/* Sélecteur de banque — construit une seule fois depuis le registre (banques.js), puis
   seulement resynchronisé. Recliquer la banque déjà retenue la désélectionne, pour
   pouvoir revenir à « aucune banque précisée ». */
function buildBankPicker() {
  if (!elBankPicker || typeof BANQUES === 'undefined') return;
  elBankPicker.innerHTML = BANQUES.map(b =>
    '<button type="button" class="bank-option" data-banque="' + b.id + '" aria-pressed="false">' +
      banqueBadge(b.id) + '<span class="bank-option__nom">' + b.nom + '</span>' +
    '</button>'
  ).join('');
  elBankPicker.querySelectorAll('.bank-option').forEach(btn => {
    btn.addEventListener('click', () => {
      banqueId = (banqueId === btn.dataset.banque) ? null : btn.dataset.banque;
      renderCalc();
    });
  });
}

function syncBankPicker() {
  if (!elBankPicker) return;
  elBankPicker.querySelectorAll('.bank-option').forEach(btn => {
    const actif = btn.dataset.banque === banqueId;
    btn.classList.toggle('active', actif);
    btn.setAttribute('aria-pressed', actif ? 'true' : 'false');
  });
}

/* --- Références DOM ------------------------------------------------------- */
const elModeToggle = document.querySelectorAll('.mode-toggle button');
const elSalaireBen = document.getElementById('in-salaire-ben');
const elSalaireMarie = document.getElementById('in-salaire-marie');
const elSalaireSolo = document.getElementById('in-salaire-solo');
const elBankPicker = document.getElementById('bank-picker');
const elChequesBen = document.getElementById('in-cheques-ben');
const elChequesMarie = document.getElementById('in-cheques-marie');
const elChequesSolo = document.getElementById('in-cheques-solo');
const elApportSplitDuo = document.getElementById('apport-split-duo');
const elTabBtnAppart = document.getElementById('tabBtnAppart');
const elCoutPpCard = document.getElementById('cout-pp-card');
// Carte "Emprunteur(s)" unifiée (nom + salaire de chaque personne dans le même bloc) :
// en solo, on masque la colonne de la 2e personne et on bascule le sous-bloc salaire.
const elFieldPeopleLabel = document.getElementById('field-people-label');
const elColEmprunteur2 = document.getElementById('col-emprunteur-2');
const elSalaireBlockDuoA = document.getElementById('salaire-block-duo-a');
const elSalaireBlockSolo = document.getElementById('salaire-block-solo');
const elNomA = document.getElementById('in-nom-a');
const elNomB = document.getElementById('in-nom-b');
const elSeuilEndettement = document.getElementById('in-seuil-endettement');
const elCol15 = document.getElementById('col-duree-15');
const elCol20 = document.getElementById('col-duree-20');
const elCol25 = document.getElementById('col-duree-25');
const elOutMensualite15 = document.getElementById('out-mensualite-15');
const elOutMensualite20 = document.getElementById('out-mensualite-20');
const elOutMensualite25 = document.getElementById('out-mensualite-25');
const elOutEndettement15 = document.getElementById('out-endettement-15');
const elOutEndettement20 = document.getElementById('out-endettement-20');
const elOutEndettement25 = document.getElementById('out-endettement-25');
const elOutInteret15 = document.getElementById('out-interet-15');
const elOutInteret20 = document.getElementById('out-interet-20');
const elOutInteret25 = document.getElementById('out-interet-25');
const elPrix = document.getElementById('in-prix');
const elFraisEnreg = document.getElementById('out-frais-enreg');
// Le taux affiché dans le libellé est écrit une fois depuis la constante, pour qu'il ne
// puisse pas rester figé sur une ancienne valeur si le taux d'enregistrement change.
const elTauxEnreg = document.getElementById('out-taux-enreg');
if (elTauxEnreg) elTauxEnreg.textContent = TAUX_ENREGISTREMENT;
const elFraisNotaire = document.getElementById('in-frais-notaire');
const elFraisBancaires = document.getElementById('in-frais-bancaires');
const elFraisTotal = document.getElementById('out-frais-total');
const elOutCout = document.getElementById('out-cout');
const elTravaux = document.getElementById('in-travaux');
const elChkFraisHorsEmprunt = document.getElementById('chk-frais-hors-emprunt');
const elNoteFraisHorsEmprunt = document.getElementById('note-frais-hors-emprunt');
const elLabelCoutTotal = document.getElementById('label-cout-total');
const elApport = document.getElementById('in-apport');
const elApportBen = document.getElementById('in-apport-ben');
const elApportMarie = document.getElementById('in-apport-marie');
const elApportRatio = document.getElementById('in-apport-ratio');
const elOutRatioBen = document.getElementById('out-ratio-ben');
const elOutRatioMarie = document.getElementById('out-ratio-marie');
const elQuotite = document.getElementById('in-quotite');
const elMontant = document.getElementById('in-montant');
const elTaux = document.getElementById('in-taux');
const elSliderTaux = document.getElementById('slider-taux');
const elIraMois = document.getElementById('in-ira-mois');
const elIraConditions = document.getElementById('in-ira-conditions');

// Colonnes du tableau d'étalement retirées/réinsérées selon le mode solo/duo (cf. applyMode).
const elAmortColgroup = document.querySelector('#amort-table colgroup');
const elAmortTheadRow = document.querySelector('#amort-table thead tr');
const elColCapMarie = document.getElementById('col-5');
const elColCapBen = document.getElementById('col-6');
const elColSolde = document.getElementById('col-7');
const elColPartBen = document.getElementById('col-8');
const elColPartMarie = document.getElementById('col-9');
const elThCapMarie = document.getElementById('th-col-5');
const elThCapBen = document.getElementById('th-col-6');
const elThSolde = document.getElementById('th-col-7');
const elThPartBen = document.getElementById('th-col-8');
const elThPartMarie = document.getElementById('th-col-9');

/* --- Calculs dérivés ----------------------------------------------------- */
function fraisEnregCalc() {
  return prixAppart * (TAUX_ENREGISTREMENT / 100);
}
// Somme de tous les frais d'acquisition : enregistrement + notaire + frais bancaires éventuels.
function fraisTotalCalc() {
  return fraisEnregCalc() + fraisNotaire + fraisBancaires;
}
function coutTotalCalc() {
  // Les travaux sont financés dans les deux cas, sans droits d'enregistrement ni notaire (calculés sur le prix seul).
  if (elChkFraisHorsEmprunt && elChkFraisHorsEmprunt.checked) {
    return prixAppart + travaux; // frais payés séparément, cash : prix + travaux à financer
  }
  return prixAppart + travaux + fraisTotalCalc();
}
// Apport quand les frais sont payés à part : enveloppe de 100K moins les frais standards déjà retranchés,
// moins les frais bancaires ajoutés à la main (eux aussi prélevés cash sur cette enveloppe).
function apportHorsEmprunt() {
  return Math.max(0, APPORT_BUDGET - FRAIS_STANDARD_HORS_EMPRUNT - fraisBancaires);
}
function montantEmprunte() {
  return Math.max(0, coutTotalCalc() - apport);
}

/* Quotité (loan-to-value) telle que la calculent les banques belges : le montant emprunté
   rapporté à la VALEUR DU BIEN, c'est-à-dire au prix d'achat seul.
   Ni les frais d'acquisition ni l'aménagement n'entrent au dénominateur : la banque prend
   une hypothèque sur le bien, et la quotité mesure la part de cette garantie qui est
   engagée. Les droits d'enregistrement et les frais de notaire, eux, sont perdus dès qu'ils
   sont payés — si la banque doit revendre, elle ne les récupère pas. Un aménagement financé
   augmente donc bien la quotité, puisqu'il gonfle le crédit sans gonfler la garantie.
   C'est cette quotité qui détermine le palier de taux (≤ 80 %, ≤ 90 %, > 90 %). */
function quotiteCalc() {
  return prixAppart > 0 ? (montantEmprunte() / prixAppart) * 100 : 0;
}

// Mensualité pour une durée donnée (en années), à montant et taux fixés.
function mensualitePour(years) {
  const L = montantEmprunte();
  const r = tauxPct / 100 / 12;
  const n = years * 12;
  if (L <= 0) return 0;
  return r === 0 ? L / n : L * r / (1 - Math.pow(1 + r, -n));
}

// Teinte de fond d'une colonne de durée selon le taux d'endettement. Volontairement
// très pâle : c'est un signal de lecture, pas un aplat de couleur — il ne doit pas
// concurrencer le violet/apricot de l'interface ni écraser le contour de sélection.
function couleurEndettement(pct) {
  const EPSILON = 0.05; // tolérance pour les imprécisions flottantes : pile sur le seuil reste vert
  if (pct > SEUIL_ENDETTEMENT + EPSILON) {
    // au-dessus du seuil : lavis rosé, d'autant plus marqué qu'on s'en éloigne (+20 points)
    const t = Math.min((pct - SEUIL_ENDETTEMENT) / 20, 1);
    return 'hsl(4, 70%, ' + (97 - t * 8) + '%)';
  }
  // sous le seuil : lavis vert très pâle, quasi blanc à 0%
  const t = Math.min(Math.max(pct, 0) / SEUIL_ENDETTEMENT, 1);
  return 'hsl(145, 35%, ' + (99 - t * 7) + '%)';
}

// Intérêts totaux payés sur toute la durée = somme des mensualités − montant emprunté.
function interetTotalPour(years) {
  const L = montantEmprunte();
  if (L <= 0) return 0;
  return mensualitePour(years) * years * 12 - L;
}

function renderColonne(years, elCol, elMensualite, elEndettement, elInteret) {
  const m = mensualitePour(years);
  const salaire = salaireCombineCalc();
  // Salaire pas encore renseigné : pas de pourcentage à afficher (division par 0 → NaN/Infinity sinon).
  const pct = salaire > 0 ? (m / salaire) * 100 : null;
  elMensualite.textContent = fmt(Math.round(m)) + '/mois';
  elEndettement.textContent = pct === null ? 'Revenu non renseigné' : pct.toFixed(1) + '% des revenus';
  elInteret.textContent = fmt(Math.round(interetTotalPour(years)));
  elCol.style.backgroundColor = pct === null ? '' : couleurEndettement(pct);
}

/* --- Rendu --------------------------------------------------------------- */
// Rafraîchit TOUS les champs à partir de l'état — appelé après chaque changement, quelle que soit sa source.
function renderCalc() {
  const coutTotal = coutTotalCalc();
  const fraisEnreg = fraisEnregCalc();

  const fraisTotal = fraisTotalCalc();

  elPrix.value = Math.round(prixAppart);
  if (elTravaux) elTravaux.value = Math.round(travaux);
  elFraisEnreg.textContent = fmt(Math.round(fraisEnreg));
  elFraisNotaire.value = fraisNotaire.toFixed(2);
  elFraisBancaires.value = Math.round(fraisBancaires);
  elFraisTotal.textContent = fmt(Math.round(fraisTotal));
  elOutCout.textContent = fmt(Math.round(coutTotal));

  const suffixeTravaux = travaux > 0 ? ' + aménagement' : '';
  if (elChkFraisHorsEmprunt && elChkFraisHorsEmprunt.checked) {
    elLabelCoutTotal.textContent = 'Coût à financer (prix' + suffixeTravaux + ', frais exclus)';
    elNoteFraisHorsEmprunt.style.display = 'block';
    elNoteFraisHorsEmprunt.innerHTML = 'Frais (' + fmt(Math.round(fraisTotal)) + ') payés séparément, cash, en plus de l’apport — non financés par l’emprunt. L’aménagement, lui, est financé mais non soumis aux droits d’enregistrement ni au notaire. Coût réel total pour vous deux : ' + fmt(Math.round(prixAppart + travaux + fraisTotal)) + ' (' + fmt(Math.round(coutTotal)) + ' financé + ' + fmt(Math.round(fraisTotal)) + ' de frais à part).';
  } else {
    elLabelCoutTotal.textContent = 'Coût total du projet (prix' + suffixeTravaux + ' + frais, calculé)';
    elNoteFraisHorsEmprunt.style.display = 'none';
  }

  if (apport > coutTotal) apport = coutTotal;
  elApport.value = Math.round(apport);
  elApportBen.value = Math.round(apport * benRatio);
  elApportMarie.value = Math.round(apport * (1 - benRatio));

  // Curseur de répartition : position = part de Marie (0 = 100% Ben à gauche, 100 = 100% Marie à droite).
  const mariePct = Math.round((1 - benRatio) * 100);
  elApportRatio.value = mariePct;
  elOutRatioBen.textContent = (100 - mariePct) + '%';
  elOutRatioMarie.textContent = mariePct + '%';

  const L = montantEmprunte();
  elQuotite.value = quotiteCalc().toFixed(2);
  elMontant.value = Math.round(L);

  elTaux.value = tauxPct.toFixed(2);
  elSliderTaux.value = tauxPct;

  elSalaireBen.value = Math.round(salaireBen);
  elSalaireMarie.value = Math.round(salaireMarie);
  elSalaireSolo.value = Math.round(salaireSolo);

  elChequesBen.value = Math.round(chequesBen);
  elChequesMarie.value = Math.round(chequesMarie);
  elChequesSolo.value = Math.round(chequesSolo);

  elNomA.value = nomA;
  elNomB.value = nomB;
  syncNames();
  syncBankPicker();

  elIraMois.value = iraMois;
  elIraConditions.value = iraConditions;

  elSeuilEndettement.value = SEUIL_ENDETTEMENT;
  renderColonne(15, elCol15, elOutMensualite15, elOutEndettement15, elOutInteret15);
  renderColonne(20, elCol20, elOutMensualite20, elOutEndettement20, elOutInteret20);
  renderColonne(25, elCol25, elOutMensualite25, elOutEndettement25, elOutInteret25);

  // Met en évidence la durée cochée (colonnes de comparaison + sélecteur flottant).
  [15, 20, 25].forEach(y => {
    document.getElementById('col-duree-' + y).classList.toggle('selected', y === dureeChoisie);
  });
  document.querySelectorAll('#duree-float button').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.years, 10) === dureeChoisie);
  });

  refreshTab2(); // garde l'onglet "Répartition appartement" synchronisé avec le montant emprunté / taux courants
  if (typeof refreshEtf === 'function') refreshEtf(); // resynchronise la projection ETF sur la durée cochée
  if (typeof refreshCout === 'function') refreshCout(); // resynchronise le coût annuel (mensualité)
  if (typeof refreshBudget === 'function') refreshBudget(); // resynchronise revenu/logement/totaux (Coût de la vie)
}

// Bascule Solo/Duo : montre/cache les champs liés à la 2e personne (apport,
// salaire, nom). L'onglet Répartition reste disponible dans les deux modes —
// le tableau d'étalement (mensualité, intérêts, capital, solde) est utile
// même seul(e) ; seules les colonnes/cartes de répartition entre 2 personnes
// s'y masquent.
function applyMode(newMode) {
  mode = newMode;
  elModeToggle.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

  const isSolo = mode === 'solo';
  elColEmprunteur2.hidden = isSolo; // masque nom + salaire de la 2e personne en solo (colonne entière)
  elSalaireBlockDuoA.hidden = isSolo;
  elSalaireBlockSolo.hidden = !isSolo;
  elApportSplitDuo.hidden = isSolo;
  if (elCoutPpCard) elCoutPpCard.hidden = isSolo;
  if (elFieldPeopleLabel) {
    elFieldPeopleLabel.textContent = isSolo
      ? 'Emprunteur — nom, salaire net et chèques-repas'
      : 'Emprunteur(s) — nom, salaire net et chèques-repas';
  }

  // Onglet Répartition / tableau d'étalement : garde la mécanique du prêt (toujours utile en solo),
  // masque uniquement ce qui suppose 2 personnes.
  elTabBtnAppart.textContent = isSolo ? 'Tableau d’étalement' : 'Répartition appartement';
  const elDropdownItemAppart = document.getElementById('tabs-dropdown-item-appart');
  if (elDropdownItemAppart) elDropdownItemAppart.textContent = elTabBtnAppart.textContent;
  if (typeof dropdownLabels !== 'undefined') dropdownLabels.appart = elTabBtnAppart.textContent;
  if (typeof syncDropdown === 'function') syncDropdown();
  const elRepartitionH1 = document.getElementById('repartition-h1');
  if (elRepartitionH1) elRepartitionH1.textContent = isSolo ? 'Tableau d’étalement du prêt' : 'Répartition de l’appartenance de l’appartement';
  const idsToHideInSolo = ['repartition-assumptions', 'stat-total-b', 'repartition-formula-note', 'card-total-b', 'field-remboursement-personne', 'repartition-part-box'];
  idsToHideInSolo.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = isSolo;
  });
  // Colonnes Capital Marie/Ben + Part Ben/Marie : retirées du DOM (pas juste masquées en CSS) en
  // solo — display:none/visibility:collapse sur des <col> non contiguës perturbait le calcul de
  // table-layout:fixed (vide résiduel, voire une colonne voisine qui disparaissait). Les <td>
  // correspondants sont eux gérés directement dans ownership.js (renderAmortizationFull), qui
  // reconstruit chaque ligne du tableau de toute façon.
  if (isSolo) {
    [elColCapMarie, elColCapBen, elColPartBen, elColPartMarie].forEach(el => el.remove());
    [elThCapMarie, elThCapBen, elThPartBen, elThPartMarie].forEach(el => el.remove());
  } else {
    elColSolde.before(elColCapMarie, elColCapBen);
    elAmortColgroup.append(elColPartBen, elColPartMarie);
    elThSolde.before(elThCapMarie, elThCapBen);
    elAmortTheadRow.append(elThPartBen, elThPartMarie);
  }

  renderCalc();
}

elModeToggle.forEach(btn => {
  btn.addEventListener('click', () => applyMode(btn.dataset.mode));
});

elSalaireBen.addEventListener('change', () => { salaireBen = Math.max(0, parseFloat(elSalaireBen.value) || 0); renderCalc(); });
elSalaireMarie.addEventListener('change', () => { salaireMarie = Math.max(0, parseFloat(elSalaireMarie.value) || 0); renderCalc(); });
elSalaireSolo.addEventListener('change', () => { salaireSolo = Math.max(0, parseFloat(elSalaireSolo.value) || 0); renderCalc(); });
elChequesBen.addEventListener('change', () => { chequesBen = Math.max(0, parseFloat(elChequesBen.value) || 0); renderCalc(); });
elChequesMarie.addEventListener('change', () => { chequesMarie = Math.max(0, parseFloat(elChequesMarie.value) || 0); renderCalc(); });
elChequesSolo.addEventListener('change', () => { chequesSolo = Math.max(0, parseFloat(elChequesSolo.value) || 0); renderCalc(); });

elNomA.addEventListener('change', () => { nomA = elNomA.value.trim() || 'Personne 1'; renderCalc(); });
elNomB.addEventListener('change', () => { nomB = elNomB.value.trim() || 'Personne 2'; renderCalc(); });

elIraMois.addEventListener('change', () => { iraMois = Math.max(0, parseFloat(elIraMois.value) || 0); renderCalc(); });
elIraConditions.addEventListener('change', () => { iraConditions = elIraConditions.value.trim(); renderCalc(); });

/* --- Interactions -------------------------------------------------------- */
// Sélection de la durée (15/20/25), depuis les radios OU le sélecteur flottant.
// Met à jour l'état, coche le radio correspondant, et recalcule tout.
function selectDuree(years) {
  dureeChoisie = years;
  const radio = document.querySelector('input[name="duree-choisie"][value="' + years + '"]');
  if (radio) radio.checked = true;
  renderCalc();
}
document.querySelectorAll('input[name="duree-choisie"]').forEach(radio => {
  radio.addEventListener('change', () => { if (radio.checked) selectDuree(parseInt(radio.value, 10)); });
});
document.querySelectorAll('#duree-float button').forEach(btn => {
  btn.addEventListener('click', () => selectDuree(parseInt(btn.dataset.years, 10)));
});

elChkFraisHorsEmprunt.addEventListener('change', () => {
  apport = elChkFraisHorsEmprunt.checked ? apportHorsEmprunt() : APPORT_BUDGET;
  renderCalc();
});

elPrix.addEventListener('change', () => {
  prixAppart = Math.max(0, parseFloat(elPrix.value) || 0);
  renderCalc();
});

elTravaux.addEventListener('change', () => {
  travaux = Math.max(0, parseFloat(elTravaux.value) || 0);
  renderCalc();
});

elFraisNotaire.addEventListener('change', () => {
  fraisNotaire = Math.max(0, parseFloat(elFraisNotaire.value) || 0);
  renderCalc();
});

elFraisBancaires.addEventListener('change', () => {
  fraisBancaires = Math.max(0, parseFloat(elFraisBancaires.value) || 0);
  // Frais payés à part (case cochée) → prélevés cash sur l'enveloppe de 100K, donc déduits de l'apport
  // (l'apport baisse, l'emprunt augmente d'autant). Sinon ils sont financés via le coût total.
  if (elChkFraisHorsEmprunt.checked) {
    apport = apportHorsEmprunt();
  }
  renderCalc();
});

elApport.addEventListener('change', () => {
  const value = Math.max(0, parseFloat(elApport.value) || 0);
  apport = Math.min(value, coutTotalCalc());
  renderCalc();
});

// Modifier l'un des deux montants ajuste benRatio, en gardant l'apport total inchangé.
elApportBen.addEventListener('change', () => {
  const val = Math.min(Math.max(0, parseFloat(elApportBen.value) || 0), apport);
  benRatio = apport > 0 ? val / apport : 0.5;
  renderCalc();
});

elApportMarie.addEventListener('change', () => {
  const val = Math.min(Math.max(0, parseFloat(elApportMarie.value) || 0), apport);
  benRatio = apport > 0 ? 1 - (val / apport) : 0.5;
  renderCalc();
});

// Curseur : la valeur est la part de Marie (0→100). benRatio = complément.
elApportRatio.addEventListener('input', () => {
  const mariePct = Math.min(Math.max(0, parseFloat(elApportRatio.value) || 0), 100);
  benRatio = 1 - mariePct / 100;
  renderCalc();
});

elSeuilEndettement.addEventListener('change', () => {
  SEUIL_ENDETTEMENT = Math.min(Math.max(1, parseFloat(elSeuilEndettement.value) || 33), 100);

  // Recalcule l'apport pour que la mensualité sur 20 ans corresponde exactement à ce nouveau seuil.
  const coutTotal = coutTotalCalc();
  const r = tauxPct / 100 / 12;
  const n = 20 * 12;
  const mensualiteCible = salaireCombineCalc() * (SEUIL_ENDETTEMENT / 100);
  const annuityFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
  const loanNecessaire = mensualiteCible * annuityFactor;
  apport = Math.min(Math.max(0, coutTotal - loanNecessaire), coutTotal);

  renderCalc();
});

// Sens inverse : la quotité visée fixe le montant emprunté (q % du PRIX), et l'apport est
// ce qu'il reste à couvrir du coût total — frais et aménagement compris. Au-delà de 100 %
// on emprunte plus que la valeur du bien : c'est possible dans le modèle (aménagement
// financé) même si les banques ne l'accordent qu'exceptionnellement, d'où la borne à 125.
elQuotite.addEventListener('change', () => {
  const q = Math.min(Math.max(0, parseFloat(elQuotite.value) || 0), 125);
  const coutTotal = coutTotalCalc();
  apport = Math.min(Math.max(0, coutTotal - prixAppart * (q / 100)), coutTotal);
  renderCalc();
});

elMontant.addEventListener('change', () => {
  const coutTotal = coutTotalCalc();
  const m = Math.min(Math.max(0, parseFloat(elMontant.value) || 0), coutTotal);
  apport = coutTotal - m;
  renderCalc();
});

// Bornes du taux — doivent rester alignées sur min/max du curseur #slider-taux (index.html).
const TAUX_MIN = 3;
const TAUX_MAX = 4;
function applyTaux(val) {
  tauxPct = Math.min(Math.max(TAUX_MIN, val), TAUX_MAX);
  renderCalc();
}
elTaux.addEventListener('change', () => applyTaux(parseFloat(elTaux.value) || tauxPct));
elSliderTaux.addEventListener('input', () => applyTaux(parseFloat(elSliderTaux.value) || tauxPct));

/* --- Amorçage ------------------------------------------------------------ */
buildBankPicker(); // avant renderCalc(), qui synchronise l'état sélectionné
applyMode(mode); // synchronise l'affichage Solo/Duo (et appelle renderCalc())
