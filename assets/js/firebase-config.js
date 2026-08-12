/* ==========================================================================
   Configuration Firebase — À REMPLIR par toi.
   Va dans la console Firebase (console.firebase.google.com) → Paramètres du
   projet (⚙️) → tes applications → application Web → « Config » → SDK
   d'installation et configuration → copie l'objet firebaseConfig ici,
   à la place de celui-ci (avec les vraies valeurs, pas les "REMPLACE_MOI").
   ========================================================================== */
const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
};

// Devient false automatiquement dès que tu as remplacé les valeurs ci-dessus.
const FIREBASE_CONFIGURED = firebaseConfig.apiKey !== "REMPLACE_MOI";
