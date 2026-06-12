import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import './ConsultantMemo.css';

// Faithful reproduction of the official Word document
// "استمارة العرض على المجلس العلمي الاستشاري" — text, colors, table
// structure and column split (72% / 28%) must not be altered.

const EMPTY = {
  topicR2: '', topicR3: '', sourceR2: '', sourceR3: '',
  att1R: '', att1L: '', att2R: '', att2L: '',
  presentation: '',
  execR: '', execL: '',
  presR: '', presL: '',
  councilR: '', councilL: '',
};

// The two single-line input rows under each Table-1 header are persisted as
// one string joined with '\n' (the cells themselves can't contain newlines,
// so the join/split round-trips exactly).
function joinCells(a, b) { return b ? `${a}\n${b}` : a; }
function splitCells(s = '') { const [a = '', b = ''] = String(s).split('\n'); return [a, b]; }

function toPayload(f) {
  return {
    topicName:    joinCells(f.topicR2, f.topicR3),
    source:       joinCells(f.sourceR2, f.sourceR3),
    attachments:  [joinCells(f.att1R, f.att1L), joinCells(f.att2R, f.att2L)],
    presentation: f.presentation,
    executiveCommittee:      { right: f.execR,    left: f.execL    },
    presidentRecommendation: { right: f.presR,    left: f.presL    },
    jointCouncil:            { right: f.councilR, left: f.councilL },
  };
}

function fromMemo(m) {
  const [topicR2, topicR3]   = splitCells(m.topicName);
  const [sourceR2, sourceR3] = splitCells(m.source);
  const [att1R, att1L]       = splitCells(m.attachments?.[0]);
  const [att2R, att2L]       = splitCells(m.attachments?.[1]);
  return {
    topicR2, topicR3, sourceR2, sourceR3, att1R, att1L, att2R, att2L,
    presentation: m.presentation || '',
    execR:    m.executiveCommittee?.right      || '', execL:    m.executiveCommittee?.left      || '',
    presR:    m.presidentRecommendation?.right || '', presL:    m.presidentRecommendation?.left || '',
    councilR: m.jointCouncil?.right            || '', councilL: m.jointCouncil?.left            || '',
  };
}

export default function ConsultantMemo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const memoId = searchParams.get('id');

  const [f, setF]           = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    if (!memoId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/consultant-memo/${memoId}`);
        if (!cancelled) setF(fromMemo(res.data));
      } catch {
        if (!cancelled) showToast('تعذر تحميل الاستمارة', 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [memoId]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = toPayload(f);
      if (memoId) {
        await api.put(`/api/consultant-memo/${memoId}`, payload);
      } else {
        const res = await api.post('/api/consultant-memo', payload);
        setSearchParams({ id: res.data._id }, { replace: true });
      }
      showToast('تم الحفظ بنجاح');
    } catch {
      showToast('فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  }

  const set = k => e => setF(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <>
      <Navbar />
      <div className="cm-page">
        <div className="cm-sheet" dir="rtl" lang="ar">

          {/* Letterhead */}
          <header className="cm-letterhead">
            <div className="cm-letterhead-lines">
              <div className="cm-lh-bold">{'المجلس العربي للاختصاصات الصحية'}</div>
              <div className="cm-lh-bold">{'الأمانة العامة'}</div>
              <div>{'المجلس العلمي الاستشاري المشترك'}</div>
            </div>
            <img
              src="/arab-board-logo.png"
              alt="شعار المجلس العربي للاختصاصات الصحية"
              className="cm-logo"
            />
          </header>

          <h1 className="cm-title">{'استمارة العرض على المجلس العلمي الاستشاري'}</h1>

          {/* Table 1 — topic / source / attachments / presentation */}
          <table className="cm-table">
            <colgroup><col className="cm-col-right" /><col className="cm-col-left" /></colgroup>
            <tbody>
              <tr style={{ height: 27 }}>
                <td className="cm-fill cm-s14"><span className="cm-underline">{'اسم  الموضوع'}</span></td>
                <td className="cm-fill cm-s14 cm-center"><span className="cm-underline">{'المصدر'}</span></td>
              </tr>
              <tr style={{ height: 30 }}>
                <td><input className="cm-input" aria-label="اسم الموضوع — السطر الأول" value={f.topicR2} onChange={set('topicR2')} /></td>
                <td><input className="cm-input" aria-label="المصدر — السطر الأول" value={f.sourceR2} onChange={set('sourceR2')} /></td>
              </tr>
              <tr style={{ height: 34 }}>
                <td><input className="cm-input" aria-label="اسم الموضوع — السطر الثاني" value={f.topicR3} onChange={set('topicR3')} /></td>
                <td><input className="cm-input" aria-label="المصدر — السطر الثاني" value={f.sourceR3} onChange={set('sourceR3')} /></td>
              </tr>
              <tr style={{ height: 23 }}>
                <td className="cm-fill cm-s14">{'المرفقات'}</td>
                <td className="cm-fill" />
              </tr>
              <tr style={{ height: 23 }}>
                <td><input className="cm-input" aria-label="المرفقات — السطر الأول" value={f.att1R} onChange={set('att1R')} /></td>
                <td><input className="cm-input" aria-label="المرفقات — السطر الأول (العمود الأيسر)" value={f.att1L} onChange={set('att1L')} /></td>
              </tr>
              <tr style={{ height: 23 }}>
                <td><input className="cm-input" aria-label="المرفقات — السطر الثاني" value={f.att2R} onChange={set('att2R')} /></td>
                <td><input className="cm-input" aria-label="المرفقات — السطر الثاني (العمود الأيسر)" value={f.att2L} onChange={set('att2L')} /></td>
              </tr>
              <tr style={{ height: 29 }}>
                <td className="cm-fill cm-s14" colSpan={2}>{'العرض'}</td>
              </tr>
              <tr>
                <td colSpan={2} className="cm-cell-presentation">
                  <textarea className="cm-area cm-area-presentation" aria-label="العرض" value={f.presentation} onChange={set('presentation')} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* Table 2 — executive committee / president recommendation */}
          <table className="cm-table">
            <colgroup><col className="cm-col-right" /><col className="cm-col-left" /></colgroup>
            <tbody>
              <tr style={{ height: 26 }}>
                <td className="cm-fill cm-s16">{'اللجنة التنفيذية للمجلس العلمي الاستشاري'}</td>
                <td className="cm-fill" />
              </tr>
              <tr style={{ height: 93 }}>
                <td><textarea className="cm-area cm-h-exec" aria-label="اللجنة التنفيذية للمجلس العلمي الاستشاري" value={f.execR} onChange={set('execR')} /></td>
                <td><textarea className="cm-area cm-h-exec" aria-label="اللجنة التنفيذية — العمود الأيسر" value={f.execL} onChange={set('execL')} /></td>
              </tr>
              <tr style={{ height: 25 }}>
                <td className="cm-fill cm-s16" colSpan={2}>{'توصية معالي رئيس المجلس الاستشاري'}</td>
              </tr>
              <tr style={{ height: 50 }}>
                <td><textarea className="cm-area cm-h-pres" aria-label="توصية معالي رئيس المجلس الاستشاري" value={f.presR} onChange={set('presR')} /></td>
                <td><textarea className="cm-area cm-h-pres" aria-label="توصية معالي رئيس المجلس — العمود الأيسر" value={f.presL} onChange={set('presL')} /></td>
              </tr>
              <tr style={{ height: 24 }}>
                <td className="cm-fill" colSpan={2} />
              </tr>
            </tbody>
          </table>

          {/* Table 3 — joint scientific advisory council */}
          <table className="cm-table">
            <colgroup><col className="cm-col-right" /><col className="cm-col-left" /></colgroup>
            <tbody>
              <tr style={{ height: 29 }}>
                <td className="cm-fill cm-s16" colSpan={2}><span className="cm-underline">{'المجلس العلمي الاستشاري  المشترك'}</span></td>
              </tr>
              <tr style={{ height: 120 }}>
                <td><textarea className="cm-area cm-h-council" aria-label="المجلس العلمي الاستشاري المشترك" value={f.councilR} onChange={set('councilR')} /></td>
                <td><textarea className="cm-area cm-h-council" aria-label="المجلس العلمي الاستشاري المشترك — العمود الأيسر" value={f.councilL} onChange={set('councilL')} /></td>
              </tr>
            </tbody>
          </table>

          <footer className="cm-pagenum">1</footer>
        </div>

        {/* Save button lives outside the sheet so the document stays untouched */}
        <div className="cm-actions" dir="rtl">
          <button className="cm-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
      <Toast toasts={toasts} />
    </>
  );
}
