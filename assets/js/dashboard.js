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
  const elCompareHint = document.getElementById('dash-compare-hint');
  const elSimList = document.getElementById('dash-sim-list');
  const btnCompare = document.getElementById('btn-compare-sims');
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

  function simsCollection() {
    return db.collection('users').doc(currentUid).collection('simulations');
  }

  function formatDate(ts) {
    if (!ts || !ts.toDate) return '';
    return ts.toDate().toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Résumé bref sous le nom : emprunteur(s), durée, taux — pour reconnaître une
  // simulation dans la liste sans avoir à l'ouvrir.
  function simSummary(state) {
    if (!state) return '';
    const isSolo = state.mode === 'solo';
    const noms = isSolo
      ? (state.nomA || 'Emprunteur')
      : [state.nomA, state.nomB].filter(Boolean).join(' & ');
    const parts = [];
    if (noms) parts.push(noms);
    if (state.dureeChoisie) parts.push(state.dureeChoisie + ' ans');
    if (typeof state.tauxPct === 'number') parts.push(state.tauxPct.toFixed(2) + ' %');
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
    if (!currentSimId || baselineStateJson === null) {
      elCurrentBar.hidden = true;
      return;
    }
    const dirty = JSON.stringify(captureState()) !== baselineStateJson;
    elCurrentBar.hidden = !dirty;
  }

  // Écoute déléguée plutôt qu'un hook par champ : ce simulateur a trop de points de
  // mutation (rate-simulation.js, budget.js, ownership.js, cost.js…) pour tous les
  // intercepter individuellement sans risquer d'en oublier un. Le léger débounce absorbe
  // la frappe rapide et le glissement du curseur de taux (événements "input").
  let dirtyCheckTimer = null;
  function scheduleDirtyCheck() {
    if (!currentSimId) return;
    clearTimeout(dirtyCheckTimer);
    dirtyCheckTimer = setTimeout(updateDirtyState, 150);
  }
  document.addEventListener('input', scheduleDirtyCheck);
  document.addEventListener('change', scheduleDirtyCheck);
  document.addEventListener('click', scheduleDirtyCheck);

  // Comparaison de simulations (accessible uniquement ici, depuis "Mes simulations") : chaque
  // ligne a une case à cocher, le bouton "Comparer" ouvre compare.js pour 2 à 4 sélectionnées.
  // La sélection est conservée dans un Set indépendant du rendu, pour survivre aux rafraîchissements
  // temps réel de la liste (onSnapshot) tant que les simulations cochées existent toujours.
  const MAX_COMPARE = 4;
  const selectedCompareIds = new Set();
  let latestDocsById = new Map();

  function updateCompareButton() {
    const n = selectedCompareIds.size;
    btnCompare.textContent = n > 0 ? 'Comparer (' + n + ')' : 'Comparer';
    btnCompare.disabled = n < 2;
  }

  function renderSimList(docs) {
    elEmpty.hidden = docs.length > 0;
    if (elCompareHint) elCompareHint.hidden = docs.length < 2;
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
      row.innerHTML =
        '<label class="dash-sim-row__check" title="Sélectionner pour comparer">' +
          '<input type="checkbox" class="chk-compare">' +
        '</label>' +
        '<div class="dash-sim-row__info">' +
          '<p class="dash-sim-row__name"></p>' +
          '<p class="dash-sim-row__meta"></p>' +
          '<p class="dash-sim-row__date">Mis à jour le ' + formatDate(data.updatedAt) + '</p>' +
        '</div>' +
        '<div class="dash-sim-row__actions">' +
          '<button type="button" class="btn-secondary" data-action="load">Consulter</button>' +
          '<button type="button" class="btn-secondary" data-action="rename">Renommer</button>' +
          '<button type="button" class="btn-secondary" data-action="duplicate">Dupliquer</button>' +
          '<button type="button" class="btn-danger" data-action="delete">Supprimer</button>' +
        '</div>';
      row.querySelector('.dash-sim-row__name').textContent = data.nom || 'Sans nom';
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
      });

      row.querySelector('[data-action="load"]').addEventListener('click', () => {
        applyState(data.state);
        currentSimId = doc.id;
        // Repris via captureState() (pas data.state telle quelle) : les simulations plus
        // anciennes n'ont pas tous les champs récents (chèques-repas…), applyState() leur
        // donne une valeur par défaut, il faut comparer sur la même forme normalisée.
        baselineStateJson = JSON.stringify(captureState());
        elCurrentName.textContent = data.nom || 'Sans nom';
        loadCurrentBar();
        // Consultation d'abord : récapitulatif en lecture seule, façon document.
        // Le crayon dans sa barre d'outils bascule vers l'édition complète (switchTab).
        if (typeof window.openRecap === 'function') {
          window.openRecap(data.nom, formatDate(data.updatedAt), () => switchTab('taux'));
        } else {
          switchTab('taux');
        }
      });

      row.querySelector('[data-action="rename"]').addEventListener('click', async () => {
        const nouveauNom = await showPrompt({
          title: 'Renommer la simulation',
          defaultValue: data.nom || '',
          placeholder: 'Nom de la simulation',
          confirmText: 'Renommer'
        });
        if (nouveauNom === null || nouveauNom === '') return;
        simsCollection().doc(doc.id).update({ nom: nouveauNom });
        if (currentSimId === doc.id) elCurrentName.textContent = nouveauNom;
      });

      // Duplique la simulation : nouveau document Firestore avec le même state (donc
      // toutes les données déjà remplies), pour repartir d'une base au lieu de tout
      // ressaisir. Ne charge pas la copie automatiquement — elle apparaît juste en tête
      // de liste (updatedAt le plus récent), l'original reste ouvert si c'est lui qui l'était.
      row.querySelector('[data-action="duplicate"]').addEventListener('click', async () => {
        const nomCopie = await showPrompt({
          title: 'Dupliquer la simulation',
          defaultValue: (data.nom || 'Sans nom') + ' (copie)',
          placeholder: 'Nom de la copie',
          confirmText: 'Dupliquer'
        });
        if (nomCopie === null || nomCopie === '') return;
        const now = firebase.firestore.FieldValue.serverTimestamp();
        simsCollection().add({
          nom: nomCopie,
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
          message: '« ' + (data.nom || 'Cette simulation') + ' » sera définitivement supprimée. Cette action est irréversible.',
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
  }

  btnCompare.addEventListener('click', () => {
    const entries = Array.from(selectedCompareIds)
      .map(id => ({ id, nom: latestDocsById.get(id) && latestDocsById.get(id).nom, state: latestDocsById.get(id) && latestDocsById.get(id).state }))
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
  async function createNewSimulation(promptTitle) {
    const nom = await showPrompt({
      title: promptTitle,
      defaultValue: 'Ma simulation',
      placeholder: 'Nom de la simulation',
      confirmText: 'Créer'
    });
    if (nom === null || nom === '') return;
    // Figé avant l'écriture Firestore : si l'utilisateur modifie un champ pendant l'aller-retour
    // réseau, la comparaison doit se faire contre ce qui a vraiment été enregistré, pas contre
    // un instantané repris après coup qui inclurait ce changement à tort.
    const snapshot = captureState();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    simsCollection().add({
      nom: nom,
      state: snapshot,
      createdAt: now,
      updatedAt: now
    }).then((docRef) => {
      currentSimId = docRef.id;
      baselineStateJson = JSON.stringify(snapshot);
      elCurrentName.textContent = nom;
      loadCurrentBar();
    }).catch((err) => {
      alert('Impossible d’enregistrer la simulation : ' + err.message);
    });
  }

  btnNewSim.addEventListener('click', () => createNewSimulation('Nouvelle simulation'));
  btnSaveNewSim.addEventListener('click', () => createNewSimulation('Enregistrer ma simulation'));

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
    simsCollection().doc(currentSimId).update({
      state: snapshot,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      baselineStateJson = JSON.stringify(snapshot);
      flashSaveSuccess();
    }).catch((err) => {
      alert('Impossible d’enregistrer les modifications : ' + err.message);
    });
  });

  btnUnloadCurrent.addEventListener('click', unloadCurrentSim);
})();
