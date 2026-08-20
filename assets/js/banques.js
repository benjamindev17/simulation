/* ==========================================================================
   Banques — registre des établissements proposés, repère visuel, et titre
   normalisé d'une simulation (banque · montant emprunté · taux).

   LOGOS — chaque banque pointe vers assets/banques/<id>.svg (ou .png). Dès qu'un
   fichier est présent à ce chemin, il s'affiche automatiquement. Tant qu'il manque,
   l'image se retire d'elle-même (onerror) et la pastille aux initiales, dans la
   couleur de l'enseigne, sert de repère de repli. Voir assets/banques/README.md.
   ========================================================================== */
(function () {
  const BANQUES = [
    { id: 'crelan',  nom: 'Crelan',  couleur: '#00953a', initiales: 'CR',  logo: 'assets/banques/crelan.png' },
    { id: 'kbc',     nom: 'KBC',     couleur: '#004b93', initiales: 'KBC', logo: 'assets/banques/kbc.png' },
    { id: 'cph',     nom: 'CPH',     couleur: '#0f7baa', initiales: 'CPH', logo: 'assets/banques/cph.png' },
    { id: 'belfius', nom: 'Belfius', couleur: '#c4161c', initiales: 'BF',  logo: 'assets/banques/belfius.png' },
    { id: 'beobank', nom: 'Beobank', couleur: '#e2001a', initiales: 'BEO', logo: 'assets/banques/beobank.png' }
  ];
  const parId = new Map(BANQUES.map(b => [b.id, b]));

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.BANQUES = BANQUES;
  window.banqueParId = function (id) { return parId.get(id) || null; };

  /**
   * Repère visuel d'une banque. Le vrai logo est posé PAR-DESSUS la pastille aux
   * initiales : s'il est absent, `onerror` le retire et la pastille reste visible.
   * Aucune configuration à changer le jour où les fichiers sont ajoutés.
   * @param {string} id  identifiant de banque
   * @param {string} [taille] 'sm' pour la version compacte
   */
  window.banqueBadge = function (id, taille) {
    const b = parId.get(id);
    const cls = 'bank-badge' + (taille === 'sm' ? ' bank-badge--sm' : '');
    if (!b) return '<span class="' + cls + ' bank-badge--vide" aria-hidden="true">?</span>';
    const logo = b.logo
      ? '<img class="bank-badge__img" src="' + esc(b.logo) + '" alt="' + esc(b.nom) +
        '" onerror="this.remove()">'
      : '';
    return '<span class="' + cls + '" style="background:' + b.couleur + '" title="' + esc(b.nom) + '">' +
      '<span class="bank-badge__txt" aria-hidden="true">' + esc(b.initiales) + '</span>' + logo +
      '</span>';
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
