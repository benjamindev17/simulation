/* ==========================================================================
   Utilitaires partagés
   Chargés en premier : formatage et helpers réutilisés par les deux onglets.
   ========================================================================== */

/** Formate un nombre en euros (fr-FR, sans décimales). */
function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €';
}

/** Formate un pourcentage avec deux décimales. */
function fmtPct(n) {
  return n.toFixed(2) + '%';
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
