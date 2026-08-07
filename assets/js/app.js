/* ==========================================================================
   Amorçage de l'application — navigation par onglets
   ========================================================================== */

const tabButtons = {
  appart: document.getElementById('tabBtnAppart'),
  taux: document.getElementById('tabBtnTaux')
};
const tabPanels = {
  appart: document.getElementById('tab-appart'),
  taux: document.getElementById('tab-taux')
};

function switchTab(name) {
  Object.keys(tabButtons).forEach(k => {
    tabButtons[k].classList.toggle('active', k === name);
    tabPanels[k].classList.toggle('active', k === name);
  });
}

tabButtons.appart.addEventListener('click', () => switchTab('appart'));
tabButtons.taux.addEventListener('click', () => switchTab('taux'));
