/* ==========================================================================
   Configuration Firebase — À REMPLIR par toi.
   Va dans la console Firebase (console.firebase.google.com) → Paramètres du
   projet (⚙️) → tes applications → application Web → « Config » → SDK
   d'installation et configuration → copie l'objet firebaseConfig ici,
   à la place de celui-ci (avec les vraies valeurs, pas les "REMPLACE_MOI").
   ========================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyBR20qIBPdYjwvQyuyXDrF-0yTbpYqFak8",
  authDomain: "simulation-3c0c3.firebaseapp.com",
  projectId: "simulation-3c0c3",
  storageBucket: "simulation-3c0c3.firebasestorage.app",
  messagingSenderId: "945779456372",
  appId: "1:945779456372:web:7ea8264a8396da27371421",
  measurementId: "G-1EP0N0N4FZ"
};

// Devient false automatiquement dès que tu as remplacé les valeurs ci-dessus.
const FIREBASE_CONFIGURED = firebaseConfig.apiKey !== "REMPLACE_MOI";
