/* ==========================================================================
   Utilitaires partagés
   Chargés en premier : formatage et helpers réutilisés par les deux onglets.
   ========================================================================== */

/** Formate un nombre en euros (fr-FR, sans décimales). Espace insécable avant € pour éviter que « € » passe à la ligne. */
function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €';
}

/** Formate un pourcentage avec deux décimales. */
function fmtPct(n) {
  return n.toFixed(2) + '%';
}

/** Taux périodique mensuel équivalent à un taux annuel (en %), par équivalence actuarielle
    — (1+i)^(1/12) − 1 — et non par simple division /12. C'est la convention qu'utilisent les
    outils bancaires belges pour convertir un taux annuel en mensualité ; l'écart avec taux/12
    est faible (quelques euros/mois) mais visible dès qu'on compare à la mensualité annoncée
    par une banque. */
function tauxMensuel(tauxAnnuelPct) {
  return Math.pow(1 + tauxAnnuelPct / 100, 1 / 12) - 1;
}

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

/** Renvoie la date (jj mois aaaa) située n mois après aujourd'hui. */
function formatDateDansNMois(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.getDate() + ' ' + MOIS_FR[d.getMonth()] + ' ' + d.getFullYear();
}
