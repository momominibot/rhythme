/* Luna's local educational guide. No model calls, account entitlements, health
   inference or persistent conversation. Legacy ovuluna_luna is left untouched. */
(function (root) {
  'use strict';
  const INTRO = 'I’m Luna, your offline guide. I can explain the cycle illustration, ovarian reserve and camera pulse research. These are prepared educational answers, not an AI consultation. I do not read your saved health records. This conversation stays in memory until you clear it or leave this page.';
  const state = { open: false, messages: [] };
  const topics = [
    { label: 'Ovarian reserve', pattern: /ovarian|fertility|amh|menopause|卵巢|生育/i, source: 'ovarian-age-concept', link: 'ovarian-age.html', text: 'Ovarian reserve refers to egg quantity, which is different from egg quality. AMH and antral follicle count can inform expected response to ovarian stimulation; they do not establish your ovarian age or, by themselves, predict natural conception. Rhythme has no validated ovarian-age conversion formula. Keep actual lab results with their dates and units and discuss fertility questions with a qualified clinician.' },
    { label: 'Cycle illustration', pattern: /cycle|phase|luteal|ovulat|period|hormone|月经|排卵/i, source: 'cycle-teaching-model', link: 'home.html', text: 'The ring is a 28-day teaching illustration. Menstruation overlaps the follicular phase; ovulation is followed by the luteal phase. Timing varies between people and cycles. Moving the ring does not identify your current phase, confirm ovulation, measure hormones or calculate a fertile window. It does not set a fasting or treatment plan.' },
    { label: 'Camera pulse', pattern: /pulse|ppg|hrv|heart|stress|fasting|肝气|心率|压力/i, source: 'camera-ppg-study-scope', link: 'ppg.html', text: 'Fingertip camera signals can be used to estimate pulse timing. Published studies tested specific phone algorithms and recording protocols; they do not validate Rhythme’s camera check. A reading here cannot diagnose stress or a TCM pattern, confirm ovulation or determine a fasting limit. Treat the camera feature as experimental and review medical concerns with a clinician.' }
  ];
  function guide(text) {
    if (/privacy|data|save|cloud|account|premium|隐私/i.test(text)) return { text: 'The offline guide sends no messages to a server and does not save this conversation. Other Rhythme forms can save records in this browser or app installation. Account sign-in, premium access, cloud backup and biometric app unlock are not available in this build. Open Privacy & local data to review, export or choose stored items for deletion.', link: 'privacy.html' };
    const match = topics.find(topic => topic.pattern.test(text));
    return match || { text: 'This offline guide has prepared explanations of ovarian reserve, the cycle illustration and camera pulse research. It cannot assess symptoms, diagnose a condition, recommend doses or personalize diet, exercise or fasting. Choose one of the topics below or explore the app. For a health concern, consult a qualified clinician; for an emergency, contact local emergency services.', link: 'home.html' };
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(id, className, text) {
    const node = element('button', className, text); node.type = 'button'; if (id) node.id = id; return node;
  }
  function mascot() { const img = element('img'); img.src = 'assets/mascot/luna-mascot.png'; img.alt = ''; return img; }
  function render() {
    const box = document.getElementById('lunaMessages'); if (!box) return;
    box.replaceChildren();
    state.messages.forEach(message => {
      const bubble = element('div', 'luna-msg luna-' + message.role);
      bubble.append(element('p', '', message.text));
      if (message.source) {
        // Only our curated topic IDs reach this branch; database text is never HTML.
        const entry = root.EVIDENCE_DB && root.EVIDENCE_DB[message.source];
        if (entry && entry.verification && entry.verification.status === 'verified') {
          const source = button('', 'qi luna-source', 'i');
          source.dataset.evidence = message.source;
          source.setAttribute('aria-label', 'Read sources and limitations for this explanation');
          bubble.append(source, element('span', 'luna-source-label', 'Sources & limits'));
        } else bubble.append(element('span', 'luna-source-label', 'Source review unavailable on this page.'));
      }
      if (message.link) {
        const link = element('a', 'luna-read-more', message.link === 'privacy.html' ? 'Privacy & local data' : 'Open the app guide');
        link.href = message.link; bubble.append(link);
      }
      box.append(bubble);
    });
    box.scrollTop = box.scrollHeight;
  }
  function add(role, answer) {
    state.messages.push({ role: role, text: answer.text, source: answer.source, link: answer.link });
    state.messages = state.messages.slice(-20); render();
  }
  function setOpen(open) {
    state.open = open;
    const panel = document.getElementById('lunaPanel'), fab = document.getElementById('lunaBtn');
    if (!panel) return;
    panel.hidden = !open; panel.classList.toggle('open', open); fab.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!state.messages.length) add('bot', { text: INTRO });
      // Let people read or choose a topic before opening the phone keyboard.
      document.getElementById('lunaClose').focus({ preventScroll: true });
    } else {
      document.getElementById('lunaInput').blur();
      fab.focus({ preventScroll: true });
    }
  }
  function send() {
    const input = document.getElementById('lunaInput'), text = input.value.trim();
    if (!text) return;
    if (text.length > 500) { document.getElementById('lunaHelp').textContent = 'Use 500 characters or fewer.'; return; }
    add('user', { text: text }); input.value = ''; add('bot', guide(text));
  }
  function boot() {
    if (document.getElementById('lunaBtn')) return;
    const fab = button('lunaBtn', '', ''); fab.append(mascot());
    fab.setAttribute('aria-label', 'Open Luna offline guide'); fab.setAttribute('aria-controls', 'lunaPanel'); fab.setAttribute('aria-expanded', 'false');
    const panel = element('section'); panel.id = 'lunaPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'Luna offline educational guide');
    const header = element('div', 'luna-header'), info = element('div', 'luna-info');
    info.append(element('div', 'luna-name', 'Luna'), element('div', 'luna-status', 'Offline educational guide'));
    const close = button('lunaClose', 'luna-close', '×'); close.setAttribute('aria-label', 'Close Luna guide');
    header.append(mascot(), info, close); panel.append(header);
    const notice = element('p', 'luna-credits', 'Online AI is unavailable: an authenticated service connection has not been configured.'); panel.append(notice);
    const messages = element('div', 'luna-messages'); messages.id = 'lunaMessages'; messages.setAttribute('role', 'log'); messages.setAttribute('aria-label', 'Guide conversation'); messages.setAttribute('aria-live', 'polite'); panel.append(messages);
    const suggestions = element('div', 'luna-suggestions');
    topics.forEach(topic => { const chip = button('', 'luna-chip', topic.label); chip.addEventListener('click', () => { add('user', { text: topic.label }); add('bot', topic); }); suggestions.append(chip); }); panel.append(suggestions);
    const form = element('form', 'luna-input-row'), input = element('input', 'luna-input'); input.id = 'lunaInput'; input.type = 'text'; input.maxLength = 500; input.autocomplete = 'off'; input.placeholder = 'Choose a topic or type a question'; input.setAttribute('aria-label', 'Question for the offline guide'); input.setAttribute('aria-describedby', 'lunaHelp');
    const submit = button('lunaSend', 'luna-send', '↑'); submit.type = 'submit'; submit.setAttribute('aria-label', 'Ask offline guide');
    form.append(input, submit); form.addEventListener('submit', event => { event.preventDefault(); if (!event.isComposing) send(); }); panel.append(form);
    const footer = element('div', 'luna-disclaimer'), help = element('p', '', 'Prepared education, not a diagnosis. Not saved or sent.'); help.id = 'lunaHelp';
    const clear = button('lunaClear', 'luna-chip', 'Clear this conversation'); clear.addEventListener('click', () => { state.messages = []; input.value = ''; add('bot', { text: INTRO }); input.focus(); });
    const privacy = element('a', 'luna-read-more', 'Privacy & local data'); privacy.href = 'privacy.html'; footer.append(help, clear, privacy); panel.append(footer);
    document.body.append(fab, panel);
    fab.addEventListener('click', () => setOpen(!state.open)); close.addEventListener('click', () => setOpen(false));
    panel.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); setOpen(false); } });
    root.addEventListener('pagehide', () => { state.messages = []; input.value = ''; panel.hidden = true; state.open = false; panel.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); messages.replaceChildren(); });
  }
  // Keep the old integration surface, but never return a prepared answer as an
  // authenticated model result. No token is read from browser storage.
  root.OvumindLuna = Object.freeze({
    ask: function (_question, callback) { if (typeof callback === 'function') callback(null, 'authentication_required: Online Luna is unavailable. Use the offline educational guide.'); },
    getCredits: function () { return null; },
    getCapabilities: function () { return Object.freeze({ mode: 'offline-guide', online: false, persistentConversation: false, auth: false, premium: false }); },
    open: function () { setOpen(true); }, close: function () { setOpen(false); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
