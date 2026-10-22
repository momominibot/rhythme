/* Rhythme PDF writer: a small, dependency-free PDF 1.4 generator for text documents
 * (the clinician summary). Runs on the phone; nothing leaves the device. Standard
 * Helvetica with WinAnsi encoding, so no font is embedded and files stay tiny.
 * Blocks: h1, h2, p, small, li (bullet), kv (label and value), rule, gap, page. */
(function (root) {
  'use strict';
  /* Helvetica AFM widths for ASCII 32 to 126 (per 1000 em); bold is scaled from these */
  var W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  /* characters outside ASCII that WinAnsi can show, mapped to their byte */
  var WIN = { '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95, '·': 0xb7, 'é': 0xe9, 'è': 0xe8, 'à': 0xe0, 'ü': 0xfc, 'ö': 0xf6, 'ä': 0xe4, '°': 0xb0, '½': 0xbd, '×': 0xd7, ' ': 0x20, '\u00ae': 0xae, '\u00a9': 0xa9, '±': 0xb1 };
  var PAGE = { w: 595.28, h: 841.89, margin: 48 };
  var STYLE = {
    h1: { size: 19, bold: true, lead: 1.25, before: 0, after: 6 },
    h2: { size: 12.5, bold: true, lead: 1.3, before: 10, after: 3 },
    p: { size: 10.5, bold: false, lead: 1.38, before: 0, after: 4 },
    small: { size: 8.5, bold: false, lead: 1.35, before: 0, after: 3, grey: true },
    li: { size: 10.5, bold: false, lead: 1.38, before: 0, after: 2, indent: 14, bullet: '•' },
    kv: { size: 10.5, bold: false, lead: 1.38, before: 0, after: 2 }
  };

  function toWin(s) {
    var out = '';
    s = String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ');
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], c = s.charCodeAt(i);
      if (c >= 32 && c < 127) out += ch;
      else if (WIN[ch] !== undefined) out += String.fromCharCode(WIN[ch]);
      else if (c >= 160 && c < 256) out += ch;
      else out += '?';
    }
    return out;
  }
  function width(s, size, bold) {
    var w = 0;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); w += c >= 32 && c < 127 ? W[c - 32] : 556; }
    return w / 1000 * size * (bold ? 1.06 : 1);
  }
  function wrap(s, size, bold, maxW) {
    var words = s.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (width(t, size, bold) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
      while (width(cur, size, bold) > maxW && cur.length > 1) { /* a single very long token */
        var cut = cur.length - 1; while (cut > 1 && width(cur.slice(0, cut), size, bold) > maxW) cut--;
        lines.push(cur.slice(0, cut)); cur = cur.slice(cut);
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function pdfStr(s) { return '(' + s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '').replace(/\n/g, ' ') + ')'; }
  function n2(x) { return (Math.round(x * 100) / 100).toString(); }

  /* blocks: [{t:'h1'|'h2'|'p'|'small'|'li'|'kv'|'rule'|'gap'|'page', text, label}] */
  function make(doc) {
    var blocks = doc.blocks || [], footer = toWin(doc.footer || ''), title = toWin(doc.title || 'Rhythme');
    var x0 = PAGE.margin, maxW = PAGE.w - 2 * PAGE.margin, top = PAGE.h - PAGE.margin, bottom = PAGE.margin + 22;
    var pages = [], ops = [], y = top;
    function colour(grey) { return grey ? '0.42 0.37 0.5 rg\n' : '0.17 0.13 0.26 rg\n'; }
    function newPage() { if (ops.length) pages.push(ops.join('')); ops = []; y = top; }
    function need(h) { if (y - h < bottom) newPage(); }
    function text(s, x, size, bold, grey) { ops.push('BT\n' + colour(grey) + '/' + (bold ? 'F2' : 'F1') + ' ' + n2(size) + ' Tf\n' + n2(x) + ' ' + n2(y) + ' Td\n' + pdfStr(s) + ' Tj\nET\n'); }
    newPage();
    blocks.forEach(function (b) {
      if (b.t === 'page') { newPage(); return; }
      if (b.t === 'gap') { y -= b.size || 6; return; }
      if (b.t === 'rule') { need(8); y -= 4; ops.push('0.78 0.72 0.88 RG 0.8 w ' + n2(x0) + ' ' + n2(y) + ' m ' + n2(x0 + maxW) + ' ' + n2(y) + ' l S\n'); y -= 6; return; }
      var st = STYLE[b.t] || STYLE.p, size = st.size, lh = size * st.lead, indent = st.indent || 0;
      y -= st.before;
      if (b.t === 'kv') {
        var label = toWin(b.label || ''), lw = Math.min(maxW * 0.34, width(label, size, true) + 10);
        var lines = wrap(toWin(b.text), size, false, maxW - lw);
        need(lh * lines.length + st.after);
        y -= lh; text(label, x0, size, true, false); text(lines[0] || '', x0 + lw, size, false, false);
        for (var k = 1; k < lines.length; k++) { need(lh); y -= lh; text(lines[k], x0 + lw, size, false, false); }
        y -= st.after; return;
      }
      var ls = wrap(toWin(b.text), size, st.bold, maxW - indent);
      if (b.t === 'h2') need(lh * (ls.length + 2));
      ls.forEach(function (line, i) {
        need(lh); y -= lh;
        if (i === 0 && st.bullet) text(toWin(st.bullet), x0 + 3, size, false, false);
        text(line, x0 + indent, size, st.bold, st.grey);
      });
      y -= st.after;
    });
    if (ops.length) pages.push(ops.join(''));
    /* footer on every page */
    var total = pages.length;
    pages = pages.map(function (p, i) {
      var f = footer + (footer ? '  ·  ' : '') + 'Page ' + (i + 1) + ' of ' + total;
      f = toWin(f);
      return p + 'BT\n' + colour(true) + '/F1 8 Tf\n' + n2(x0) + ' ' + n2(PAGE.margin - 4) + ' Td\n' + pdfStr(f) + ' Tj\nET\n';
    });
    /* assemble objects: 1 catalog, 2 pages, 3 F1, 4 F2, then page+content pairs */
    var objs = [];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    var kids = []; for (var i = 0; i < total; i++) kids.push((5 + i * 2) + ' 0 R');
    objs.push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + total + ' >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    pages.forEach(function (content, i) {
      var pn = 5 + i * 2, cn = pn + 1;
      objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n2(PAGE.w) + ' ' + n2(PAGE.h) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cn + ' 0 R >>');
      objs.push('<< /Length ' + byteLen(content) + ' >>\nstream\n' + content + 'endstream');
    });
    var out = '%PDF-1.4\n%âãÏÓ\n', offsets = [];
    objs.forEach(function (o, i) { offsets.push(byteLen(out)); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = byteLen(out);
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach(function (off) { out += ('0000000000' + off).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info << /Title ' + pdfStr(title) + ' /Producer (Rhythme) >> >>\nstartxref\n' + xref + '\n%%EOF\n';
    return { text: out, bytes: toBytes(out), pages: total };
  }
  /* every character here is a single byte (WinAnsi), so length in bytes equals length in chars */
  function byteLen(s) { return s.length; }
  function toBytes(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; }
  function blob(doc) { var m = make(doc); return typeof Blob === 'function' ? new Blob([m.bytes], { type: 'application/pdf' }) : m.bytes; }

  root.OvuPdf = { make: make, blob: blob, wrap: wrap, width: width, toWin: toWin };
})(typeof window !== 'undefined' ? window : this);
