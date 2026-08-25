/* ==========================================================================
   Onglet « Mes simulations » — authentification Google + sauvegarde réelle
   dans Firestore (créer, lister, renommer, supprimer, charger pour modifier).
   Chaque simulation = un instantané de captureState() (state.js) : Simulation
   taux + Répartition appartement + Coût total annuel.
   ========================================================================== */
(function () {
  const elNotConfigured = document.getElementById('dash-not-configured');
  const elLoadError = document.getElementById('dash-load-error');
  const elSignedOut = document.getElementById('dash-signed-out');
  const elSignedIn = document.getElementById('dash-signed-in');
  const elAvatar = document.getElementById('dash-avatar');
  const elName = document.getElementById('dash-name');
  const elEmail = document.getElementById('dash-email');
  const elEmpty = document.getElementById('dash-empty');
  const elCompareToolbar = document.getElementById('dash-compare-toolbar');
  const elSimList = document.getElementById('dash-sim-list');
  const btnCompare = document.getElementById('btn-compare-sims');
  const btnSelectAllCompare = document.getElementById('btn-select-all-compare');
  const btnSignIn = document.getElementById('btn-google-signin');
  const btnSignOut = document.getElementById('btn-signout');
  const btnNewSim = document.getElementById('btn-new-simulation');
  const btnSaveNewSim = document.getElementById('btn-save-new-sim');
  const elCurrentBar = document.getElementById('current-sim-bar');
  const elCurrentName = document.getElementById('current-sim-name');
  const btnSaveCurrent = document.getElementById('btn-save-current');
  const btnUnloadCurrent = document.getElementById('btn-unload-current');
  if (!elNotConfigured) return;

  // Tant que firebase-config.js n'a pas été rempli avec de vraies valeurs, on
  // affiche un message neutre et on n'initialise rien (évite des erreurs de
  // réseau/API key invalide dans la console).
  if (typeof FIREBASE_CONFIGURED === 'undefined' || !FIREBASE_CONFIGURED) {
    elNotConfigured.hidden = false;
    return;
  }

  // Le SDK (chargé depuis gstatic.com) peut échouer à charger (réseau, bloqueur de scripts) :
  // on l'affiche proprement au lieu de laisser planter le script.
  if (typeof firebase === 'undefined') {
    elLoadError.hidden = false;
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let unsubscribeList = null; // écouteur Firestore temps réel, à couper à la déconnexion
  let currentSimId = null;    // simulation actuellement chargée pour modification (ou null)
  let currentUid = null;
  // Instantané JSON de captureState() au moment du chargement/dernier enregistrement — sert
  // de référence pour savoir si quelque chose a changé depuis (cf. updateDirtyState).
  let baselineStateJson = null;
  // Deuxième verrou, indépendant du premier : passe à true uniquement quand l'utilisateur
  // touche réellement une donnée (champ de saisie, curseur, bouton d'un outil). Sans lui, la
  // barre reposerait sur la seule comparaison d'états — et le moindre écart involontaire
  // (arrondi, valeur normalisée par le navigateur, restauration incomplète) la ferait
  // apparaître alors que l'utilisateur n'a rien modifié. Les deux conditions sont exigées.
  let userEdited = false;

  function simsCollection() {
    return db.collection('users').doc(currentUid).collection('simulations');
  }

  function formatDate(ts) {
    if (!ts || !ts.toDate) return '';
    return ts.toDate().toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Résumé bref sous le titre : emprunteur(s) et durée. Le taux et le montant ne sont
  // pas repris ici — ils figurent déjà dans le titre (cf. titreSimulation).
  function simSummary(state) {
    if (!state) return '';
    const isSolo = state.mode === 'solo';
    const noms = isSolo
      ? (state.nomA || 'Emprunteur')
      : [state.nomA, state.nomB].filter(Boolean).join(' & ');
    const parts = [];
    if (noms) parts.push(noms);
    if (state.dureeChoisie) parts.push(state.dureeChoisie + ' ans');
    return parts.join(' · ');
  }

  // Bouton "Enregistrer ma simulation" (barre d'onglets) : visible seulement si connecté ET
  // qu'aucune simulation n'est actuellement chargée. Dès qu'on est attaché à une simulation,
  // c'est current-sim-bar qui prend le relais avec "Enregistrer les modifications" — barre
  // qui n'apparaît elle-même qu'en cas de modification (cf. updateDirtyState). Consulter une
  // simulation sans y toucher n'affiche donc aucun bouton d'enregistrement : il n'y a rien à
  // enregistrer, et "+ Nouvelle simulation" reste disponible dans l'onglet Mes simulations.
  function updateSaveNewSimVisibility() {
    btnSaveNewSim.hidden = !currentUid || !!currentSimId;
  }

  function unloadCurrentSim() {
    currentSimId = null;
    baselineStateJson = null;
    userEdited = false;
    elCurrentBar.hidden = true;
    updateSaveNewSimVisibility();
  }

  // On reste attaché à currentSimId dès le chargement (pour savoir où enregistrer), mais
  // la barre elle-même — nom, bouton, ✕, tout le bloc — ne doit apparaître que si quelque
  // chose a réellement changé depuis. Une simple consultation sans y toucher ne doit rien
  // afficher de plus qu'une simulation libre.
  function loadCurrentBar() {
    updateDirtyState();
    updateSaveNewSimVisibility();
  }

  // baselineStateJson est fixé par l'appelant (avant l'écriture Firestore, pas après : sinon
  // une modification pendant l'aller-retour réseau du chargement/enregistrement serait ignorée).
  // suppressAutoHide : le temps de la confirmation "✓ Enregistré" (cf. flashSaveSuccess), la
  // barre reste affichée de force même si l'état est déjà propre.
  let suppressAutoHide = false;
  function updateDirtyState() {
    if (suppressAutoHide) return;
    if (!currentSimId || baselineStateJson === null || !userEdited) {
      elCurrentBar.hidden = true;
      return;
    }
    elCurrentBar.hidden = JSON.stringify(captureState()) === baselineStateJson;
  }

  // Repère une vraie interaction avec une DONNÉE, par opposition à la simple navigation.
  // Sont exclus : le tableau de bord (Consulter/Renommer/Dupliquer/Supprimer), les documents
  // en surimpression (récapitulatif, comparaison, modale), les onglets et le menu déroulant.
  // Sont inclus : tout champ de saisie, et les boutons des outils eux-mêmes (bascule
  // solo/duo, ajout/suppression de dépense…) ainsi que le sélecteur de durée du crédit, qui
  // vit dans l'en-tête mais modifie bel et bien la simulation.
  function estInteractionDonnee(e) {
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return false;
    if (t.closest('#tab-dashboard, #modal-overlay, #recap-overlay, #compare-overlay, #contract-overlay, .tabs, .tabs-dropdown')) {
      return false;
    }
    if (e.type === 'input' || e.type === 'change') {
      return t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA';
    }
    return !!t.closest('.panel button, #duree-float button');
  }

  // Écoute déléguée plutôt qu'un hook par champ : ce simulateur a trop de points de
  // mutation (rate-simulation.js, budget.js, ownership.js, cost.js…) pour tous les
  // intercepter individuellement sans risquer d'en oublier un. Le léger débounce absorbe
  // la frappe rapide et le glissement du curseur de taux (événements "input").
  let dirtyCheckTimer = null;
  function onInteraction(e) {
    if (!currentSimId) return;
    if (!estInteractionDonnee(e)) return;
    userEdited = true;
    clearTimeout(dirtyCheckTimer);
    dirtyCheckTimer = setTimeout(updateDirtyState, 150);
  }
  document.addEventListener('input', onInteraction);
  document.addEventListener('change', onInteraction);
  document.addEventListener('click', onInteraction);

  // Comparaison de simulations (accessible uniquement ici, depuis "Mes simulations") : chaque
  // ligne a une case à cocher, le bouton "Comparer" ouvre compare.js pour 2 à 5 sélectionnées.
  // La sélection est conservée dans un Set indépendant du rendu, pour survivre aux rafraîchissements
  // temps réel de la liste (onSnapshot) tant que les simulations cochées existent toujours.
  const MAX_COMPARE = 5;
  const selectedCompareIds = new Set();
  let latestDocsById = new Map();

  function updateCompareButton() {
    const n = selectedCompareIds.size;
    btnCompare.textContent = n > 0 ? 'Comparer (' + n + ')' : 'Comparer';
    btnCompare.disabled = n < 2;
  }

  // Les 4 premières simulations de la liste (ordre d'affichage = le plus récent en tête) :
  // "Tout sélectionner" coche celles-ci d'un coup au lieu de les cocher une par une, dans la
  // limite de MAX_COMPARE. Un second clic les décoche toutes (bascule).
  function idsSelectionnablesParDefaut() {
    return Array.from(latestDocsById.keys()).slice(0, MAX_COMPARE);
  }
  function updateSelectAllButton() {
    if (!btnSelectAllCompare) return;
    const ids = idsSelectionnablesParDefaut();
    const toutCoche = ids.length > 0 && ids.every(id => selectedCompareIds.has(id));
    btnSelectAllCompare.textContent = toutCoche ? 'Tout désélectionner' : 'Tout sélectionner';
  }

  function renderSimList(docs) {
    elEmpty.hidden = docs.length > 0;
    if (elCompareToolbar) elCompareToolbar.hidden = docs.length < 2;
    elSimList.innerHTML = '';
    latestDocsById = new Map();
    // Une simulation supprimée/absente du nouvel instantané ne doit plus rester sélectionnée.
    const currentIds = new Set(docs.map(d => d.id));
    Array.from(selectedCompareIds).forEach(id => { if (!currentIds.has(id)) selectedCompareIds.delete(id); });

    docs.forEach((doc) => {
      const data = doc.data();
      latestDocsById.set(doc.id, data);
      const row = document.createElement('div');
      row.className = 'dash-sim-row';
      row.dataset.simId = doc.id;
      row.innerHTML =
        '<label class="dash-sim-row__check" title="Sélectionner pour comparer">' +
          '<input type="checkbox" class="chk-compare">' +
        '</label>' +
        '<span class="dash-sim-row__logo"></span>' +
        '<div class="dash-sim-row__info">' +
          '<p class="dash-sim-row__name"></p>' +
          '<p class="dash-sim-row__meta"></p>' +
          '<p class="dash-sim-row__date">Mis à jour le ' + formatDate(data.updatedAt) + '</p>' +
        '</div>' +
        '<div class="dash-sim-row__actions">' +
          '<button type="button" class="btn-secondary" data-action="load">Consulter</button>' +
          '<button type="button" class="btn-secondary" data-action="duplicate">Dupliquer</button>' +
          '<button type="button" class="btn-danger" data-action="delete">Supprimer</button>' +
        '</div>';
      // Titre recalculé depuis l'état plutôt que lu dans data.nom : il reste juste même si
      // la banque, le montant ou le taux ont changé depuis l'enregistrement du document.
      row.querySelector('.dash-sim-row__logo').innerHTML =
        banqueBadge(data.state && data.state.banqueId);
      row.querySelector('.dash-sim-row__name').textContent = titreSimulation(data.state);
      row.querySelector('.dash-sim-row__meta').textContent = simSummary(data.state);

      const chkCompare = row.querySelector('.chk-compare');
      chkCompare.checked = selectedCompareIds.has(doc.id);
      chkCompare.addEventListener('change', () => {
        if (chkCompare.checked && selectedCompareIds.size >= MAX_COMPARE) {
          chkCompare.checked = false;
          return;
        }
        if (chkCompare.checked) selectedCompareIds.add(doc.id);
        else selectedCompareIds.delete(doc.id);
        updateCompareButton();
        updateSelectAllButton();
      });

      row.querySelector('[data-action="load"]').addEventListener('click', () => {
        applyState(data.state);
        currentSimId = doc.id;
        // Repris via captureState() (pas data.state telle quelle) : les simulations plus
        // anciennes n'ont pas tous les champs récents (chèques-repas…), applyState() leur
        // donne une valeur par défaut, il faut comparer sur la même forme normalisée.
        baselineStateJson = JSON.stringify(captureState());
        // applyState() ci-dessus déclenche des événements "change" sur les champs de coût :
        // ils ont pu lever le drapeau alors que l'utilisateur n'a rien fait. On le remet à
        // zéro ici, une fois la restauration terminée.
        userEdited = false;
        const titre = titreSimulation(data.state);
        elCurrentName.textContent = titre;
        loadCurrentBar();
        // Consultation d'abord : récapitulatif en lecture seule, façon document.
        // Le crayon dans sa barre d'outils bascule vers l'édition complète (switchTab).
        if (typeof window.openRecap === 'function') {
          window.openRecap(titre, formatDate(data.updatedAt), () => switchTab('taux'));
        } else {
          switchTab('taux');
        }
      });

      // Duplique la simulation : nouveau document Firestore avec le même state (donc
      // toutes les données déjà remplies), pour repartir d'une base au lieu de tout
      // ressaisir. Aucun nom à saisir — le titre découle de l'état, et la copie prendra
      // le sien dès qu'on y changera la banque, le montant ou le taux. Ne charge pas la
      // copie automatiquement : elle apparaît en tête de liste (updatedAt le plus récent).
      row.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
        const now = firebase.firestore.FieldValue.serverTimestamp();
        simsCollection().add({
          nom: titreSimulation(data.state),
          state: data.state,
          createdAt: now,
          updatedAt: now
        }).catch((err) => {
          alert('Impossible de dupliquer la simulation : ' + err.message);
        });
      });

      row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const ok = await showConfirm({
          title: 'Supprimer cette simulation ?',
          message: '« ' + titreSimulation(data.state) + ' » sera définitivement supprimée. Cette action est irréversible.',
          confirmText: 'Supprimer',
          danger: true
        });
        if (!ok) return;
        simsCollection().doc(doc.id).delete();
        if (currentSimId === doc.id) unloadCurrentSim();
      });

      elSimList.appendChild(row);
    });
    updateCompareButton();
    updateSelectAllButton();
  }

  if (btnSelectAllCompare) {
    btnSelectAllCompare.addEventListener('click', () => {
      const ids = idsSelectionnablesParDefaut();
      const toutCoche = ids.length > 0 && ids.every(id => selectedCompareIds.has(id));
      selectedCompareIds.clear();
      if (!toutCoche) ids.forEach(id => selectedCompareIds.add(id));
      elSimList.querySelectorAll('.dash-sim-row').forEach((row) => {
        const chk = row.querySelector('.chk-compare');
        if (chk) chk.checked = selectedCompareIds.has(row.dataset.simId);
      });
      updateCompareButton();
      updateSelectAllButton();
    });
  }

  btnCompare.addEventListener('click', () => {
    const entries = Array.from(selectedCompareIds)
      .map(id => ({ id, state: latestDocsById.get(id) && latestDocsById.get(id).state }))
      .map(e => ({ id: e.id, state: e.state, nom: titreSimulation(e.state) }))
      .filter(e => e.state);
    if (entries.length < 2) return;
    if (typeof window.openCompare === 'function') window.openCompare(entries);
  });

  function watchSimulations() {
    unsubscribeList = simsCollection().orderBy('updatedAt', 'desc').onSnapshot(
      (snapshot) => renderSimList(snapshot.docs),
      (err) => console.warn('Lecture des simulations impossible :', err.message)
    );
  }

  function showSignedOut() {
    elSignedOut.hidden = false;
    elSignedIn.hidden = true;
    currentUid = null;
    unloadCurrentSim();
    selectedCompareIds.clear();
    updateCompareButton();
    if (unsubscribeList) { unsubscribeList(); unsubscribeList = null; }
  }

  function showSignedIn(user) {
    elSignedOut.hidden = true;
    elSignedIn.hidden = false;
    elAvatar.src = user.photoURL || '';
    elName.textContent = user.displayName || 'Compte Google';
    elEmail.textContent = user.email || '';
    currentUid = user.uid;
    updateSaveNewSimVisibility();
    watchSimulations();
  }

  auth.onAuthStateChanged((user) => {
    if (user) showSignedIn(user);
    else showSignedOut();
  });

  btnSignIn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((err) => {
      console.warn('Connexion Google annulée ou en échec :', err.message);
    });
  });

  btnSignOut.addEventListener('click', async () => {
    const ok = await showConfirm({
      title: 'Se déconnecter ?',
      message: 'Tu devras te reconnecter avec ton compte Google pour retrouver tes simulations enregistrées.',
      confirmText: 'Se déconnecter',
      danger: true
    });
    if (!ok) return;
    auth.signOut();
  });

  // Enregistre l'état courant du simulateur comme une nouvelle simulation Firestore. Utilisé à la
  // fois par "+ Nouvelle simulation" (onglet Mes simulations) et "Enregistrer ma simulation"
  // (bouton dans la barre d'onglets, visible dès qu'on est connecté sans simulation chargée).
  // Aucun nom n'est demandé : le titre découle de l'état (banque · montant · taux).
  function createNewSimulation() {
    // Figé avant l'écriture Firestore : si l'utilisateur modifie un champ pendant l'aller-retour
    // réseau, la comparaison doit se faire contre ce qui a vraiment été enregistré, pas contre
    // un instantané repris après coup qui inclurait ce changement à tort.
    const snapshot = captureState();
    const titre = titreSimulation(snapshot);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    simsCollection().add({
      nom: titre,
      state: snapshot,
      createdAt: now,
      updatedAt: now
    }).then((docRef) => {
      currentSimId = docRef.id;
      baselineStateJson = JSON.stringify(snapshot);
      userEdited = false;
      elCurrentName.textContent = titre;
      loadCurrentBar();
    }).catch((err) => {
      alert('Impossible d’enregistrer la simulation : ' + err.message);
    });
  }

  btnNewSim.addEventListener('click', createNewSimulation);
  btnSaveNewSim.addEventListener('click', createNewSimulation);

  // Petite confirmation visuelle : le bouton passe en vert avec une coche pendant ~1,6s.
  // Pendant ce délai, la barre reste visible de force (suppressAutoHide) — sinon le clic
  // sur "Enregistrer" lui-même déclenche scheduleDirtyCheck (délégué sur tout "click"), qui
  // masquerait aussitôt toute la barre puisque l'état redevient propre, et on ne verrait
  // jamais la confirmation.
  function flashSaveSuccess() {
    suppressAutoHide = true;
    elCurrentBar.hidden = false;
    const original = btnSaveCurrent.innerHTML;
    btnSaveCurrent.classList.add('btn-save--success');
    btnSaveCurrent.innerHTML =
      '<svg class="btn-save__check" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 12 9 17 20 6"/></svg> Enregistré';
    setTimeout(() => {
      btnSaveCurrent.classList.remove('btn-save--success');
      btnSaveCurrent.innerHTML = original;
      suppressAutoHide = false;
      updateDirtyState();
    }, 1600);
  }

  btnSaveCurrent.addEventListener('click', () => {
    if (!currentSimId) return;
    const snapshot = captureState();
    const titre = titreSimulation(snapshot);
    simsCollection().doc(currentSimId).update({
      // Le titre suit l'état : changer de banque, de montant ou de taux le renomme.
      nom: titre,
      state: snapshot,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      baselineStateJson = JSON.stringify(snapshot);
      userEdited = false;
      elCurrentName.textContent = titre;
      flashSaveSuccess();
    }).catch((err) => {
      alert('Impossible d’enregistrer les modifications : ' + err.message);
    });
  });

  btnUnloadCurrent.addEventListener('click', unloadCurrentSim);
})();
