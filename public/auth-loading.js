/**
 * Full-screen loading overlay for auth flows. Runs the task in parallel with a minimum
 * visible duration so the spinner stays up for at least 5 seconds (or until the task finishes,
 * whichever is longer).
 */
(function () {
  const MIN_MS = 5000;

  function overlayEl() {
    return document.getElementById('authFlowLoadingOverlay');
  }

  function messageEl() {
    return document.getElementById('authFlowLoadingMessage');
  }

  window.AuthFlowLoading = {
    show(message) {
      const o = overlayEl();
      const m = messageEl();
      if (m) m.textContent = message;
      if (o) {
        o.classList.add('is-visible');
        o.setAttribute('aria-hidden', 'false');
      }
      document.body.classList.add('pm-auth-loading-active');
    },

    hide() {
      const o = overlayEl();
      if (o) {
        o.classList.remove('is-visible');
        o.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('pm-auth-loading-active');
    },

    /**
     * @param {string} message
     * @param {() => Promise<unknown>} task
     * @returns {Promise<unknown>} task result
     */
    async run(message, task) {
      this.show(message);
      try {
        const [, result] = await Promise.all([
          new Promise(r => setTimeout(r, MIN_MS)),
          task()
        ]);
        return result;
      } finally {
        this.hide();
      }
    }
  };
})();
