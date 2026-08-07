/* ==========================================================================
   Onglet « Répartition appartement » — logique de propriété
   Le ratio Ben/Marie est piloté par la variable benRatio, définie et éditable
   dans l'onglet Simulation taux (rate-simulation.js).
   Ce fichier lit en temps réel montantEmprunte(), tauxPct et prixAppart, tous
   déclarés dans rate-simulation.js et partagés dans la portée globale.
   ========================================================================== */

let APPORT_A_RAW = 70000;   // recalculé en temps réel dans refreshTab2 = apport total × 70%
let APPORT_B_RAW = 30000;   // recalculé en temps réel dans refreshTab2 = apport total × 30%
let APPORT_A = APPORT_A_RAW;  // apport "effectif" utilisé pour les parts — ajusté si frais 50/50 coché
let APPORT_B = APPORT_B_RAW;
// (mensualité/2 par personne, calculée en temps réel — plus de valeur hardcodée ici)
const DUREE_ANS_TAB2 = 20; // référence pour le tableau d'étalement complet
const APPART_GROWTH = 3; // %/an — utilisé pour détecter le mois de plus-value dans le tableau

let lastLoanData = null; // dernier échéancier calculé, utilisé par le clic sur une ligne
let selectedMonth = 1;   // mois sélectionné par défaut à l'ouverture

// Répartition du remboursement entre Ben et Marie.
// Par défaut 50/50 (chacun paie la moitié de la mensualité). Si equalizeShares est
// activé, on calcule les fractions pour qu'au terme du prêt chacun possède 50 %.
let equalizeShares = false;
let splitBen = 0.5;   // fraction de la mensualité (et donc du capital) financée par Ben
let splitMarie = 0.5; // fraction financée par Marie

// Fractions de remboursement pour atteindre, en fin de prêt, une propriété 50/50.
// Équité finale de Ben = APPORT_A + splitBen × emprunt ; on veut = (apport total + emprunt) / 2.
function computeSplit(loanAmount) {
  if (!equalizeShares || loanAmount <= 0) return { splitBen: 0.5, splitMarie: 0.5 };
  const cibleEquite = (APPORT_A + APPORT_B + loanAmount) / 2;
  let fBen = (cibleEquite - APPORT_A) / loanAmount;
  fBen = Math.min(Math.max(fBen, 0), 1); // borne : impossible de descendre sous 0 ou au-dessus de 100 %
  return { splitBen: fBen, splitMarie: 1 - fBen };
}

// Construit l'échéancier complet à partir du montant à emprunter LIVE (case "Montant à emprunter" de l'onglet Simulation taux) et du taux LIVE.
function buildLoanSchedule() {
  const loanAmount = montantEmprunte(); // valeur en temps réel depuis l'onglet 3
  const rMonthly = tauxPct / 100 / 12;  // taux en temps réel depuis l'onglet 3
  const nTotal = DUREE_ANS_TAB2 * 12;
  const annuityFactor = rMonthly === 0 ? nTotal : (1 - Math.pow(1 + rMonthly, -nTotal)) / rMonthly;
  const mensualite = loanAmount > 0 ? loanAmount / annuityFactor : 0;

  let balance = loanAmount;
  let cumPrincipal = 0;
  let cumInterest = 0;
  const schedule = [{ month: 0, interest: 0, principal: 0, cumPrincipal: 0, cumInterest: 0, balance: loanAmount }];
  let breakEvenMonth = null;
  for (let m = 1; m <= nTotal; m++) {
    const interest = balance * rMonthly;
    let principal = mensualite - interest;
    if (principal > balance) principal = balance;
    balance -= principal;
    cumPrincipal += principal;
    cumInterest += interest;
    schedule.push({ month: m, interest, principal, cumPrincipal, cumInterest, balance });

    // Mois de plus-value nette : valeur de marché estimée (prix initial + appréciation) moins solde restant dû, comparée à tout l'argent réellement sorti de la poche des deux (apport + mensualités déjà payées, capital et intérêts inclus).
    if (breakEvenMonth === null) {
      const marketValue = prixAppart * Math.pow(1 + APPART_GROWTH / 100, m / 12);
      const netProceeds = marketValue - balance;
      const totalPaidSoFar = APPORT_A + APPORT_B + mensualite * m;
      if (netProceeds > totalPaidSoFar) breakEvenMonth = m;
    }
  }
  return { schedule, loanAmount, mensualite, nTotal, breakEvenMonth };
}

// Part de chacun (%) à un capital cumulé remboursé donné — l'intérêt ne compte pas, seul le capital construit de la propriété.
// Chacun finance sa fraction (splitBen / splitMarie) du capital remboursé.
function shareAtCumPrincipal(cumPrincipal) {
  const equityA = APPORT_A + splitBen * cumPrincipal;
  const equityB = APPORT_B + splitMarie * cumPrincipal;
  const totalEquity = APPORT_A + APPORT_B + cumPrincipal;
  return {
    shareA: (equityA / totalEquity) * 100,
    shareB: (equityB / totalEquity) * 100
  };
}

function renderAmortizationFull(scheduleData) {
  const tbody = document.getElementById('amort-tbody');
  tbody.innerHTML = '';
  const { schedule, mensualite, breakEvenMonth } = scheduleData;
  for (let m = 1; m < schedule.length; m++) {
    const row = schedule[m];
    const { shareA, shareB } = shareAtCumPrincipal(row.cumPrincipal);
    const appartValue = prixAppart * Math.pow(1 + APPART_GROWTH / 100, m / 12);
    const tr = document.createElement('tr');
    tr.dataset.month = m;
    if (m === breakEvenMonth) tr.classList.add('plus-value-row');
    tr.innerHTML =
      '<td>' + m + (m === breakEvenMonth ? ' ★' : '') + '</td>' +
      '<td>' + fmt(Math.round(appartValue)) + '</td>' +
      '<td>' + fmt(Math.round(mensualite)) + '</td>' +
      '<td>' + fmt(Math.round(row.interest)) + '</td>' +
      '<td>' + fmt(Math.round(row.principal)) + '</td>' +
      '<td>' + fmt(Math.round(row.balance)) + '</td>' +
      '<td class="you">' + fmtPct(shareA) + '</td>' +
      '<td class="partner">' + fmtPct(shareB) + '</td>';
    tbody.appendChild(tr);
  }

  const noteEl = document.getElementById('plus-value-note');
  if (breakEvenMonth) {
    noteEl.innerHTML = '<span style="color:var(--amber); font-weight:600;">★ Mois ' + breakEvenMonth + '</span> (' + formatDateDansNMois(breakEvenMonth) + ') — c’est le premier mois où la valeur de revente estimée (prix initial + appréciation ' + APPART_GROWTH + '%/an, moins le solde restant dû) dépasse tout l’argent réellement sorti de vos poches à deux (apport + mensualités payées, capital et intérêts inclus). Avant ce mois, vous seriez encore en perte nette si vous vendiez.';
  } else {
    noteEl.textContent = 'Avec les paramètres actuels, la plus-value nette n’est pas atteinte avant la fin du prêt (20 ans).';
  }
}

// Redimensionnement des colonnes façon Excel : glisser-déposer sur la poignée à droite de chaque en-tête.
function initColumnResize() {
  const resizers = document.querySelectorAll('#amort-table .col-resizer');
  resizers.forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const colIndex = resizer.getAttribute('data-col');
      const col = document.getElementById('col-' + colIndex);
      const startX = e.pageX;
      const startWidth = col.offsetWidth;
      resizer.classList.add('resizing');

      function onMouseMove(eMove) {
        const delta = eMove.pageX - startX;
        const newWidth = Math.max(40, startWidth + delta);
        col.style.width = newWidth + 'px';
      }
      function onMouseUp() {
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

function selectMonth(m) {
  if (!lastLoanData) return;
  const row = lastLoanData.schedule[m];
  if (!row) return;
  selectedMonth = m;

  const { shareA, shareB } = shareAtCumPrincipal(row.cumPrincipal);

  // Total cumulé réellement payé par chacun à cette date : son apport + sa fraction de toutes les mensualités versées jusqu'ici (capital et intérêts inclus, puisqu'il les paie tous les deux).
  const totalMensualitesPayeesACeMois = lastLoanData.mensualite * m;
  const totalPaidA = APPORT_A + totalMensualitesPayeesACeMois * splitBen;
  const totalPaidB = APPORT_B + totalMensualitesPayeesACeMois * splitMarie;
  const capitalRefundedA = row.cumPrincipal * splitBen; // capital remboursé seul, sans l'apport (qui a sa propre ligne)
  const capitalRefundedB = row.cumPrincipal * splitMarie;
  const interetPaidA = totalPaidA - APPORT_A - capitalRefundedA;
  const interetPaidB = totalPaidB - APPORT_B - capitalRefundedB;

  // Remboursement mensuel de chacun (constant sur toute la durée) = sa fraction de la mensualité.
  document.getElementById('detail-mensualite-ben').textContent = fmt(Math.round(lastLoanData.mensualite * splitBen)) + '/mois';
  document.getElementById('detail-mensualite-marie').textContent = fmt(Math.round(lastLoanData.mensualite * splitMarie)) + '/mois';

  document.getElementById('detail-mois').textContent = 'Mois ' + m + ' (' + (m / 12).toFixed(1) + ' ans)';
  document.getElementById('detail-date').textContent = formatDateDansNMois(m);
  document.getElementById('detail-solde').textContent = fmt(Math.round(row.balance));
  document.getElementById('detail-interets-cumules').textContent = fmt(Math.round(row.cumInterest));
  // Intérêts totaux du crédit sur toute la durée = intérêts cumulés du dernier mois de l'échéancier.
  const interetsTotal = lastLoanData.schedule[lastLoanData.nTotal].cumInterest;
  document.getElementById('detail-interets-total').textContent = fmt(Math.round(interetsTotal));
  document.getElementById('detail-total-a').textContent = fmt(Math.round(totalPaidA));
  document.getElementById('detail-apport-a').textContent = fmt(Math.round(APPORT_A));
  document.getElementById('detail-total-a-capital').textContent = fmt(Math.round(capitalRefundedA));
  document.getElementById('detail-total-a-interet').textContent = fmt(Math.round(interetPaidA));
  document.getElementById('detail-total-b').textContent = fmt(Math.round(totalPaidB));
  document.getElementById('detail-apport-b').textContent = fmt(Math.round(APPORT_B));
  document.getElementById('detail-total-b-capital').textContent = fmt(Math.round(capitalRefundedB));
  document.getElementById('detail-total-b-interet').textContent = fmt(Math.round(interetPaidB));
  document.getElementById('detail-part-a').textContent = fmtPct(shareA);
  document.getElementById('detail-part-b').textContent = fmtPct(shareB);

  // Scénario au prix de marché estimé : prix d'achat initial (onglet Simulation taux) + appréciation composée à 3%/an, moins le solde restant dû, réparti selon les mêmes parts.
  const marketValueNow = prixAppart * Math.pow(1 + APPART_GROWTH / 100, m / 12);
  const netProceedsMarket = Math.max(0, marketValueNow - row.balance);
  const saleMarketA = netProceedsMarket * (shareA / 100);
  const saleMarketB = netProceedsMarket * (shareB / 100);
  document.getElementById('detail-valeur-appart').textContent = fmt(Math.round(marketValueNow));

  let venteMarcheHtml =
    'Prix initial (' + fmt(Math.round(prixAppart)) + ') apprécié à ' + APPART_GROWTH + '%/an sur ' + (m / 12).toFixed(1) + ' ans ≈ ' + fmt(Math.round(marketValueNow)) + '. Moins le solde restant dû (' + fmt(Math.round(row.balance)) + '), il resterait ' + fmt(Math.round(netProceedsMarket)) + ' à partager : <span class="you">' + fmt(Math.round(saleMarketA)) + ' iraient à Benjamin</span> et <span class="partner">' + fmt(Math.round(saleMarketB)) + ' iraient à Marie</span>.';

  // Explication uniquement si l'un des deux récupérerait moins que son apport initial — sinon on n'encombre pas la carte.
  const dessousA = saleMarketA < APPORT_A;
  const dessousB = saleMarketB < APPORT_B;
  if (dessousA || dessousB) {
    let qui;
    if (dessousA && dessousB) qui = 'Benjamin et Marie récupèrent tous les deux moins que leur apport initial';
    else if (dessousA) qui = 'Benjamin récupère moins que son apport initial (' + fmt(APPORT_A) + ')';
    else qui = 'Marie récupère moins que son apport initial (' + fmt(APPORT_B) + ')';
    venteMarcheHtml += '<br><br><span style="color:var(--brick); font-weight:500;">⚠ ' + qui + '.</span> Ce n’est pas une perte de valeur du bien — c’est parce que les frais d’acquisition (enregistrement + notaire, payés une fois à l’achat) ne sont jamais récupérés à la revente. Tant que l’appréciation du bien et le capital déjà remboursé ne compensent pas ces frais, une revente rapide coûterait de l’argent même sans baisse de marché.';
  }

  document.getElementById('detail-vente-marche').innerHTML = venteMarcheHtml;

  document.querySelectorAll('#amort-tbody tr').forEach(tr => {
    tr.classList.toggle('selected-row', parseInt(tr.dataset.month) === m);
  });
}

// Recalcule et réaffiche tout l'onglet 2 (synthèse + échéancier complet) à partir de l'état courant —
// appelé au chargement et à chaque changement dans l'onglet Simulation taux.
function refreshTab2() {
  // L'apport "brut" de chacun (70/30) est recalculé sur l'apport réellement en vigueur — pas figé à 100K.
  // Les frais d'acquisition sont toujours payés à part (case "Frais hors emprunt" cochée par défaut dans l'onglet Simulation taux) :
  // l'apport ci-dessous ne contient donc jamais de part de frais, l'apport effectif = apport brut, sans rééquilibrage à calculer.
  APPORT_A_RAW = apport * benRatio;
  APPORT_B_RAW = apport * (1 - benRatio);
  APPORT_A = APPORT_A_RAW;
  APPORT_B = APPORT_B_RAW;
  document.getElementById('assumptions-apport').textContent =
    'Apport Benjamin : ' + fmt(Math.round(APPORT_A_RAW)) + ' (' + (benRatio * 100).toFixed(0) + '%) · Apport Marie : ' + fmt(Math.round(APPORT_B_RAW)) + ' (' + ((1 - benRatio) * 100).toFixed(0) + '%)';

  const freshLoanData = buildLoanSchedule();

  // Fractions de remboursement (50/50 par défaut, ou calculées pour finir à 50 % chacun si le mode équilibré est actif).
  ({ splitBen, splitMarie } = computeSplit(freshLoanData.loanAmount));

  if (equalizeShares) {
    document.getElementById('assumptions-mensualite').textContent =
      'Ben ' + fmt(Math.round(freshLoanData.mensualite * splitBen)) + '/mois · Marie ' + fmt(Math.round(freshLoanData.mensualite * splitMarie)) + '/mois';
  } else {
    document.getElementById('assumptions-mensualite').textContent = fmt(Math.round(freshLoanData.mensualite / 2)) + '/mois chacun';
  }
  document.getElementById('loan-derived-note').textContent =
    'Emprunt = ' + fmt(Math.round(freshLoanData.loanAmount)) + ' (valeur reprise en temps réel de la case “Montant à emprunter” de l’onglet Simulation taux), au taux de ' + tauxPct.toFixed(2) + '% sur ' + DUREE_ANS_TAB2 + ' ans → mensualité ' + fmt(Math.round(freshLoanData.mensualite)) + '/mois. Si tu modifies l’apport, le prix ou le taux dans l’onglet Simulation taux, ce tableau se met à jour automatiquement.';

  // Total versé par personne sur toute la durée = apport initial + sa fraction de l'ensemble des mensualités payées (capital + intérêts inclus, puisque c'est de l'argent réellement sorti de sa poche).
  const totalMensualitesPayees = freshLoanData.mensualite * freshLoanData.nTotal;
  const totalVerseA = APPORT_A + totalMensualitesPayees * splitBen;
  const totalVerseB = APPORT_B + totalMensualitesPayees * splitMarie;
  document.getElementById('total-verse-a').textContent = fmt(Math.round(totalVerseA));
  document.getElementById('total-verse-b').textContent = fmt(Math.round(totalVerseB));

  // Détail capital (= équité, construit la propriété) vs intérêts (= coût pur, ne construit rien).
  // Le capital total remboursé sur la durée = le montant emprunté lui-même (prêt intégralement amorti) ; les intérêts = le reste des mensualités payées.
  const totalInteretPaye = totalMensualitesPayees - freshLoanData.loanAmount;
  const capitalA = APPORT_A + freshLoanData.loanAmount * splitBen;
  const capitalB = APPORT_B + freshLoanData.loanAmount * splitMarie;
  const interetA = totalInteretPaye * splitBen;
  const interetB = totalInteretPaye * splitMarie;
  document.getElementById('capital-verse-a').textContent = fmt(Math.round(capitalA));
  document.getElementById('interet-verse-a').textContent = fmt(Math.round(interetA));
  document.getElementById('capital-verse-b').textContent = fmt(Math.round(capitalB));
  document.getElementById('interet-verse-b').textContent = fmt(Math.round(interetB));

  renderAmortizationFull(freshLoanData);

  lastLoanData = freshLoanData;
  const monthToSelect = Math.min(selectedMonth, freshLoanData.nTotal);
  selectMonth(monthToSelect);
}

// Clic sur une ligne du tableau → détail du mois correspondant.
document.getElementById('amort-tbody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr || !tr.dataset.month) return;
  selectMonth(parseInt(tr.dataset.month));
});

// Bascule « propriété 50/50 au terme » : Marie paie davantage pour rattraper l'apport de Ben.
// Recalcule tout l'onglet (tableau, totaux, revente) avec la nouvelle répartition.
document.getElementById('chk-equalize-shares').addEventListener('change', (e) => {
  equalizeShares = e.target.checked;
  refreshTab2();
});

initColumnResize();
