/* ==========================================================================
   Amorçage de l'application — navigation par onglets, menu déroulant mobile
   et préférence d'affichage de l'onglet Placement ETF.
   ========================================================================== */

const tabButtons = {
  appart: document.getElementById('tabBtnAppart'),
  taux: document.getElementById('tabBtnTaux'),
  cout: document.getElementById('tabBtnCout'),
  etf: document.getElementById('tabBtnEtf'),
  dashboard: document.getElementById('tabBtnDashboard')
};
const tabPanels = {
  appart: document.getElementById('tab-appart'),
  taux: document.getElementById('tab-taux'),
  cout: document.getElementById('tab-cout'),
  etf: document.getElementById('tab-etf'),
  dashboard: document.getElementById('tab-dashboard')
};

// Libellés du menu déroulant mobile — celui de "appart" est mis à jour depuis
// rate-simulation.js (applyMode) car il dépend du mode solo/duo.
const dropdownLabels = {
  taux: 'Simulation taux',
  appart: 'Répartition appartement',
  cout: 'Coût total annuel',
  etf: 'Placement ETF'
};

let activeTab = 'taux';
const elDureeFloat = document.getElementById('duree-float');

function switchTab(name) {
  activeTab = name;
  Object.keys(tabButtons).forEach(k => {
    tabButtons[k].classList.toggle('active', k === name);
    tabPanels[k].classList.toggle('active', k === name);
  });
  // Le sélecteur de durée du crédit n'a pas de sens sur "Mes simulations" (pas de simu affichée).
  if (elDureeFloat) elDureeFloat.hidden = name === 'dashboard';
  syncDropdown();
  closeDropdown();
}

Object.keys(tabButtons).forEach(name => {
  tabButtons[name].addEventListener('click', () => switchTab(name));
});

/* --- Menu déroulant mobile (remplace la barre d'onglets qui défile horizontalement) --- */
const elDropdown = document.getElementById('tabs-dropdown');
const elDropdownTrigger = document.getElementById('tabs-dropdown-trigger');
const elDropdownLabel = document.getElementById('tabs-dropdown-label');
const elDropdownPanel = document.getElementById('tabs-dropdown-panel');
const dropdownItems = elDropdownPanel ? Array.from(elDropdownPanel.querySelectorAll('.tabs-dropdown__item')) : [];

function syncDropdown() {
  // "dashboard" (Mes simulations) n'a pas d'entrée dans le menu : on garde alors le dernier libellé affiché.
  if (elDropdownLabel && dropdownLabels[activeTab]) elDropdownLabel.textContent = dropdownLabels[activeTab];
  dropdownItems.forEach(item => {
    const isActive = item.dataset.tab === activeTab;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function openDropdown() {
  if (!elDropdown) return;
  elDropdown.classList.add('open');
  elDropdownTrigger.setAttribute('aria-expanded', 'true');
}
function closeDropdown() {
  if (!elDropdown) return;
  elDropdown.classList.remove('open');
  elDropdownTrigger.setAttribute('aria-expanded', 'false');
}

if (elDropdownTrigger) {
  elDropdownTrigger.addEventListener('click', () => {
    if (elDropdown.classList.contains('open')) closeDropdown();
    else openDropdown();
  });
}
dropdownItems.forEach(item => {
  item.addEventListener('click', () => switchTab(item.dataset.tab));
});
document.addEventListener('click', (e) => {
  if (elDropdown && elDropdown.classList.contains('open') && !elDropdown.contains(e.target)) closeDropdown();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elDropdown && elDropdown.classList.contains('open')) closeDropdown();
});

/* --- Préférence : n'afficher l'onglet Placement ETF que si activé depuis "Mes simulations" --- */
const ETF_PREF_KEY = 'pref-show-etf';
const elEtfNavGroup = document.getElementById('tabs-etf-group');
const elEtfDropdownItem = document.getElementById('tabs-dropdown-item-etf');
const elChkPrefEtf = document.getElementById('chk-pref-etf');

function isEtfEnabled() {
  return localStorage.getItem(ETF_PREF_KEY) === '1';
}

function applyEtfVisibility() {
  const enabled = isEtfEnabled();
  // .tabs déclare déjà "display", donc [hidden] serait sans effet ici : on force l'affichage en ligne.
  if (elEtfNavGroup) elEtfNavGroup.style.display = enabled ? '' : 'none';
  if (elEtfDropdownItem) elEtfDropdownItem.style.display = enabled ? '' : 'none';
  if (elChkPrefEtf) elChkPrefEtf.checked = enabled;
  if (!enabled && activeTab === 'etf') switchTab('taux');
}

if (elChkPrefEtf) {
  elChkPrefEtf.addEventListener('change', () => {
    localStorage.setItem(ETF_PREF_KEY, elChkPrefEtf.checked ? '1' : '0');
    applyEtfVisibility();
  });
}

syncDropdown();
applyEtfVisibility();
