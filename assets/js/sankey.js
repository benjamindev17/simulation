/* ==========================================================================
   Diagramme de Sankey — rendu SVG pur, sans dépendance externe.
   Générique : on lui passe des nœuds répartis en colonnes et des liens
   valués, il renvoie le SVG. Aucune connaissance du domaine ici (c'est
   budget.js qui construit les données).

   Hypothèses : graphe orienté en couches, sans cycle. Les nœuds d'une même
   colonne sont empilés dans l'ordre où ils arrivent dans data.nodes — c'est
   donc à l'appelant de les fournir dans l'ordre vertical souhaité, ce qui
   évite l'essentiel des croisements de rubans.
   ========================================================================== */
(function () {
  const NODE_W = 11;      // largeur des barres
  const GAP = 16;         // espace vertical entre deux nœuds d'une colonne
  const LABEL_PAD = 7;
  const CHAR_W = 6.2;     // largeur moyenne d'un caractère à 11px en Helvetica gras

  // Éclaircit une couleur hex vers le blanc (t = 0 → inchangée, 1 → blanc).
  function lighten(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const m = (c) => Math.round(c + (255 - c) * t);
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * @param {{nodes:Array, links:Array}} data
   *   nodes : { id, label, col, color }
   *   links : { source, target, value, color? }
   * @param {{width:number, padRight:number, fmt:function, title:string}} opts
   * @returns {string} markup SVG (chaîne vide si rien à tracer)
   */
  window.buildSankeySvg = function (data, opts) {
    opts = opts || {};
    const fmt = opts.fmt || ((v) => Math.round(v));
    const width = opts.width || 620;      // largeur du corps du diagramme (barres)
    const padL = 6;

    const byId = new Map(data.nodes.map(n => [n.id, Object.assign({}, n, { in: 0, out: 0 })]));
    const links = data.links
      .filter(l => l.value > 0 && byId.has(l.source) && byId.has(l.target))
      .map(l => Object.assign({}, l));
    if (!links.length) return '';

    links.forEach(l => {
      byId.get(l.source).out += l.value;
      byId.get(l.target).in += l.value;
    });
    // Un nœud vaut le plus grand de ses deux flux (entrant / sortant).
    const nodes = [...byId.values()]
      .map(n => Object.assign(n, { value: Math.max(n.in, n.out) }))
      .filter(n => n.value > 0);
    if (!nodes.length) return '';

    const maxCol = Math.max(...nodes.map(n => n.col));
    const cols = [];
    for (let c = 0; c <= maxCol; c++) cols[c] = nodes.filter(n => n.col === c);

    // Hauteur : dictée par la colonne qui compte le plus de nœuds, pour que les
    // libellés (18px de haut) ne se chevauchent jamais.
    const maxCount = Math.max(...cols.map(c => c.length));
    const height = Math.max(300, maxCount * 34);

    // Une seule échelle pour toutes les colonnes, sinon les rubans ne se
    // raccorderaient pas d'un bout à l'autre. On la cale sur la colonne la plus
    // chargée, en lui réservant ses écarts.
    let scale = Infinity;
    cols.forEach(c => {
      const total = c.reduce((s, n) => s + n.value, 0);
      const avail = height - (c.length - 1) * GAP;
      if (total > 0 && avail > 0) scale = Math.min(scale, avail / total);
    });
    if (!isFinite(scale) || scale <= 0) return '';

    // Position : X réparti régulièrement, chaque colonne centrée verticalement.
    const colX = (c) => (maxCol === 0 ? 0 : c * (width - NODE_W) / maxCol);
    cols.forEach(c => {
      const used = c.reduce((s, n) => s + n.value * scale, 0) + (c.length - 1) * GAP;
      let y = (height - used) / 2;
      c.forEach(n => {
        n.x = colX(n.col);
        n.y = y;
        n.h = n.value * scale;
        y += n.h + GAP;
      });
    });

    // Empilement des rubans sur chaque nœud. Deux passes distinctes (sorties
    // puis entrées) : les décalages doivent suivre l'ordre trié de CHAQUE côté,
    // pas l'ordre de parcours global des liens.
    const outBy = new Map(), inBy = new Map();
    links.forEach(l => {
      if (!outBy.has(l.source)) outBy.set(l.source, []);
      if (!inBy.has(l.target)) inBy.set(l.target, []);
      outBy.get(l.source).push(l);
      inBy.get(l.target).push(l);
    });
    // Ordonner par position verticale de l'autre extrémité limite les croisements.
    outBy.forEach((arr, id) => {
      arr.sort((a, b) => byId.get(a.target).y - byId.get(b.target).y);
      let off = byId.get(id).y;
      arr.forEach(l => { l.y0 = off; off += l.value * scale; });
    });
    inBy.forEach((arr, id) => {
      arr.sort((a, b) => byId.get(a.source).y - byId.get(b.source).y);
      let off = byId.get(id).y;
      arr.forEach(l => { l.y1 = off; off += l.value * scale; });
    });

    let ribbons = '';
    links.forEach(l => {
      const s = byId.get(l.source), t = byId.get(l.target);
      const th = l.value * scale;
      const x0 = s.x + NODE_W, x1 = t.x;
      const xm = (x0 + x1) / 2;
      ribbons +=
        '<path d="M' + x0 + ',' + l.y0 +
        'C' + xm + ',' + l.y0 + ' ' + xm + ',' + l.y1 + ' ' + x1 + ',' + l.y1 +
        'L' + x1 + ',' + (l.y1 + th) +
        'C' + xm + ',' + (l.y1 + th) + ' ' + xm + ',' + (l.y0 + th) + ' ' + x0 + ',' + (l.y0 + th) +
        'Z" fill="' + (l.color || t.color) + '" opacity="0.38"/>';
    });

    // Libellés toujours à droite de la barre, sur un fond blanc translucide pour
    // rester lisibles par-dessus les rubans.
    let bars = '', labels = '';
    nodes.forEach(n => {
      bars += '<rect x="' + n.x + '" y="' + n.y + '" width="' + NODE_W +
        '" height="' + Math.max(n.h, 1.5) + '" fill="' + n.color + '" rx="1"/>';

      const txt = n.label + ' · ' + fmt(n.value);
      const tx = n.x + NODE_W + LABEL_PAD;
      const cy = n.y + n.h / 2;
      labels +=
        '<rect x="' + (tx - 4) + '" y="' + (cy - 9) + '" width="' + (txt.length * CHAR_W + 8) +
        '" height="18" rx="2" fill="#ffffff" opacity="0.82"/>' +
        '<text x="' + tx + '" y="' + (cy + 4) + '" font-size="11" font-weight="700" ' +
        'fill="#1a0b2e">' + esc(txt) + '</text>';
    });

    // Marge droite calée sur le libellé le plus long de la dernière colonne :
    // les postes de dépense sont saisis librement, leur longueur est imprévisible.
    const padR = Math.max(opts.padRight || 120, NODE_W + LABEL_PAD + 12 +
      Math.max(...cols[maxCol].map(n => (n.label + ' · ' + fmt(n.value)).length * CHAR_W)));

    const w = width + padL + padR, h = height + 20;
    return '<svg viewBox="' + (-padL) + ' -10 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + esc(opts.title || 'Répartition mensuelle du revenu') + '">' +
      ribbons + bars + labels + '</svg>';
  };

  window.sankeyLighten = lighten;
})();
