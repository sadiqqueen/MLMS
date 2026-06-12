import { STRINGS, fmtDate } from './MemoPrefs';

// Print layout for a consultant memo — always white paper / dark text with
// the ORIGINAL document's teal (#156B67), in the given language. Rendered
// inside a hidden mount (shown only by @media print) and reused on screen
// by the معاينة (preview) modal.
// `attachmentPreviews` (from buildAttachmentPreviews) renders the uploaded
// files' content inside the المرفقات section — below the list, above العرض.
export default function MemoPrint({ memo, lang = 'ar', attachmentPreviews = [] }) {
  const t = key => STRINGS[lang][key] ?? STRINGS.ar[key] ?? key;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  // تاريخ الطباعة always renders in English (Latin digits), even in Arabic mode
  const today = fmtDate(new Date(), 'en');

  const attachments = [
    ...(memo.attachments || []).filter(a => a && a.trim() !== ''),
    ...(memo.attachmentFiles || []).map(f => f?.name).filter(Boolean),
  ];

  const attachmentsBody = (
    <>
      {attachments.length > 0 && (
        <ul className="cmxp-attachments">{attachments.map((a, i) => <li key={i}>— {a}</li>)}</ul>
      )}
      {attachmentPreviews.map((p, i) => (
        <div className="cmxp-annex" key={i}>
          <div className="cmxp-annex-title">{t('attachment')} {i + 1}: {p.name}</div>
          {p.kind === 'docx' ? (
            <div className="cmxp-annex-doc" dangerouslySetInnerHTML={{ __html: p.html || '' }} />
          ) : (
            p.pages.map((src, j) => (
              <img className="cmxp-annex-page" src={src} alt={`${p.name} — ${j + 1}`} key={j} />
            ))
          )}
          {p.kind === 'other' && <div className="cmxp-annex-note">{t('notRenderable')}</div>}
          {p.truncated && <div className="cmxp-annex-note">{t('annexTruncated')}</div>}
        </div>
      ))}
    </>
  );

  const sections = [
    {
      title: t('secTopic'),
      dt: memo.topicDateTime,
      body: (
        <>
          <p><strong>{t('topicName')}:</strong> {memo.topicName || ''}</p>
          <p><strong>{t('source')}:</strong> {memo.source || ''}</p>
          <p><strong>{t('councilLabel')}:</strong> <span dir="rtl" lang="ar">{memo.councilName || ''}</span></p>
        </>
      ),
    },
    {
      title: t('secAttachments'),
      dt: memo.attachmentsDateTime,
      body: attachmentsBody,
      // annex content can span multiple pages — don't force it onto one
      className: 'cmxp-section-flow',
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
        <section className={'cmxp-section' + (s.className ? ' ' + s.className : '')} key={i}>
          <div className="cmxp-bar">{s.title}</div>
          <div className="cmxp-body">{s.body}</div>
          <div className="cmxp-dt">{t('dateTime')} {fmtDate(s.dt, lang)}</div>
        </section>
      ))}

      {/* Closing row — right: أمينة سر المجلس العلمي الاستشاري, left: التوقيع.
          Nothing above or below it (no lines, no repeating footer). */}
      <div className="cmxp-signatures">
        <span>{t('footerRight')}</span>
        <span>{t('footerLeft')}</span>
      </div>
    </div>
  );
}

function textBody(text) {
  if (!text || !text.trim()) return null;
  return text.split('\n').map((line, i) => <p key={i}>{line || ' '}</p>);
}
