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
let dureeChoisie = 20; // durée cochée (15/20/25) dans Simulation taux — pilote tout l'onglet Répartition
const APPART_GROWTH = 2; // %/an d'appréciation du bien — utilisé pour la valeur estimée et le mois de plus-value
const AGENCY_FEE_PCT = 3; // % de frais d'agence déduits du prix de vente

let lastLoanData = null; // dernier échéancier calculé, utilisé par le clic sur une ligne
let selectedMonth = 1;   // mois sélectionné par défaut à l'ouverture

// Répartition du remboursement entre Ben et Marie — remboursements mensuels FIXES.
// Modèle : les INTÉRÊTS sont un coût commun, partagés 50/50 chaque mois ; seul l'effort
// en CAPITAL diffère. Par défaut chacun paie la moitié de la mensualité. Si equalizeShares
// est activé, on calcule la mensualité de chacun pour qu'au terme du prêt chacun possède 50 %.
let equalizeShares = false;
let payBen = 0;   // remboursement mensuel fixe de Ben
let payMarie = 0; // remboursement mensuel fixe de Marie

// Mensualités fixes de chacun.
// Équité de Ben à l'instant m = APPORT_A + payBen×m − 50% des intérêts cumulés (les intérêts
// ne construisent pas de propriété). En mode équilibré, on résout payBen pour qu'en fin de prêt
// l'équité de Ben égale la moitié de (apport total + capital emprunté).
function computePayments(loanData) {
  const { mensualite, nTotal, loanAmount } = loanData;
  // Solo : un seul emprunteur, tout lui est attribué (pas de répartition à calculer).
  if (typeof mode !== 'undefined' && mode === 'solo') {
    return { payBen: mensualite, payMarie: 0 };
  }
  if (!equalizeShares || mensualite <= 0) {
    return { payBen: mensualite / 2, payMarie: mensualite / 2 };
  }
  const totalInterest = loanData.schedule[nTotal].cumInterest;
  const cibleEquite = (APPORT_A + APPORT_B + loanAmount) / 2;
  // payBen×nTotal = capital que Ben doit financer (cible − apport) + sa moitié des intérêts.
  let pBen = (cibleEquite - APPORT_A + 0.5 * totalInterest) / nTotal;
  pBen = Math.min(Math.max(pBen, 0), mensualite); // borne entre 0 et la mensualité entière
  return { payBen: pBen, payMarie: mensualite - pBen };
}

// Construit l'échéancier complet à partir du montant à emprunter LIVE (case "Montant à emprunter" de l'onglet Simulation taux) et du taux LIVE.
function buildLoanSchedule() {
  const loanAmount = montantEmprunte(); // valeur en temps réel depuis l'onglet 3
  const rMonthly = tauxMensuel(tauxPct); // taux en temps réel depuis l'onglet 3, équivalence actuarielle
  const nTotal = dureeChoisie * 12;
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
      const netProceeds = marketValue - marketValue * (AGENCY_FEE_PCT / 100) - balance; // net après frais d'agence
      const totalPaidSoFar = APPORT_A + APPORT_B + mensualite * m;
      if (netProceeds > totalPaidSoFar) breakEvenMonth = m;
    }
  }
  return { schedule, loanAmount, mensualite, nTotal, breakEvenMonth };
}

// Part de chacun (%) à un mois donné — seul le CAPITAL construit de la propriété.
// Capital financé par une personne = ses remboursements versés − sa moitié des intérêts cumulés
// (les intérêts sont un coût, pas de la propriété). Équité = apport + capital financé.
function shareAtRow(row) {
  const equityA = APPORT_A + payBen * row.month - 0.5 * row.cumInterest;
  const equityB = APPORT_B + payMarie * row.month - 0.5 * row.cumInterest;
  const totalEquity = APPORT_A + APPORT_B + row.cumPrincipal;
  return {
    shareA: (equityA / totalEquity) * 100,
    shareB: (equityB / totalEquity) * 100
  };
}

function renderAmortizationFull(scheduleData) {
  const tbody = document.getElementById('amort-tbody');
  tbody.innerHTML = '';
  const { schedule, mensualite, breakEvenMonth } = scheduleData;
  // En solo, le tableau n'a plus que 6 colonnes (les <th>/<col> "Capital Marie/Ben" et "Part
  // Ben/Marie" sont retirées du DOM par rate-simulation.js/applyMode) : les lignes générées ici
  // doivent avoir exactement le même nombre de <td>, sans quoi les colonnes seraient décalées.
  const isSolo = typeof mode !== 'undefined' && mode === 'solo';
  for (let m = 1; m < schedule.length; m++) {
    const row = schedule[m];
    const { shareA, shareB } = shareAtRow(row);
    const appartValue = prixAppart * Math.pow(1 + APPART_GROWTH / 100, m / 12);
    // Capital remboursé ce mois-ci par chacun = son remboursement du mois − sa moitié des intérêts du mois.
    const capMarie = payMarie - 0.5 * row.interest;
    const capBen = payBen - 0.5 * row.interest;
    const tr = document.createElement('tr');
    tr.dataset.month = m;
    if (m === breakEvenMonth) tr.classList.add('plus-value-row');
    let rowHtml =
      '<td>' + m + (m === breakEvenMonth ? ' ★' : '') + '</td>' +
      '<td>' + fmt(Math.round(appartValue)) + '</td>' +
      '<td>' + fmt(Math.round(mensualite)) + '</td>' +
      '<td>' + fmt(Math.round(row.interest)) + '</td>' +
      '<td>' + fmt(Math.round(row.principal)) + '</td>';
    if (!isSolo) {
      rowHtml +=
        '<td class="partner">' + fmt(Math.round(capMarie)) + '</td>' +
        '<td class="you">' + fmt(Math.round(capBen)) + '</td>';
    }
    rowHtml += '<td>' + fmt(Math.round(row.balance)) + '</td>';
    if (!isSolo) {
      rowHtml +=
        '<td class="you">' + fmtPct(shareA) + '</td>' +
        '<td class="partner">' + fmtPct(shareB) + '</td>';
    }
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  }

  const noteEl = document.getElementById('plus-value-note');
  if (breakEvenMonth) {
    noteEl.innerHTML = '<span style="color:var(--amber); font-weight:600;">★ Mois ' + breakEvenMonth + '</span> (' + formatDateDansNMois(breakEvenMonth) + ') — c’est le premier mois où la valeur de revente estimée (prix initial + appréciation ' + APPART_GROWTH + '%/an, moins les frais d’agence ' + AGENCY_FEE_PCT + '% et le solde restant dû) dépasse tout l’argent réellement sorti de vos poches à deux (apport + mensualités payées, capital et intérêts inclus). Avant ce mois, vous seriez encore en perte nette si vous vendiez.';
  } else {
    noteEl.textContent = 'Avec les paramètres actuels, la plus-value nette n’est pas atteinte avant la fin du prêt (' + dureeChoisie + ' ans).';
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

  const { shareA, shareB } = shareAtRow(row);

  // Total cumulé réellement payé par chacun à cette date = son apport + ses remboursements mensuels versés jusqu'ici.
  const totalPaidA = APPORT_A + payBen * m;
  const totalPaidB = APPORT_B + payMarie * m;
  // Intérêts : coût commun partagé 50/50. Capital financé = remboursements versés − sa moitié des intérêts.
  const interetPaidA = 0.5 * row.cumInterest;
  const interetPaidB = 0.5 * row.cumInterest;
  const capitalRefundedA = payBen * m - interetPaidA; // capital remboursé seul, sans l'apport (qui a sa propre ligne)
  const capitalRefundedB = payMarie * m - interetPaidB;

  // Remboursement mensuel fixe de chacun.
  document.getElementById('detail-mensualite-ben').textContent = fmt(Math.round(payBen)) + '/mois';
  document.getElementById('detail-mensualite-marie').textContent = fmt(Math.round(payMarie)) + '/mois';

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

  // Scénario au prix de marché estimé : prix d'achat initial (onglet Simulation taux) + appréciation composée, moins les frais d'agence (3%) et le solde restant dû, réparti selon les mêmes parts.
  const marketValueNow = prixAppart * Math.pow(1 + APPART_GROWTH / 100, m / 12);
  const fraisAgence = marketValueNow * (AGENCY_FEE_PCT / 100);
  const netProceedsMarket = Math.max(0, marketValueNow - fraisAgence - row.balance);
  const saleMarketA = netProceedsMarket * (shareA / 100);
  const saleMarketB = netProceedsMarket * (shareB / 100);
  document.getElementById('detail-valeur-appart').textContent = fmt(Math.round(marketValueNow));

  let venteMarcheHtml =
    'Prix initial (' + fmt(Math.round(prixAppart)) + ') apprécié à ' + APPART_GROWTH + '%/an sur ' + (m / 12).toFixed(1) + ' ans ≈ ' + fmt(Math.round(marketValueNow)) + '. Moins les <b>frais d’agence (' + AGENCY_FEE_PCT + '% = ' + fmt(Math.round(fraisAgence)) + ')</b> et le solde restant dû (' + fmt(Math.round(row.balance)) + '), il resterait ' + fmt(Math.round(netProceedsMarket)) + ' à partager : <span class="you">' + fmt(Math.round(saleMarketA)) + ' iraient à ' + nomA + '</span> et <span class="partner">' + fmt(Math.round(saleMarketB)) + ' iraient à ' + nomB + '</span>.';

  // Explication uniquement si l'un des deux récupérerait moins que son apport initial — sinon on n'encombre pas la carte.
  const dessousA = saleMarketA < APPORT_A;
  const dessousB = saleMarketB < APPORT_B;
  if (dessousA || dessousB) {
    let qui;
    if (dessousA && dessousB) qui = nomA + ' et ' + nomB + ' récupèrent tous les deux moins que leur apport initial';
    else if (dessousA) qui = nomA + ' récupère moins que son apport initial (' + fmt(APPORT_A) + ')';
    else qui = nomB + ' récupère moins que son apport initial (' + fmt(APPORT_B) + ')';
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
  // L'apport "brut" de chacun est recalculé sur l'apport réellement en vigueur — pas figé.
  // Les frais d'acquisition sont toujours payés à part (case "Frais hors emprunt" cochée par défaut dans l'onglet Simulation taux) :
  // l'apport ci-dessous ne contient donc jamais de part de frais, l'apport effectif = apport brut, sans rééquilibrage à calculer.
  // Solo : un seul emprunteur, apport et capital lui sont attribués à 100% (le curseur benRatio n'est pas utilisé en solo).
  const effectiveBenRatio = (typeof mode !== 'undefined' && mode === 'solo') ? 1 : benRatio;
  APPORT_A_RAW = apport * effectiveBenRatio;
  APPORT_B_RAW = apport * (1 - effectiveBenRatio);
  APPORT_A = APPORT_A_RAW;
  APPORT_B = APPORT_B_RAW;
  document.getElementById('assumptions-apport').textContent =
    'Apport ' + nomA + ' : ' + fmt(Math.round(APPORT_A_RAW)) + ' (' + (benRatio * 100).toFixed(0) + '%) · Apport ' + nomB + ' : ' + fmt(Math.round(APPORT_B_RAW)) + ' (' + ((1 - benRatio) * 100).toFixed(0) + '%)';

  // Reflète la durée choisie, l'appréciation et les noms dans les libellés de l'onglet.
  document.querySelectorAll('.duree-ans').forEach(el => { el.textContent = dureeChoisie; });
  document.querySelectorAll('.growth-pct').forEach(el => { el.textContent = APPART_GROWTH; });
  if (typeof syncNames === 'function') syncNames();

  const freshLoanData = buildLoanSchedule();

  // Remboursements mensuels fixes (moitié-moitié par défaut, ou calculés pour finir à 50 % chacun si le mode équilibré est actif).
  ({ payBen, payMarie } = computePayments(freshLoanData));

  if (equalizeShares) {
    document.getElementById('assumptions-mensualite').textContent =
      nomA + ' ' + fmt(Math.round(payBen)) + '/mois · ' + nomB + ' ' + fmt(Math.round(payMarie)) + '/mois (intérêts partagés 50/50)';
  } else {
    document.getElementById('assumptions-mensualite').textContent = fmt(Math.round(payBen)) + '/mois chacun';
  }

  // Note explicative sous la bascule : visible seulement quand le modèle 50/50 est actif.
  const equalizeNote = document.getElementById('equalize-note');
  equalizeNote.style.display = equalizeShares ? 'block' : 'none';
  document.getElementById('equalize-note-int').textContent =
    fmt(Math.round(0.5 * freshLoanData.schedule[freshLoanData.nTotal].cumInterest));
  document.getElementById('loan-derived-note').textContent =
    'Emprunt = ' + fmt(Math.round(freshLoanData.loanAmount)) + ' (valeur reprise en temps réel de la case “Montant à emprunter” de l’onglet Simulation taux), au taux de ' + tauxPct.toFixed(2) + '% sur ' + dureeChoisie + ' ans → mensualité ' + fmt(Math.round(freshLoanData.mensualite)) + '/mois. Si tu modifies l’apport, le prix ou le taux dans l’onglet Simulation taux, ce tableau se met à jour automatiquement.';

  // Total versé par personne sur toute la durée = apport initial + l'ensemble de ses remboursements mensuels.
  const totalInteretPaye = freshLoanData.schedule[freshLoanData.nTotal].cumInterest;
  const totalVerseA = APPORT_A + payBen * freshLoanData.nTotal;
  const totalVerseB = APPORT_B + payMarie * freshLoanData.nTotal;
  document.getElementById('total-verse-a').textContent = fmt(Math.round(totalVerseA));
  document.getElementById('total-verse-b').textContent = fmt(Math.round(totalVerseB));

  // Détail capital (= équité, construit la propriété) vs intérêts (= coût commun, partagé 50/50).
  const interetA = 0.5 * totalInteretPaye;
  const interetB = 0.5 * totalInteretPaye;
  const capitalA = APPORT_A + (payBen * freshLoanData.nTotal - interetA);
  const capitalB = APPORT_B + (payMarie * freshLoanData.nTotal - interetB);
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
