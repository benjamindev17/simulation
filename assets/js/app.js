/* ==========================================================================
   Amorçage de l'application — navigation par onglets
   ========================================================================== */

const tabButtons = {
  appart: document.getElementById('tabBtnAppart'),
  taux: document.getElementById('tabBtnTaux'),
  etf: document.getElementById('tabBtnEtf')
};
const tabPanels = {
  appart: document.getElementById('tab-appart'),
  taux: document.getElementById('tab-taux'),
  etf: document.getElementById('tab-etf')
};

function switchTab(name) {
  Object.keys(tabButtons).forEach(k => {
    tabButtons[k].classList.toggle('active', k === name);
    tabPanels[k].classList.toggle('active', k === name);
  });
}

Object.keys(tabButtons).forEach(name => {
  tabButtons[name].addEventListener('click', () => switchTab(name));
});
