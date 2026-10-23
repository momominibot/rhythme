/* Rhythme body log (Jamie, 23 Oct 2026: "I need to add basal temperature, oral contraceptives reminder, pregnancy test,
 * vaginal discharge (put what i have built for ovaria the illustration), sex and sex drive"). The choices and the words
 * for the symptom day, kept here so tools/test-core.js can read every one of them. Nothing here stores anything: the
 * day's answers go into that day's symptom entry (discharge, sex, drive, pregTest), and a basal temperature into its
 * own temperature entry, through ovu-store.js. None of it is a diagnosis; the notes say when something is worth a
 * clinician's look, and the urgent signs after a positive test say to get care now.
 *
 * The discharge pictures are Ovaria's reference photographs (ovaria-web public/discharge, carried over as 256 px WebP),
 * with Ovaria's own descriptive notes. Colour and texture are the point of the comparison, so they are photographs. */
(function (root) {
  'use strict';
  var DISCHARGE = [
    { id: 'clear', label: 'Clear', note: 'Stretchy and clear is typical around the fertile days.' },
    { id: 'creamy', label: 'Creamy', note: 'White or cream and lotion-like. Common through much of the cycle.' },
    { id: 'clumpy', label: 'Clumpy', note: 'Thick and like cottage cheese, often with itching. Worth a clinician’s look.', flag: true },
    { id: 'yellow', label: 'Yellow', note: 'Pale yellow can be normal. Deep yellow with a smell is worth checking.' },
    { id: 'green', label: 'Green', note: 'Green is not typical. Worth raising with a clinician.', flag: true },
    { id: 'grey', label: 'Grey', note: 'Grey, especially with a strong smell, is worth raising with a clinician.', flag: true },
    { id: 'brown', label: 'Brown', note: 'Usually old blood, at the start or end of a period.' },
    { id: 'pink', label: 'Pink', note: 'Light spotting mixed with discharge. Common mid-cycle or before a period.' }
  ];
  var DISCHARGE_CARE = 'With itching, burning, a strong smell, pelvic pain or a fever, see a doctor or sexual health clinic. Bleeding after sex or after the menopause is always worth checking.';
  var SEX = [{ id: 'none', label: 'Didn’t have sex' }, { id: 'protected', label: 'Protected sex' }, { id: 'unprotected', label: 'Unprotected sex' }];
  var DRIVE = [{ id: 'low', label: 'Low' }, { id: 'usual', label: 'Usual' }, { id: 'high', label: 'High' }];
  var PREG = [{ id: 'negative', label: 'Negative' }, { id: 'faint', label: 'Faint line' }, { id: 'positive', label: 'Positive' }];
  var COPY = {
    sexPrivate: 'Only on this phone, and in your backup if cloud backup is on. Never shared, never on the team’s dashboard.',
    faint: 'A faint line usually still means pregnant. Test again in two or three days with your first wee of the morning.',
    positive: 'A positive home test usually means you are pregnant. Book a check with a doctor or clinic to confirm it and talk about what comes next.',
    urgent: 'Get urgent care now (your local emergency number or nearest emergency department) if you have sharp pain low on one side, pain at the tip of your shoulder, heavy bleeding, or you feel faint.',
    negative: 'If your period still has not come in a week, test again. A test taken very early can miss a pregnancy.',
    pill: 'Same time each day. If you miss a pill, follow the leaflet that came with your pill or ask a pharmacist.',
    basal: 'Taken the moment you wake, before getting up, with a basal thermometer. It shows here as it is; Rhythme never uses it to predict fertile days.'
  };
  function discharge(id) { return DISCHARGE.filter(function (d) { return d.id === id; })[0] || null; }
  /* a basal temperature as typed: 35.0 to 38.5 °C (or 95 to 101.3 °F, converted), two decimals, or null */
  function basalC(v, unit) {
    var x = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); if (String(v).trim() === '' || !isFinite(x)) return null;
    if (unit === 'F' || (unit !== 'C' && x > 50)) x = (x - 32) * 5 / 9;
    x = Math.round(x * 100) / 100; return x >= 35 && x <= 38.5 ? x : null;
  }
  /* the day's own answers, cleaned to known values; anything else is left out */
  function clean(d) {
    d = d || {}; var o = {};
    if (discharge(d.discharge)) o.discharge = d.discharge;
    if (SEX.some(function (s) { return s.id === d.sex; })) o.sex = d.sex;
    if (DRIVE.some(function (s) { return s.id === d.drive; })) o.drive = d.drive;
    if (PREG.some(function (s) { return s.id === d.pregTest; })) o.pregTest = d.pregTest;
    return o;
  }
  /* the care lines a day's answers bring up, most urgent first */
  function notes(d) {
    d = d || {}; var out = [];
    if (d.pregTest === 'positive') out.push({ level: 'urgent', text: COPY.positive + ' ' + COPY.urgent });
    else if (d.pregTest === 'faint') out.push({ level: 'info', text: COPY.faint + ' ' + COPY.urgent });
    else if (d.pregTest === 'negative') out.push({ level: 'info', text: COPY.negative });
    var dc = discharge(d.discharge); if (dc && dc.flag) out.push({ level: 'watch', text: dc.note + ' ' + DISCHARGE_CARE });
    return out;
  }
  root.OvuBodyLog = { DISCHARGE: DISCHARGE, DISCHARGE_CARE: DISCHARGE_CARE, SEX: SEX, DRIVE: DRIVE, PREG: PREG, COPY: COPY, discharge: discharge, basalC: basalC, clean: clean, notes: notes };
})(typeof window !== 'undefined' ? window : this);
