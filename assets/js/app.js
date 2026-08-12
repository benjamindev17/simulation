/* ==========================================================================
   Amorçage de l'application — navigation par onglets
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

function switchTab(name) {
  Object.keys(tabButtons).forEach(k => {
    tabButtons[k].classList.toggle('active', k === name);
    tabPanels[k].classList.toggle('active', k === name);
  });
}

Object.keys(tabButtons).forEach(name => {
  tabButtons[name].addEventListener('click', () => switchTab(name));
});
