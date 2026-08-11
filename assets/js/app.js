/* ==========================================================================
   Amorçage de l'application — navigation par onglets
   ========================================================================== */

const tabButtons = {
  appart: document.getElementById('tabBtnAppart'),
  taux: document.getElementById('tabBtnTaux'),
  cout: document.getElementById('tabBtnCout'),
  etf: document.getElementById('tabBtnEtf')
};
const tabPanels = {
  appart: document.getElementById('tab-appart'),
  taux: document.getElementById('tab-taux'),
  cout: document.getElementById('tab-cout'),
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
