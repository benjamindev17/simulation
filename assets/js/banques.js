/* ==========================================================================
   Banques — registre des établissements proposés, repère visuel, et titre
   normalisé d'une simulation (banque · montant emprunté · taux).

   IMPORTANT sur les « logos » : les logos officiels sont des marques déposées
   qu'on ne peut ni redistribuer ni reconstituer de mémoire de façon fidèle.
   On affiche donc une pastille aux initiales, dans la couleur de l'enseigne :
   le repère est immédiat, sans prétendre être le logo officiel. Pour utiliser
   les vrais, déposer un fichier dans assets/banques/<id>.svg et renseigner le
   champ `logo` ci-dessous — banqueBadge() l'affichera à la place de la pastille.
   ========================================================================== */
(function () {
  const BANQUES = [
    { id: 'crelan',  nom: 'Crelan',  couleur: '#00953a', initiales: 'CR',  logo: null },
    { id: 'kbc',     nom: 'KBC',     couleur: '#004b93', initiales: 'KBC', logo: null },
    { id: 'cph',     nom: 'CPH',     couleur: '#0f7baa', initiales: 'CPH', logo: null },
    { id: 'belfius', nom: 'Belfius', couleur: '#c4161c', initiales: 'BF',  logo: null },
    { id: 'beobank', nom: 'Beobank', couleur: '#e2001a', initiales: 'BEO', logo: null }
  ];
  const parId = new Map(BANQUES.map(b => [b.id, b]));

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.BANQUES = BANQUES;
  window.banqueParId = function (id) { return parId.get(id) || null; };

  /** Pastille (ou logo si un fichier a été fourni). taille : 'sm' pour la version compacte. */
  window.banqueBadge = function (id, taille) {
    const b = parId.get(id);
    const cls = 'bank-badge' + (taille === 'sm' ? ' bank-badge--sm' : '');
    if (!b) return '<span class="' + cls + ' bank-badge--vide" aria-hidden="true">?</span>';
    if (b.logo) {
      return '<img class="' + cls + ' bank-badge--img" src="' + esc(b.logo) + '" alt="' + esc(b.nom) + '">';
    }
    return '<span class="' + cls + '" style="background:' + b.couleur + '" aria-hidden="true">' +
      esc(b.initiales) + '</span>';
  };

  /** Titre normalisé d'une simulation, calculé depuis son état : jamais saisi à la main. */
  window.titreSimulation = function (s) {
    if (!s) return 'Simulation';
    const b = parId.get(s.banqueId);
    const montant = (typeof coutsDeState === 'function') ? coutsDeState(s).montant : 0;
    const taux = (typeof s.tauxPct === 'number')
      ? s.tauxPct.toFixed(2).replace('.', ',') + ' %'
      : '— %';
    return (b ? b.nom : 'Banque non précisée') + ' · ' + fmt(Math.round(montant)) + ' · ' + taux;
  };
})();
