/* ==========================================================================
   Sérialisation de l'état d'une simulation — capture/restaure les 3 onglets
   concernés (Simulation taux, Répartition appartement, Coût total annuel).
   L'onglet Placement ETF est un outil indépendant, volontairement exclu.
   Utilisé par dashboard.js pour sauvegarder/charger dans Firestore.
   ========================================================================== */

function numVal(id) {
  const el = document.getElementById(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}

// Fixe la valeur d'un champ puis déclenche son événement "change" — réutilise
// les écouteurs déjà en place (cost.js) plutôt que de dupliquer leur logique.
function setValAndFire(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// Capture l'état courant en un objet simple, sérialisable en JSON (Firestore).
function captureState() {
  return {
    // --- Simulation taux ---
    prixAppart,
    travaux,
    fraisNotaire,
    fraisBancaires,
    fraisHorsEmprunt: elChkFraisHorsEmprunt.checked,
    apport,
    benRatio,
    tauxPct,
    seuilEndettement: SEUIL_ENDETTEMENT,
    dureeChoisie,
    mode,
    salaireBen,
    salaireMarie,
    salaireSolo,
    chequesBen,
    chequesMarie,
    chequesSolo,
    nomA,
    nomB,
    iraMois,
    iraConditions,
    // --- Répartition appartement ---
    equalizeShares,
    // --- Coût total annuel (le module cost.js encapsule ses variables ; on lit le DOM, qu'il tient à jour) ---
    cout: {
      asrd: numVal('in-cout-asrd'),
      incendie: numVal('in-cout-incendie'),
      compte: numVal('in-cout-compte'),
      copro: numVal('in-cout-copro'),
      reserve: numVal('in-cout-reserve'),
      precompte: numVal('in-cout-precompte'),
      dechets: numVal('in-cout-dechets'),
      charges: numVal('in-cout-charges'),
      energie: numVal('in-cout-energie')
    },
    // --- Coût de la vie (dépenses libres par personne, encapsulées dans budget.js) ---
    budget: (typeof window.getBudgetState === 'function') ? window.getBudgetState() : null
  };
}

// Restaure un état précédemment capturé et rafraîchit tout l'affichage.
function applyState(s) {
  if (!s) return;
  prixAppart = s.prixAppart;
  travaux = s.travaux;
  fraisNotaire = s.fraisNotaire;
  fraisBancaires = s.fraisBancaires;
  elChkFraisHorsEmprunt.checked = s.fraisHorsEmprunt;
  apport = s.apport;
  benRatio = s.benRatio;
  tauxPct = s.tauxPct;
  SEUIL_ENDETTEMENT = s.seuilEndettement;
  salaireBen = s.salaireBen != null ? s.salaireBen : salaireBen;
  salaireMarie = s.salaireMarie != null ? s.salaireMarie : salaireMarie;
  salaireSolo = s.salaireSolo != null ? s.salaireSolo : salaireSolo;
  // Simulations enregistrées avant l'ajout des chèques-repas : champ absent → 0.
  chequesBen = s.chequesBen != null ? s.chequesBen : 0;
  chequesMarie = s.chequesMarie != null ? s.chequesMarie : 0;
  chequesSolo = s.chequesSolo != null ? s.chequesSolo : 0;
  nomA = s.nomA || nomA;
  nomB = s.nomB || nomB;
  iraMois = s.iraMois != null ? s.iraMois : iraMois;
  iraConditions = s.iraConditions || '';
  equalizeShares = s.equalizeShares;
  document.getElementById('chk-equalize-shares').checked = s.equalizeShares;

  if (s.cout) {
    setValAndFire('in-cout-asrd', s.cout.asrd);
    setValAndFire('in-cout-incendie', s.cout.incendie);
    setValAndFire('in-cout-compte', s.cout.compte || 0);
    setValAndFire('in-cout-copro', s.cout.copro);
    setValAndFire('in-cout-reserve', s.cout.reserve);
    setValAndFire('in-cout-precompte', s.cout.precompte);
    setValAndFire('in-cout-dechets', s.cout.dechets);
    setValAndFire('in-cout-charges', s.cout.charges);
    setValAndFire('in-cout-energie', s.cout.energie);
  }

  // selectDuree() coche le bon radio ET déclenche renderCalc(), qui recalcule
  // et réaffiche tout (Simulation taux, Répartition, Coût) à partir des
  // variables ci-dessus.
  selectDuree(s.dureeChoisie);

  // applyMode() affiche/masque les champs Ben/Marie et l'onglet Répartition
  // selon le mode sauvegardé, puis rafraîchit tout une dernière fois.
  // (Simulations sauvegardées avant l'ajout du mode Solo/Duo → "duo" par défaut.)
  applyMode(s.mode || 'duo');

  // Restaure les dépenses de l'onglet Coût de la vie après applyMode (setBudgetState
  // relit le mode courant pour son propre rendu) — absent des simulations plus anciennes.
  if (typeof window.setBudgetState === 'function') window.setBudgetState(s.budget);
}
