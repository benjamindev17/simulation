/* ==========================================================================
   Modale générique — remplace prompt()/confirm() natifs par un composant
   soigné, cohérent avec le reste de l'app. Deux fonctions globales,
   promesses :
     showPrompt({ title, defaultValue, placeholder, confirmText }) -> string|null
     showConfirm({ title, message, confirmText, danger }) -> boolean
   null / false = annulé (Échap, clic hors de la carte, bouton Annuler).
   ========================================================================== */
(function () {
  const overlay = document.getElementById('modal-overlay');
  const elTitle = document.getElementById('modal-title');
  const elMessage = document.getElementById('modal-message');
  const elInputWrap = document.getElementById('modal-input-wrap');
  const elInput = document.getElementById('modal-input');
  const btnCancel = document.getElementById('modal-cancel');
  const btnConfirm = document.getElementById('modal-confirm');
  if (!overlay) return;

  let resolveFn = null;
  let isPromptMode = false;

  function open() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  function finish(value) {
    close();
    const r = resolveFn;
    resolveFn = null;
    if (r) r(value);
  }

  btnCancel.addEventListener('click', () => finish(isPromptMode ? null : false));
  btnConfirm.addEventListener('click', () => finish(isPromptMode ? elInput.value.trim() : true));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(isPromptMode ? null : false); });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') finish(isPromptMode ? null : false);
    if (e.key === 'Enter' && isPromptMode) finish(elInput.value.trim());
  });

  window.showPrompt = function ({ title, defaultValue = '', placeholder = '', confirmText = 'Confirmer' }) {
    return new Promise((resolve) => {
      isPromptMode = true;
      resolveFn = resolve;
      elTitle.textContent = title;
      elMessage.hidden = true;
      elInputWrap.hidden = false;
      elInput.value = defaultValue;
      elInput.placeholder = placeholder;
      btnConfirm.textContent = confirmText;
      btnConfirm.className = 'btn-moss';
      btnCancel.textContent = 'Annuler';
      open();
      requestAnimationFrame(() => { elInput.focus(); elInput.select(); });
    });
  };

  window.showConfirm = function ({ title, message, confirmText = 'Confirmer', cancelText = 'Annuler', danger = false }) {
    return new Promise((resolve) => {
      isPromptMode = false;
      resolveFn = resolve;
      elTitle.textContent = title;
      elMessage.textContent = message;
      elMessage.hidden = false;
      elInputWrap.hidden = true;
      btnConfirm.textContent = confirmText;
      btnConfirm.className = danger ? 'btn-danger' : 'btn-moss';
      btnCancel.textContent = cancelText;
      open();
      requestAnimationFrame(() => { btnConfirm.focus(); });
    });
  };
})();
