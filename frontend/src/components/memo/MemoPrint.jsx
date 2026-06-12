import { STRINGS, fmtDateTime } from './MemoPrefs';

// Print layout for a consultant memo — always white paper / dark text with
// the ORIGINAL document's teal (#156B67), in the given language. Rendered
// inside a hidden mount (shown only by @media print) and reused on screen
// by the معاينة (preview) modal.
// `attachmentPreviews` (from buildAttachmentPreviews) appends the uploaded
// files' rendered pages as annex pages after the signature block.
export default function MemoPrint({ memo, lang = 'ar', attachmentPreviews = [] }) {
  const t = key => STRINGS[lang][key] ?? STRINGS.ar[key] ?? key;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const today = fmtDateTime(new Date(), lang);

  const attachments = [
    ...(memo.attachments || []).filter(a => a && a.trim() !== ''),
    ...(memo.attachmentFiles || []).map(f => f?.name).filter(Boolean),
  ];

  const sections = [
    {
      title: t('secTopic'),
      dt: memo.topicDateTime,
      body: (
        <>
          <p><strong>{t('topicName')}:</strong> {memo.topicName || ''}</p>
          <p><strong>{t('source')}:</strong> {memo.source || ''}</p>
        </>
      ),
    },
    {
      title: t('secAttachments'),
      dt: memo.attachmentsDateTime,
      body: attachments.length
        ? <ul className="cmxp-attachments">{attachments.map((a, i) => <li key={i}>— {a}</li>)}</ul>
        : null,
    },
    { title: t('secPresentation'), dt: memo.presentationDateTime, body: textBody(memo.presentation) },
    { title: t('secExec'),         dt: memo.executiveCommitteeDateTime, body: textBody(memo.executiveCommittee) },
    { title: t('secPresRec'),      dt: memo.presidentRecommendationDateTime, body: textBody(memo.presidentRecommendation) },
    { title: t('secJoint'),        dt: memo.jointCouncilDateTime, body: textBody(memo.jointCouncil) },
  ];

  return (
    <div className="cmxp-sheet" dir={dir} lang={lang}>
      {/* Watermark */}
      <img className="cmxp-watermark" src="/arab-board-logo.png" alt="" aria-hidden="true" />

      {/* Letterhead: lines (start side) — logo (center) — memo meta (end side) */}
      <header className="cmxp-letterhead">
        <div className="cmxp-lh-lines">
          <div className="cmxp-lh-bold">{t('lh1')}</div>
          <div className="cmxp-lh-bold">{t('lh2')}</div>
          <div>{t('lh3')}</div>
        </div>
        <img className="cmxp-lh-logo" src="/arab-board-logo.png" alt={t('lh1')} />
        <div className="cmxp-lh-meta">
          <div><span className="cmxp-lh-meta-label">{t('memoNumberLabel')}</span> {memo.memoNumber || '—'}</div>
          <div><span className="cmxp-lh-meta-label">{t('printDateLabel')}</span> {today}</div>
        </div>
      </header>
      <div className="cmxp-rule" />

      <h1 className="cmxp-title">{t('pageTitle')}</h1>

      {sections.map((s, i) => (
        <section className="cmxp-section" key={i}>
          <div className="cmxp-bar">{s.title}</div>
          <div className="cmxp-body">{s.body}</div>
          <div className="cmxp-dt">{t('dateTime')} {fmtDateTime(s.dt, lang)}</div>
        </section>
      ))}

      {/* Signature block */}
      <div className="cmxp-signatures">
        <div className="cmxp-sign-col">
          <div className="cmxp-sign-title">{t('signSecretary')}</div>
          <div className="cmxp-sign-line" />
          <div className="cmxp-sign-label">{t('signNameLabel')}</div>
        </div>
        <div className="cmxp-sign-col">
          <div className="cmxp-sign-title">{t('stamp')}</div>
          <div className="cmxp-sign-line" />
          <div className="cmxp-sign-label">&nbsp;</div>
        </div>
      </div>

      {/* Annexes — the uploaded attachments' actual content */}
      {attachmentPreviews.filter(p => p.pages.length > 0).map((p, i) => (
        <section className="cmxp-annex" key={i}>
          <div className="cmxp-bar cmxp-annex-title">{t('attachment')} {i + 1}: {p.name}</div>
          {p.pages.map((src, j) => (
            <img className="cmxp-annex-page" src={src} alt={`${p.name} — ${j + 1}`} key={j} />
          ))}
          {p.truncated && <div className="cmxp-annex-note">{t('annexTruncated')}</div>}
        </section>
      ))}

      {/* Repeating footer (position:fixed repeats on every printed page) */}
      <footer className="cmxp-footer">{t('footerOrg')}</footer>
    </div>
  );
}

function textBody(text) {
  if (!text || !text.trim()) return null;
  return text.split('\n').map((line, i) => <p key={i}>{line || ' '}</p>);
}
