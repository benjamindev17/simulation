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
  const elSimList = document.getElementById('dash-sim-list');
  const btnSignIn = document.getElementById('btn-google-signin');
  const btnSignOut = document.getElementById('btn-signout');
  const btnNewSim = document.getElementById('btn-new-simulation');
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

  function simsCollection() {
    return db.collection('users').doc(currentUid).collection('simulations');
  }

  function formatDate(ts) {
    if (!ts || !ts.toDate) return '';
    return ts.toDate().toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function unloadCurrentSim() {
    currentSimId = null;
    elCurrentBar.hidden = true;
  }

  function loadCurrentBar() {
    elCurrentBar.hidden = false;
  }

  function renderSimList(docs) {
    elEmpty.hidden = docs.length > 0;
    elSimList.innerHTML = '';
    docs.forEach((doc) => {
      const data = doc.data();
      const row = document.createElement('div');
      row.className = 'dash-sim-row';
      row.innerHTML =
        '<div class="dash-sim-row__info">' +
          '<p class="dash-sim-row__name"></p>' +
          '<p class="dash-sim-row__date">Mis à jour le ' + formatDate(data.updatedAt) + '</p>' +
        '</div>' +
        '<div class="dash-sim-row__actions">' +
          '<button type="button" class="btn-secondary" data-action="load">Charger</button>' +
          '<button type="button" class="btn-secondary" data-action="rename">Renommer</button>' +
          '<button type="button" class="btn-danger" data-action="delete">Supprimer</button>' +
        '</div>';
      row.querySelector('.dash-sim-row__name').textContent = data.nom || 'Sans nom';

      row.querySelector('[data-action="load"]').addEventListener('click', () => {
        applyState(data.state);
        currentSimId = doc.id;
        elCurrentName.textContent = data.nom || 'Sans nom';
        loadCurrentBar();
        switchTab('taux');
      });

      row.querySelector('[data-action="rename"]').addEventListener('click', () => {
        const nouveauNom = prompt('Nouveau nom de la simulation :', data.nom || '');
        if (nouveauNom === null || nouveauNom.trim() === '') return;
        simsCollection().doc(doc.id).update({ nom: nouveauNom.trim() });
        if (currentSimId === doc.id) elCurrentName.textContent = nouveauNom.trim();
      });

      row.querySelector('[data-action="delete"]').addEventListener('click', () => {
        if (!confirm('Supprimer définitivement « ' + (data.nom || 'cette simulation') + ' » ?')) return;
        simsCollection().doc(doc.id).delete();
        if (currentSimId === doc.id) unloadCurrentSim();
      });

      elSimList.appendChild(row);
    });
  }

  function watchSimulations() {
    unsubscribeList = simsCollection().orderBy('updatedAt', 'desc').onSnapshot(
      (snapshot) => renderSimList(snapshot.docs),
      (err) => console.warn('Lecture des simulations impossible :', err.message)
    );
  }

  function showSignedOut() {
    elSignedOut.hidden = false;
    elSignedIn.hidden = true;
    unloadCurrentSim();
    if (unsubscribeList) { unsubscribeList(); unsubscribeList = null; }
  }

  function showSignedIn(user) {
    elSignedOut.hidden = true;
    elSignedIn.hidden = false;
    elAvatar.src = user.photoURL || '';
    elName.textContent = user.displayName || 'Compte Google';
    elEmail.textContent = user.email || '';
    currentUid = user.uid;
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

  btnSignOut.addEventListener('click', () => {
    auth.signOut();
  });

  btnNewSim.addEventListener('click', () => {
    const nom = prompt('Nom de cette simulation :', 'Ma simulation');
    if (nom === null || nom.trim() === '') return;
    const now = firebase.firestore.FieldValue.serverTimestamp();
    simsCollection().add({
      nom: nom.trim(),
      state: captureState(),
      createdAt: now,
      updatedAt: now
    }).then((docRef) => {
      currentSimId = docRef.id;
      elCurrentName.textContent = nom.trim();
      loadCurrentBar();
    }).catch((err) => {
      alert('Impossible d’enregistrer la simulation : ' + err.message);
    });
  });

  btnSaveCurrent.addEventListener('click', () => {
    if (!currentSimId) return;
    simsCollection().doc(currentSimId).update({
      state: captureState(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch((err) => {
      alert('Impossible d’enregistrer les modifications : ' + err.message);
    });
  });

  btnUnloadCurrent.addEventListener('click', unloadCurrentSim);
})();
