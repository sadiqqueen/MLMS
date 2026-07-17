// Generates a printable, docx-style version of a completed WPBA evaluation
// (Mini-CEX / CbD / DOPS) and opens it in a new window for printing.
//
// Used by both the supervisor screen and the trainee Grades page, so it accepts
// either a saved Evaluation document or a live-form preview object of the shape:
//   { evaluationType, traineeName, assessorName, date, totalScore,
//     formData: { header, domains, times, supervisionLevel, globalRating, feedback } }

import { getForm, scoreMeta, SCORE_SCALE, MAX_SCORE } from '../data/evalForms';

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Average of the rated (non-N/A) numeric domain scores.
function computeGrade(form, fd) {
  const vals = [];
  (form?.domains || []).forEach(d => {
    const v = fd?.domains?.[d.key];
    if (v !== undefined && v !== '' && v !== 'na') {
      const n = Number(v);
      if (!Number.isNaN(n)) vals.push(n);
    }
  });
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return { sum, count: vals.length, avg: sum / vals.length, max: vals.length * MAX_SCORE };
}

function headerTable(form, fd) {
  const cells = (form.header || [])
    .map(f => `
      <tr>
        <td class="lbl">${esc(f.label)}</td>
        <td class="val" dir="auto">${esc(fd?.header?.[f.key]) || '&nbsp;'}</td>
      </tr>`)
    .join('');
  return `<table class="kv"><tbody>${cells}</tbody></table>`;
}

function competencyTable(form, fd) {
  const head = `
    <tr>
      <th class="dom">Competency / Domain</th>
      ${SCORE_SCALE.map(s => `<th class="sc">${esc(s.short)}</th>`).join('')}
    </tr>`;

  const rows = (form.domains || []).map(d => {
    const sel = fd?.domains?.[d.key];
    const cells = SCORE_SCALE.map(s => {
      const on = String(sel) === String(s.value);
      return `<td class="sc">${on ? '☑' : '☐'}</td>`;
    }).join('');
    return `
      <tr>
        <td class="dom">
          <span class="dom-title">${esc(d.label)}</span>
          ${d.hint ? `<span class="dom-hint">${esc(d.hint)}</span>` : ''}
        </td>
        ${cells}
      </tr>`;
  }).join('');

  return `<table class="grid"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function feedbackBlock(form, fd) {
  return (form.feedback || []).map(f => `
    <div class="fb">
      <div class="fb-lbl">${esc(f.label)}</div>
      <div class="fb-txt" dir="auto">${esc(fd?.feedback?.[f.key]) || '&nbsp;'}</div>
    </div>`).join('');
}

export function printEvaluation(ev, ctx = {}) {
  const type = ev.evaluationType || ev.type || '';
  const form = getForm(type);
  const fd   = ev.formData || {};

  const traineeName  = ev.traineeId?.name || ev.student?.name || ctx.traineeName || '—';
  const assessorName = ev.supervisorId?.name || ev.doctor?.name || ctx.assessorName || '—';
  const when         = ev.date || ev.createdAt || ctx.date || new Date();
  const signedTime   = ev.sentToTraineeAt || ev.createdAt || when;

  const grade = computeGrade(form, fd);
  const times = (form?.times || [])
    .map(t => `${esc(t.label)}: <strong>${esc(fd?.times?.[t.key]) || '—'}</strong>`)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const title = form ? `${form.title} — ${form.fullName}` : (type || 'Evaluation');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2a37; margin: 28px; font-size: 12px; }
  h1 { font-size: 18px; color: #1A3A5C; margin: 0 0 2px; }
  .sub { color: #5b6b7b; font-size: 12px; margin-bottom: 14px; }
  .idrow { display: flex; gap: 24px; flex-wrap: wrap; background: #E8F4FA; border: 1px solid #cfe3ee;
           border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
  .idrow div span { display:block; }
  .id-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #1A3A5C; font-weight: 700; }
  .id-val { font-size: 13px; font-weight: 600; color: #1f2a37; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
  td, th { border: 1px solid #999; padding: 5px 8px; vertical-align: top; }
  .kv .lbl { background: #E8F4FA; color: #1A3A5C; font-weight: 700; width: 32%; }
  .grid th { background: #1A3A5C; color: #fff; font-weight: 700; text-align: center; }
  .grid th.dom { text-align: left; }
  .grid .dom { width: 46%; }
  .grid .sc { text-align: center; width: 9%; font-size: 14px; }
  .dom-title { font-weight: 600; display: block; }
  .dom-hint { color: #6b7280; font-size: 10.5px; display: block; margin-top: 2px; }
  .section { font-size: 12px; font-weight: 700; color: #1A3A5C; text-transform: uppercase;
             letter-spacing: .04em; margin: 16px 0 6px; }
  .pill { display:inline-block; border:1px solid #1A3A5C; border-radius: 14px; padding: 3px 12px;
          font-weight: 700; color: #1A3A5C; }
  .grade-box { border: 2px solid #1A3A5C; border-radius: 6px; padding: 10px 14px; display:flex;
               justify-content: space-between; align-items:center; margin-bottom: 14px; }
  .grade-num { font-size: 26px; font-weight: 800; color: #1A3A5C; }
  .fb { border: 1px solid #d7dde3; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
  .fb-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5b6b7b; font-weight: 700; }
  .fb-txt { font-size: 12.5px; white-space: pre-line; min-height: 16px; }
  .sign { display:flex; gap: 30px; margin-top: 22px; }
  .sign > div { flex: 1; }
  .sign-line { border-top: 1px solid #1f2a37; margin-top: 34px; padding-top: 4px; font-size: 11px; color: #5b6b7b; }
  .signed { font-style: italic; font-weight: 600; color: #1A3A5C; }
  .legend { font-size: 10.5px; color: #6b7280; margin: -8px 0 14px; }
  @media print { body { margin: 12mm; } .noprint { display: none; } button { display:none; } }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <div class="sub">Workplace-Based Assessment</div>

  <div class="idrow">
    <div><span class="id-lbl">Trainee</span><span class="id-val" dir="auto">${esc(traineeName)}</span></div>
    <div><span class="id-lbl">Assessor</span><span class="id-val" dir="auto">${esc(assessorName)}</span></div>
    <div><span class="id-lbl">Date of Evaluation</span><span class="id-val">${esc(fmtDate(when))}</span></div>
  </div>

  ${form ? headerTable(form, fd) : ''}

  <div class="section">Competency Ratings</div>
  ${form ? competencyTable(form, fd) : '<p>No structured data.</p>'}
  <div class="legend">Scale: ${SCORE_SCALE.map(s => esc(s.label)).join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>

  ${fd.supervisionLevel ? `
    <div class="section">${esc(form?.supervision?.label || 'Level of Supervised Practice')}</div>
    <div><span class="pill">${esc(fd.supervisionLevel)}</span></div>` : ''}

  <div class="section">Outcome</div>
  <div class="grade-box">
    <div>
      <div style="font-size:11px;color:#5b6b7b;text-transform:uppercase;letter-spacing:.04em;font-weight:700;">${esc(form?.overall?.label || 'Overall Rating')}</div>
      <div style="font-size:16px;font-weight:700;color:#1A3A5C;margin-top:2px;">${esc(ev.grade || fd.globalRating || '—')}</div>
      ${times ? `<div style="font-size:11px;color:#5b6b7b;margin-top:6px;">${times}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="grade-num">${grade ? Math.round(grade.avg * 10) / 10 : '—'}</div>
      <div style="font-size:11px;color:#5b6b7b;">avg score / ${MAX_SCORE}${grade ? ` &nbsp;(total ${grade.sum} / ${grade.max})` : ''}</div>
    </div>
  </div>

  <div class="section">Feedback</div>
  ${form ? feedbackBlock(form, fd) : ''}

  <div class="sign">
    <div>
      <div class="sign-line">
        <span class="signed">Electronically signed: ${esc(assessorName)}</span><br>
        Assessor &middot; ${esc(fmtDateTime(signedTime))}
      </div>
    </div>
    <div>
      <div class="sign-line">Trainee Signature (Acknowledgment) &middot; Date</div>
    </div>
  </div>

  <script>
    window.onload = function () { window.focus(); window.print(); };
  </script>
</body></html>`;

  // Desktop path: a real popup shows a print preview and works reliably.
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }

  // Mobile fallback: iOS Safari and many mobile browsers block the blank-URL
  // popup (or open it as a background tab where print() never surfaces), so the
  // popup path fails silently. Print via a hidden same-page iframe instead.
  printViaIframe(html);
}

// Renders the same document inside an off-screen iframe and drives print from
// the parent. The inline auto-print <script> is stripped for this path so print
// is triggered once, by us, after the iframe has loaded (avoids a double dialog).
function printViaIframe(html) {
  const doc = html.replace(
    /<script>[\s\S]*?<\/script>/i,
    ''
  );

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    // Remove the iframe once printing is done (or after a safety timeout for
    // browsers that never fire afterprint, e.g. some mobile Safari versions).
    win.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);
    win.focus();
    win.print();
  };

  const idoc = iframe.contentWindow?.document;
  if (!idoc) { cleanup(); return; }
  idoc.open();
  idoc.write(doc);
  idoc.close();
}
