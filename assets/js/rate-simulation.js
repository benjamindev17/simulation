/* ==========================================================================
   Onglet « Simulation taux » — apport, quotité, mensualité
   État global partagé (prixAppart, tauxPct, apport, benRatio…) lu par
   ownership.js. renderCalc() est le point d'entrée unique : chaque interaction
   met à jour l'état puis rappelle renderCalc(), qui resynchronise les deux onglets.
   ========================================================================== */

/* --- État ---------------------------------------------------------------- */
let prixAppart = 340000;
const TAUX_ENREGISTREMENT = 3; // % fixe
let fraisNotaire = 4868.95;
let fraisBancaires = 0; // frais de crédit éventuellement imposés par la banque (saisis à la main)
const APPORT_BUDGET = 71000; // enveloppe cash de départ : apport de 71 000 € si frais financés, 56 000 € si frais payés à part
const FRAIS_STANDARD_HORS_EMPRUNT = 15000; // enreg + notaire retranchés du budget → apport de base 56 000 quand la case est cochée
let apport = 56000; // apport total par défaut (28 000 € Ben + 28 000 € Marie, hors frais)
let benRatio = 0.5; // 50/50 par défaut (curseur au milieu) — éditable via les champs Apport Ben/Marie ou le curseur (pas de 5%)
let tauxPct = 3.70;
const SALAIRE_COMBINE = 4740;
let SEUIL_ENDETTEMENT = 33;

/* --- Références DOM ------------------------------------------------------- */
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
const elFraisNotaire = document.getElementById('in-frais-notaire');
const elFraisBancaires = document.getElementById('in-frais-bancaires');
const elFraisTotal = document.getElementById('out-frais-total');
const elOutCout = document.getElementById('out-cout');
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

/* --- Calculs dérivés ----------------------------------------------------- */
function fraisEnregCalc() {
  return prixAppart * (TAUX_ENREGISTREMENT / 100);
}
// Somme de tous les frais d'acquisition : enregistrement + notaire + frais bancaires éventuels.
function fraisTotalCalc() {
  return fraisEnregCalc() + fraisNotaire + fraisBancaires;
}
function coutTotalCalc() {
  if (elChkFraisHorsEmprunt && elChkFraisHorsEmprunt.checked) {
    return prixAppart; // frais payés séparément, cash, hors financement : seul le prix du bien est à financer
  }
  return prixAppart + fraisTotalCalc();
}
// Apport quand les frais sont payés à part : enveloppe de 100K moins les frais standards déjà retranchés,
// moins les frais bancaires ajoutés à la main (eux aussi prélevés cash sur cette enveloppe).
function apportHorsEmprunt() {
  return Math.max(0, APPORT_BUDGET - FRAIS_STANDARD_HORS_EMPRUNT - fraisBancaires);
}
function montantEmprunte() {
  return Math.max(0, coutTotalCalc() - apport);
}

// Mensualité pour une durée donnée (en années), à montant et taux fixés.
function mensualitePour(years) {
  const L = montantEmprunte();
  const r = tauxPct / 100 / 12;
  const n = years * 12;
  if (L <= 0) return 0;
  return r === 0 ? L / n : L * r / (1 - Math.pow(1 + r, -n));
}

function couleurEndettement(pct) {
  const EPSILON = 0.05; // tolérance pour les imprécisions flottantes : pile sur le seuil reste vert
  if (pct > SEUIL_ENDETTEMENT + EPSILON) {
    // zone rouge : de rouge clair juste au-dessus du seuil à rouge plus soutenu (+20 points au-delà)
    const t = Math.min((pct - SEUIL_ENDETTEMENT) / 20, 1);
    const lightness = 85 - t * 30;
    return 'hsl(0, 70%, ' + lightness + '%)';
  }
  // zone verte : quasi blanc à 0%, vert plus soutenu en approchant le seuil (jusqu'au seuil inclus)
  const t = Math.min(Math.max(pct, 0) / SEUIL_ENDETTEMENT, 1);
  const lightness = 96 - t * 26;
  return 'hsl(140, 55%, ' + lightness + '%)';
}

// Intérêts totaux payés sur toute la durée = somme des mensualités − montant emprunté.
function interetTotalPour(years) {
  const L = montantEmprunte();
  if (L <= 0) return 0;
  return mensualitePour(years) * years * 12 - L;
}

function renderColonne(years, elCol, elMensualite, elEndettement, elInteret) {
  const m = mensualitePour(years);
  const pct = (m / SALAIRE_COMBINE) * 100;
  elMensualite.textContent = fmt(Math.round(m)) + '/mois';
  elEndettement.textContent = pct.toFixed(1) + '% du salaire';
  elInteret.textContent = fmt(Math.round(interetTotalPour(years)));
  elCol.style.backgroundColor = couleurEndettement(pct);
}

/* --- Rendu --------------------------------------------------------------- */
// Rafraîchit TOUS les champs à partir de l'état — appelé après chaque changement, quelle que soit sa source.
function renderCalc() {
  const coutTotal = coutTotalCalc();
  const fraisEnreg = fraisEnregCalc();

  const fraisTotal = fraisTotalCalc();

  elPrix.value = Math.round(prixAppart);
  elFraisEnreg.textContent = fmt(Math.round(fraisEnreg));
  elFraisNotaire.value = fraisNotaire.toFixed(2);
  elFraisBancaires.value = Math.round(fraisBancaires);
  elFraisTotal.textContent = fmt(Math.round(fraisTotal));
  elOutCout.textContent = fmt(Math.round(coutTotal));

  if (elChkFraisHorsEmprunt && elChkFraisHorsEmprunt.checked) {
    elLabelCoutTotal.textContent = 'Coût à financer (prix seul, frais exclus)';
    elNoteFraisHorsEmprunt.style.display = 'block';
    elNoteFraisHorsEmprunt.innerHTML = 'Frais (' + fmt(Math.round(fraisTotal)) + ') payés séparément, cash, en plus de l’apport — non financés par l’emprunt. Coût réel total pour vous deux : ' + fmt(Math.round(prixAppart + fraisTotal)) + ' (' + fmt(Math.round(coutTotal)) + ' financé + ' + fmt(Math.round(fraisTotal)) + ' de frais à part).';
  } else {
    elLabelCoutTotal.textContent = 'Coût total du projet (prix + frais, calculé)';
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
  const q = coutTotal > 0 ? (L / coutTotal) * 100 : 0;
  elQuotite.value = q.toFixed(2);
  elMontant.value = Math.round(L);

  elTaux.value = tauxPct.toFixed(2);
  elSliderTaux.value = tauxPct;

  elSeuilEndettement.value = SEUIL_ENDETTEMENT;
  renderColonne(15, elCol15, elOutMensualite15, elOutEndettement15, elOutInteret15);
  renderColonne(20, elCol20, elOutMensualite20, elOutEndettement20, elOutInteret20);
  renderColonne(25, elCol25, elOutMensualite25, elOutEndettement25, elOutInteret25);

  // Met en évidence la durée cochée (celle qui pilote l'onglet Répartition).
  [15, 20, 25].forEach(y => {
    document.getElementById('col-duree-' + y).classList.toggle('selected', y === dureeChoisie);
  });

  refreshTab2(); // garde l'onglet "Répartition appartement" synchronisé avec le montant emprunté / taux courants
  if (typeof refreshEtf === 'function') refreshEtf(); // resynchronise la projection ETF sur la durée cochée
  if (typeof refreshCout === 'function') refreshCout(); // resynchronise le coût annuel (mensualité)
}

/* --- Interactions -------------------------------------------------------- */
// Choix de la durée (radios 15/20/25) : pilote l'échéancier de l'onglet Répartition.
document.querySelectorAll('input[name="duree-choisie"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    dureeChoisie = parseInt(radio.value, 10);
    renderCalc();
  });
});

elChkFraisHorsEmprunt.addEventListener('change', () => {
  apport = elChkFraisHorsEmprunt.checked ? apportHorsEmprunt() : APPORT_BUDGET;
  renderCalc();
});

elPrix.addEventListener('change', () => {
  prixAppart = Math.max(0, parseFloat(elPrix.value) || 0);
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
  const mensualiteCible = SALAIRE_COMBINE * (SEUIL_ENDETTEMENT / 100);
  const annuityFactor = r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r;
  const loanNecessaire = mensualiteCible * annuityFactor;
  apport = Math.min(Math.max(0, coutTotal - loanNecessaire), coutTotal);

  renderCalc();
});

elQuotite.addEventListener('change', () => {
  const q = Math.min(Math.max(0, parseFloat(elQuotite.value) || 0), 100);
  apport = coutTotalCalc() * (1 - q / 100);
  renderCalc();
});

elMontant.addEventListener('change', () => {
  const coutTotal = coutTotalCalc();
  const m = Math.min(Math.max(0, parseFloat(elMontant.value) || 0), coutTotal);
  apport = coutTotal - m;
  renderCalc();
});

function applyTaux(val) {
  tauxPct = Math.min(Math.max(3.2, val), 3.7);
  renderCalc();
}
elTaux.addEventListener('change', () => applyTaux(parseFloat(elTaux.value) || 3.7));
elSliderTaux.addEventListener('input', () => applyTaux(parseFloat(elSliderTaux.value) || 3.7));

/* --- Amorçage ------------------------------------------------------------ */
renderCalc();
