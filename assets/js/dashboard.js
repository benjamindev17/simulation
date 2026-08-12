/* ==========================================================================
   Onglet « Mes simulations » — étape 1 : authentification Google uniquement.
   La sauvegarde/chargement réelle des simulations (Firestore) arrive dans
   une prochaine étape. Ici : connexion, déconnexion, affichage du compte.
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
  const btnSignIn = document.getElementById('btn-google-signin');
  const btnSignOut = document.getElementById('btn-signout');
  const btnNewSim = document.getElementById('btn-new-simulation');
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

  function showSignedOut() {
    elSignedOut.hidden = false;
    elSignedIn.hidden = true;
  }

  function showSignedIn(user) {
    elSignedOut.hidden = true;
    elSignedIn.hidden = false;
    elAvatar.src = user.photoURL || '';
    elName.textContent = user.displayName || 'Compte Google';
    elEmail.textContent = user.email || '';
    // Pas encore de vraies simulations sauvegardées (étape suivante) → état vide.
    elEmpty.hidden = false;
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

  if (btnNewSim) {
    btnNewSim.addEventListener('click', () => {
      alert('La création et la sauvegarde de simulations arrivent dans une prochaine étape — pour l’instant, cet onglet vérifie juste la connexion.');
    });
  }
})();
