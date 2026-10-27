/* ==========================================================================
   Onglet « Placement ETF » — section « Où en est votre machine ? ».
   La "machine", ce sont les intérêts composés : chaque année, ils produisent
   capital × rendement, à mettre en regard de ce que l'épargne personnelle
   (mensuelle × 12) apporte. Le ratio entre les deux définit 4 phases, de
   "c'est vous qui portez l'effort" à "la machine s'auto-alimente". Les
   seuils de capital et les dates d'atteinte se déduisent directement de ce
   ratio et des paramètres saisis — refreshMachine() recalcule tout à chaque
   changement d'un des 3 champs.
   ========================================================================== */
(function () {
  const elCapital = document.getElementById('in-machine-capital');
  const elEpargne = document.getElementById('in-machine-epargne');
  const elRendement = document.getElementById('in-machine-rendement');
  const elStatus = document.getElementById('machine-status');
  const elPhases = document.getElementById('machine-phases');
  const elChart = document.getElementById('machine-chart-wrap');
  if (!elCapital) return;

  const ANNEE_DEPART = new Date().getFullYear();
  const HORIZON_ANS = 25; // même horizon que la projection ETF au-dessus

  let capital = 20000;   // €
  let epargne = 300;     // €/mois
  let rendement = 7;     // % annuel moyen

  const PHASES = [
    { id: 1, nom: 'Phase plate', seuilBas: 0, seuilHaut: 0.5,
      desc: 'C’est encore vous qui faites l’essentiel du travail. Les intérêts composés fonctionnent déjà, mais votre capital est trop faible pour produire beaucoup en euros.' },
    { id: 2, nom: 'Équilibre', seuilBas: 0.5, seuilHaut: 0.75,
      desc: 'Votre épargne et les intérêts composés se partagent désormais la progression à parts proches : la machine commence à peser autant que vous.' },
    { id: 3, nom: 'Composition', seuilBas: 0.75, seuilHaut: 0.90,
      desc: 'La machine fait maintenant l’essentiel du travail : les intérêts composés dépassent largement ce que vous versez chaque mois.' },
    { id: 4, nom: 'Accélération exponentielle', seuilBas: 0.90, seuilHaut: 1,
      desc: 'Votre épargne personnelle ne pèse presque plus rien : la machine s’auto-alimente et la progression s’accélère d’elle-même, mécaniquement.' }
  ];

  // Part de la progression annuelle produite par les intérêts composés (vs. l'épargne versée).
  function pctMachine(cap, epargneAn, r) {
    const machine = cap * r;
    const total = machine + epargneAn;
    return total > 0 ? (machine / total) * 100 : 0;
  }

  // Capital à partir duquel la machine atteint une part t (0 < t < 1) de la progression —
  // résolution directe de pctMachine(C) = t, indépendante du temps.
  function capitalPourSeuil(t, epargneAn, r) {
    if (t <= 0) return 0;
    if (t >= 1 || r <= 0) return Infinity;
    return (t / (1 - t)) * (epargneAn / r);
  }

  // Durée (en années) pour atteindre un capital cible, épargne mensuelle versée en fin de
  // mois, rendement composé mensuellement — même convention que la projection ETF ci-dessus.
  function anneesPourAtteindre(cap, cible, epargneMois, rMonthly) {
    if (cible <= cap) return 0;
    if (rMonthly <= 0) return epargneMois > 0 ? (cible - cap) / epargneMois / 12 : Infinity;
    const k = epargneMois / rMonthly;
    const ratio = (cible + k) / (cap + k);
    if (ratio <= 1) return Infinity;
    return (Math.log(ratio) / Math.log(1 + rMonthly)) / 12;
  }

  function formatAns(y) {
    if (!isFinite(y)) return null;
    return y < 10 ? (Math.round(y * 10) / 10).toFixed(1).replace('.', ',') + ' ans' : Math.round(y) + ' ans';
  }

  function fmtCompact(v) {
    if (!isFinite(v)) return '∞';
    if (v >= 1000000) return (Math.round(v / 100000) / 10).toString().replace('.', ',') + ' M';
    if (v >= 1000) return Math.round(v / 1000) + ' k';
    return Math.round(v) + ' €';
  }

  function renderStatus(pct, phase) {
    elStatus.innerHTML =
      '<p class="machine-status__lead">Aujourd’hui,<br>la machine apporte <span class="machine-status__pct">' +
      Math.round(pct) + ' %</span> de votre progression annuelle.</p>' +
      '<p class="machine-status__badge">→ Vous êtes en phase ' + phase.id + ' : ' + phase.nom + '</p>' +
      '<p class="note note--flush">' + phase.desc + '</p>' +
      '<div class="machine-bar">' +
        '<div class="machine-bar__track">' +
          '<span class="machine-bar__seg machine-bar__seg--1"></span>' +
          '<span class="machine-bar__seg machine-bar__seg--2"></span>' +
          '<span class="machine-bar__seg machine-bar__seg--3"></span>' +
          '<span class="machine-bar__seg machine-bar__seg--4"></span>' +
          '<span class="machine-bar__marker" style="left:' + Math.min(100, Math.max(0, pct)) + '%"></span>' +
        '</div>' +
        '<div class="machine-bar__ticks">' +
          '<span style="left:0%">0 %</span><span style="left:50%">50 %</span>' +
          '<span style="left:75%">75 %</span><span style="left:90%">90 %</span>' +
          '<span style="left:100%">100 %</span>' +
        '</div>' +
      '</div>';
  }

  function renderPhases(seuils, phaseActuelleIdx, epargneMois, rMonthly) {
    let html = '';
    PHASES.forEach((phase, i) => {
      const bas = seuils[i];
      const haut = i < PHASES.length - 1 ? seuils[i + 1] : null;
      const estActuelle = i === phaseActuelleIdx;
      const dejaDepassee = i < phaseActuelleIdx;

      const seuilAffiche = i === 0 ? Math.round(phase.seuilHaut * 100) : Math.round(phase.seuilBas * 100);
      const comparatif = i === 0 ? 'moins de' : 'au moins';

      let bloc;
      if (estActuelle) {
        // "0" plutôt que "0 €" en borne basse d'une plage : évite de mélanger les unités
        // avec la borne haute en "k"/"M" (ex. "0 € → 180 k").
        bloc = '<p class="phase-card__range">' + (bas === 0 ? '0' : fmtCompact(bas)) + ' → ' + (haut === null ? '∞' : fmtCompact(haut)) + '</p>' +
          '<p class="phase-card__status">Vous y êtes</p>';
      } else if (dejaDepassee) {
        bloc = '<p class="phase-card__range">dès ' + fmtCompact(bas) + '</p>' +
          '<p class="phase-card__status phase-card__status--passe">Déjà dépassée</p>';
      } else {
        const ans = anneesPourAtteindre(capital, bas, epargneMois, rMonthly);
        const label = formatAns(ans);
        bloc = '<p class="phase-card__range">dès ' + fmtCompact(bas) + '</p>' +
          (label
            ? '<p class="phase-card__date">dans ~' + label + ' (' + (ANNEE_DEPART + Math.ceil(ans)) + ')</p>'
            : '<p class="phase-card__status phase-card__status--passe">Pas atteint à ce rythme</p>');
      }

      html += '<div class="phase-card' + (estActuelle ? ' phase-card--current' : '') + '">' +
        '<p class="phase-card__title">' + phase.id + '. ' + phase.nom +
        (estActuelle ? ' <span class="phase-card__pill">Vous êtes ici</span>' : '') + '</p>' +
        '<p class="phase-card__desc">La machine apporte ' + comparatif + ' ' + seuilAffiche + ' %</p>' +
        bloc +
      '</div>';
    });
    elPhases.innerHTML = html;
  }

  // Trajectoire projetée sur HORIZON_ANS, pour tracer la courbe et placer les bandes de phase
  // (chaque bande dure de la date d'entrée dans la phase à la date d'entrée dans la suivante).
  function renderChart(seuils, rMonthly, epargneMois) {
    const W = 640, H = 300;
    const mL = 54, mR = 10, mT = 10, mB = 26;
    const plotW = W - mL - mR, plotH = H - mT - mB;

    const points = [];
    for (let y = 0; y <= HORIZON_ANS; y++) {
      const n = y * 12;
      const growth = Math.pow(1 + rMonthly, n);
      const v = capital * growth + (rMonthly === 0 ? epargneMois * n : epargneMois * ((growth - 1) / rMonthly));
      points.push({ y, v });
    }
    // seuils[1] (entrée en phase 2) peut valoir Infinity (rendement nul : aucun seuil de
    // capital n'y fait jamais plus de 50 % de la progression) — exclu du calcul de l'échelle,
    // sous peine de la faire basculer elle-même à Infinity (puis Infinity/Infinity = NaN
    // dans yScale). Plancher à 1 pour rester défini même quand tout est à 0.
    const maxV = Math.max(1, ...points.map(p => p.v), isFinite(seuils[1]) ? seuils[1] : 0) * 1.08;

    const xScale = (y) => mL + (y / HORIZON_ANS) * plotW;
    const yScale = (v) => mT + plotH - Math.min(v, maxV) / maxV * plotH;

    // Dates d'entrée dans chaque phase (année depuis aujourd'hui), pour les bandes de fond.
    const entrees = seuils.map(s => (s <= capital ? 0 : anneesPourAtteindre(capital, s, epargneMois, rMonthly)));
    const bandes = ['#f4f2f8', '#efe8fc', '#fff3e4', '#e9f4ee']; // neutre, violet-wash, apricot-wash, vert très pâle
    let fond = '';
    for (let i = 0; i < PHASES.length; i++) {
      const x0 = xScale(Math.min(entrees[i], HORIZON_ANS));
      const x1 = i < PHASES.length - 1 && isFinite(entrees[i + 1]) ? xScale(Math.min(entrees[i + 1], HORIZON_ANS)) : xScale(HORIZON_ANS);
      if (x1 <= x0) continue;
      fond += '<rect x="' + x0 + '" y="' + mT + '" width="' + (x1 - x0) + '" height="' + plotH + '" fill="' + bandes[i] + '"/>';
    }

    // Lignes pointillées aux seuils de capital (quand ils tiennent dans l'échelle affichée).
    let lignesSeuil = '';
    [seuils[1], seuils[2], seuils[3]].forEach((s) => {
      if (!isFinite(s) || s > maxV) return;
      const yy = yScale(s);
      lignesSeuil += '<line x1="' + mL + '" y1="' + yy + '" x2="' + (W - mR) + '" y2="' + yy +
        '" stroke="#b9b2c6" stroke-width="1" stroke-dasharray="3,3"/>';
    });

    // Axes.
    let axeY = '';
    for (let i = 0; i <= 4; i++) {
      const v = (maxV / 4) * i;
      const yy = yScale(v);
      axeY += '<text x="' + (mL - 8) + '" y="' + (yy + 3) + '" font-size="10" fill="#6b6478" text-anchor="end">' + fmtCompact(v) + '</text>';
    }
    let axeX = '';
    for (let y = 0; y <= HORIZON_ANS; y += 5) {
      // Ancrage au bord (pas centré) aux deux extrémités, pour que le texte ne déborde pas
      // du viewBox (ex. "25 ans" tronqué en "25 an" quand il est centré sur le dernier point).
      const ancrage = y === 0 ? 'start' : (y === HORIZON_ANS ? 'end' : 'middle');
      axeX += '<text x="' + xScale(y) + '" y="' + (H - 6) + '" font-size="10" fill="#6b6478" text-anchor="' + ancrage + '">' +
        (y === 0 ? 'auj.' : y + ' ans') + '</text>';
    }

    const chemin = points.map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p.y) + ',' + yScale(p.v)).join(' ');
    const depart = points[0];

    const svg =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Trajectoire du capital sur ' + HORIZON_ANS + ' ans">' +
        fond + lignesSeuil + axeY + axeX +
        '<path d="' + chemin + '" fill="none" stroke="#6a00f4" stroke-width="2.5"/>' +
        '<circle cx="' + xScale(depart.y) + '" cy="' + yScale(depart.v) + '" r="4" fill="#1a0b2e"/>' +
        '<text x="' + (xScale(depart.y) + 6) + '" y="' + (yScale(depart.v) - 8) + '" font-size="10" fill="#1a0b2e">vous êtes ici</text>' +
      '</svg>';
    elChart.innerHTML = svg;
  }

  window.refreshMachine = function refreshMachine() {
    elCapital.value = Math.round(capital);
    elEpargne.value = Math.round(epargne);
    elRendement.value = rendement.toFixed(1);

    const r = rendement / 100;
    const rMonthly = r / 12;
    const epargneAn = epargne * 12;
    const pct = pctMachine(capital, epargneAn, r);

    let phaseActuelleIdx = PHASES.length - 1;
    for (let i = 0; i < PHASES.length; i++) {
      if (pct < PHASES[i].seuilHaut * 100) { phaseActuelleIdx = i; break; }
    }

    const seuils = PHASES.map(p => capitalPourSeuil(p.seuilBas, epargneAn, r));

    renderStatus(pct, PHASES[phaseActuelleIdx]);
    renderPhases(seuils, phaseActuelleIdx, epargne, rMonthly);
    renderChart(seuils, rMonthly, epargne);
  };

  elCapital.addEventListener('change', () => { capital = Math.max(0, parseFloat(elCapital.value) || 0); refreshMachine(); });
  elEpargne.addEventListener('change', () => { epargne = Math.max(0, parseFloat(elEpargne.value) || 0); refreshMachine(); });
  elRendement.addEventListener('change', () => { rendement = Math.min(Math.max(0, parseFloat(elRendement.value) || 0), 12); refreshMachine(); });

  refreshMachine();
})();
