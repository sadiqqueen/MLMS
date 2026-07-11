import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconEdit, IconBan } from '../components/icons';

const API_BASE = '';

// ── Translations ────────────────────────────────────────────────────────────
const STRINGS = {
  ar: {
    // tabs + actions
    trainees: 'المتدربون', rotations: 'التدويرات',
    addTrainee: '+ إضافة متدرب', assignRotation: '+ إسناد تدوير',
    searchTrainees: 'ابحث بالاسم أو البريد أو الرقم الجامعي…',
    searchRotations: 'ابحث باسم المتدرب أو المشرف…',
    // trainees empty + card
    noTraineesYet: 'لا يوجد متدربون بعد',
    noTraineesMatch: 'لا يوجد متدربون مطابقون لبحثك',
    addFirstTrainee: 'اضغط «إضافة متدرب» لإضافة أول متدرب لهذا التخصص.',
    year: 'السنة', idTag: 'رقم',
    // rotation filter + statuses
    all: 'الكل', upcoming: 'قادم', current: 'حالي', completed: 'مكتمل', cancelled: 'ملغى',
    // rotations empty + card
    noRotationsYet: 'لم يتم إسناد تدويرات بعد',
    noRotationsMatch: 'لا توجد تدويرات مطابقة لبحثك',
    addFirstRotation: 'اضغط «إسناد تدوير» لإنشاء أول تدوير.',
    hospital: 'المستشفى', supervisor: 'المشرف', dates: 'التواريخ', duration: 'المدة', weeks: 'أسابيع',
    // confirm deactivate
    deactivateTrainee: 'تعطيل المتدرب',
    deactivateMsgPre: 'تعطيل ',
    deactivateMsgPost: '؟ لن يتمكن الحساب من تسجيل الدخول بعد الآن.',
    cancel: 'إلغاء', deactivate: 'تعطيل',
    // trainee modal
    editTrainee: 'تعديل متدرب', addTraineeTitle: 'إضافة متدرب',
    fullName: 'الاسم الكامل *', fullNamePh: 'الاسم الكامل',
    email: 'البريد الإلكتروني *',
    password: 'كلمة المرور *', passwordPh: '6 أحرف على الأقل', passwordErr: 'مطلوب 6 أحرف على الأقل',
    studentId: 'الرقم الجامعي', studentIdPh: 'مثال: STD-001',
    selectYear: '— اختر السنة —',
    specialty: 'التخصص', autoSet: '(يُحدَّد تلقائياً)', noSpecialty: 'لا يوجد تخصص معيّن لحسابك',
    hospitalLabel: 'المستشفى', searchHospital: 'ابحث عن مستشفى...',
    supervisorLabel: 'المشرف *', searchSupervisor: 'ابحث عن مشرف...',
    researchSupervisorLabel: 'مشرف الأبحاث', supervisorRequiredErr: 'المشرف مطلوب',
    noSupsForSpec: 'لا يوجد مشرفون لتخصص',
    phone: 'الهاتف',
    gender: 'الجنس', select: '— اختر —', male: 'ذكر', female: 'أنثى',
    city: 'المدينة',
    saving: 'جارٍ الحفظ…', saveChanges: 'حفظ التغييرات',
    // rotation modal
    assignRotationTitle: 'إسناد تدوير',
    trainee: 'المتدرب *', searchTrainee: 'ابحث عن متدرب...', required: 'مطلوب',
    hospitalReq: 'المستشفى *', supervisorReq: 'المشرف *',
    filteredBySpec: ' (مُصفّى حسب تخصص المتدرب)',
    noSupsMatch: 'لا يوجد مشرفون مطابقون لتخصص هذا المتدرب',
    startDate: 'تاريخ البداية *', endDate: 'تاريخ النهاية *',
    // toasts
    loadFailed: 'فشل تحميل البيانات',
    traineeUpdated: 'تم تحديث المتدرب', traineeAdded: 'تمت إضافة المتدرب',
    saveFailed: 'فشل الحفظ',
    traineeDeactivated: 'تم تعطيل المتدرب', deactivateFailed: 'فشل التعطيل',
    rotationAssigned: 'تم إسناد التدوير بنجاح', rotationFailed: 'فشل إسناد التدوير',
  },
  en: {
    trainees: 'Trainees', rotations: 'Rotations',
    addTrainee: '+ Add Trainee', assignRotation: '+ Assign Rotation',
    searchTrainees: 'Search by name, email, or student ID…',
    searchRotations: 'Search by trainee or supervisor name…',
    noTraineesYet: 'No trainees yet',
    noTraineesMatch: 'No trainees match your search',
    addFirstTrainee: 'Click "+ Add Trainee" to add the first trainee to this specialty.',
    year: 'Year', idTag: 'ID',
    all: 'All', upcoming: 'Upcoming', current: 'Current', completed: 'Completed', cancelled: 'Cancelled',
    noRotationsYet: 'No rotations assigned yet',
    noRotationsMatch: 'No rotations match your search',
    addFirstRotation: 'Click "+ Assign Rotation" to create the first rotation.',
    hospital: 'Hospital', supervisor: 'Supervisor', dates: 'Dates', duration: 'Duration', weeks: 'weeks',
    deactivateTrainee: 'Deactivate Trainee',
    deactivateMsgPre: 'Deactivate ',
    deactivateMsgPost: '? The account will no longer be able to sign in.',
    cancel: 'Cancel', deactivate: 'Deactivate',
    editTrainee: 'Edit Trainee', addTraineeTitle: 'Add Trainee',
    fullName: 'Full Name *', fullNamePh: 'Full name',
    email: 'Email *',
    password: 'Password *', passwordPh: 'Min. 6 characters', passwordErr: 'At least 6 characters required',
    studentId: 'Student ID', studentIdPh: 'e.g. STD-001',
    selectYear: '— Select year —',
    specialty: 'Specialty', autoSet: '(auto-set)', noSpecialty: 'No specialty assigned to your account',
    hospitalLabel: 'Hospital', searchHospital: 'Search hospital...',
    supervisorLabel: 'Supervisor *', searchSupervisor: 'Search supervisor...',
    researchSupervisorLabel: 'Research Supervisor', supervisorRequiredErr: 'Supervisor is required',
    noSupsForSpec: 'No supervisors found for',
    phone: 'Phone',
    gender: 'Gender', select: '— Select —', male: 'Male', female: 'Female',
    city: 'City',
    saving: 'Saving…', saveChanges: 'Save Changes',
    assignRotationTitle: 'Assign Rotation',
    trainee: 'Trainee *', searchTrainee: 'Search trainee...', required: 'Required',
    hospitalReq: 'Hospital *', supervisorReq: 'Supervisor *',
    filteredBySpec: ' (filtered by trainee specialty)',
    noSupsMatch: "No supervisors match this trainee's specialty",
    startDate: 'Start Date *', endDate: 'End Date *',
    loadFailed: 'Failed to load data',
    traineeUpdated: 'Trainee updated', traineeAdded: 'Trainee added',
    saveFailed: 'Save failed',
    traineeDeactivated: 'Trainee deactivated', deactivateFailed: 'Deactivate failed',
    rotationAssigned: 'Rotation assigned successfully', rotationFailed: 'Failed to assign rotation',
  },
};
const tr = (lang, k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;

function fmtDate(d, lang = 'en') {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weeksBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  const { lang } = usePrefs();
  const t = k => tr(lang, k);
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>{t('deactivateTrainee')}</h3>
        <p>{t('deactivateMsgPre')}<strong>{name}</strong>{t('deactivateMsgPost')}</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>{t('cancel')}</button>
          <button className="btn-red" onClick={onConfirm}>{t('deactivate')}</button>
        </div>
      </div>
    </div>
  );
}

function TraineeModal({ editTrainee, hospitals, supervisors, secretarySpecialty, onSave, onClose, saving }) {
  const { lang } = usePrefs();
  const t = k => tr(lang, k);
  const specId   = secretarySpecialty?._id || secretarySpecialty || '';
  const specName = secretarySpecialty?.name || '';

  const empty = {
    name: '', email: '', password: '', phone: '', gender: '', city: '',
    year: '', studentId: '', hospitalId: '', supervisorId: '', researchSupervisorId: '',
    specialtyId: specId,
  };

  const [form, setForm] = useState(editTrainee ? {
    name:        editTrainee.name        || '',
    email:       editTrainee.email       || '',
    phone:       editTrainee.phone       || '',
    gender:      editTrainee.gender      || '',
    city:        editTrainee.city        || '',
    year:        editTrainee.year        || '',
    studentId:   editTrainee.studentId   || '',
    hospitalId:  editTrainee.hospitalId?._id   || editTrainee.hospitalId   || '',
    supervisorId:editTrainee.supervisorId?._id  || editTrainee.supervisorId  || '',
    researchSupervisorId: editTrainee.researchSupervisorId?._id || editTrainee.researchSupervisorId || '',
    specialtyId: editTrainee.specialtyId?._id  || editTrainee.specialtyId  || specId,
  } : empty);

  const [errors, setErrors] = useState({});

  const filteredSups = supervisors.filter(s => {
    if (!specId) return true;
    const sid = (s.specialtyId?._id || s.specialtyId || '')?.toString();
    return sid === specId.toString();
  });
  const hospitalOptions = hospitals.map(h => ({ value: h._id, label: h.name }));
  const supervisorOptions = filteredSups.map(s => ({ value: s._id, label: s.name }));

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editTrainee && (!form.password || form.password.length < 6)) e.password = true;
    if (!form.supervisorId) e.supervisorId = true;   // a trainee must have a supervisor
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    // Empty optional reference → null so the backend unsets it cleanly.
    onSave({ ...form, researchSupervisorId: form.researchSupervisorId || null, role: 'trainee' });
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{editTrainee ? t('editTrainee') : t('addTraineeTitle')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field">
              <label>{t('fullName')}</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder={t('fullNamePh')} />
            </div>

            <div className="admin-field">
              <label>{t('email')}</label>
              <input className={errors.email ? 'invalid' : ''} type="email" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
            </div>

            {!editTrainee && (
              <div className="admin-field">
                <label>{t('password')}</label>
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password || ''}
                  onChange={e => set('password', e.target.value)} placeholder={t('passwordPh')} />
                {errors.password && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{t('passwordErr')}</span>}
              </div>
            )}

            <div className="admin-field">
              <label>{t('studentId')}</label>
              <input value={form.studentId} onChange={e => set('studentId', e.target.value)} placeholder={t('studentIdPh')} />
            </div>

            <div className="admin-field">
              <label>{t('year')}</label>
              <select value={form.year} onChange={e => set('year', e.target.value)}>
                <option value="">{t('selectYear')}</option>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>{t('year')} {y}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>{t('specialty')}</label>
              {specName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                  <span className="specialty-tag" style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px' }}>{specName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('autoSet')}</span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 6, display: 'block' }}>
                  {t('noSpecialty')}
                </span>
              )}
            </div>

            <div className="admin-field">
              <label>{t('hospitalLabel')}</label>
              <SearchableSelect
                value={form.hospitalId}
                onChange={value => set('hospitalId', value)}
                options={hospitalOptions}
                placeholder={t('searchHospital')}
              />
            </div>

            <div className="admin-field">
              <label>{t('supervisorLabel')}</label>
              <SearchableSelect
                value={form.supervisorId}
                onChange={value => set('supervisorId', value)}
                options={supervisorOptions}
                placeholder={t('searchSupervisor')}
                error={errors.supervisorId}
              />
              {errors.supervisorId && (
                <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, display: 'block' }}>{t('supervisorRequiredErr')}</span>
              )}
              {specName && filteredSups.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                  {t('noSupsForSpec')} {specName}
                </span>
              )}
            </div>

            <div className="admin-field">
              <label>{t('researchSupervisorLabel')}</label>
              <SearchableSelect
                value={form.researchSupervisorId}
                onChange={value => set('researchSupervisorId', value)}
                options={supervisorOptions}
                placeholder={t('searchSupervisor')}
              />
            </div>

            <div className="admin-field">
              <label>{t('phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 xxx xxx xxxx" />
            </div>

            <div className="admin-field">
              <label>{t('gender')}</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">{t('select')}</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>

            <div className="admin-field">
              <label>{t('city')}</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder={t('city')} />
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : editTrainee ? t('saveChanges') : t('addTraineeTitle')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RotationModal({ trainees, supervisors, hospitals, onSave, onClose, saving }) {
  const { lang } = usePrefs();
  const t = k => tr(lang, k);
  const [form, setForm] = useState({
    traineeId:     '',
    hospitalId:    '',
    supervisorId:  '',
    startDate:     '',
    endDate:       '',
  });
  const [errors, setErrors] = useState({});

  const selectedTrainee     = trainees.find(t => t._id === form.traineeId);
  const traineeSpecialtyId  = selectedTrainee
    ? (selectedTrainee.specialtyId?._id || selectedTrainee.specialtyId || '')?.toString()
    : '';

  const filteredSups = supervisors.filter(s => {
    if (!traineeSpecialtyId) return true;
    const sid = (s.specialtyId?._id || s.specialtyId || '')?.toString();
    return sid === traineeSpecialtyId;
  });
  const traineeOptions = trainees.map(t => ({ value: t._id, label: `${t.name}${t.studentId ? ` (${t.studentId})` : ''}` }));
  const hospitalOptions = hospitals.map(h => ({ value: h._id, label: h.name }));
  const supervisorOptions = filteredSups.map(s => ({ value: s._id, label: s.name }));

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'traineeId') next.supervisorId = '';
      return next;
    });
    setErrors(e => ({ ...e, [k]: false }));
  }

  function validate() {
    const e = {};
    if (!form.traineeId)     e.traineeId     = true;
    if (!form.hospitalId)    e.hospitalId    = true;
    if (!form.supervisorId)  e.supervisorId  = true;
    if (!form.startDate)     e.startDate     = true;
    if (!form.endDate)       e.endDate       = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(form);
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 };

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('assignRotationTitle')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('trainee')}</label>
            <SearchableSelect
              value={form.traineeId}
              onChange={value => set('traineeId', value)}
              options={traineeOptions}
              placeholder={t('searchTrainee')}
              error={errors.traineeId}
            />
            {errors.traineeId && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{t('required')}</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('hospitalReq')}</label>
            <SearchableSelect
              value={form.hospitalId}
              onChange={value => set('hospitalId', value)}
              options={hospitalOptions}
              placeholder={t('searchHospital')}
              error={errors.hospitalId}
            />
            {errors.hospitalId && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{t('required')}</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              {t('supervisorReq')}{form.traineeId ? t('filteredBySpec') : ''}
            </label>
            <SearchableSelect
              value={form.supervisorId}
              onChange={value => set('supervisorId', value)}
              options={supervisorOptions}
              placeholder={t('searchSupervisor')}
              error={errors.supervisorId}
            />
            {errors.supervisorId && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{t('required')}</div>}
            {form.traineeId && filteredSups.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {t('noSupsMatch')}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{t('startDate')}</label>
              <input
                type="date"
                className={errors.startDate ? 'invalid admin-search' : 'admin-search'}
                style={{ width: '100%' }}
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
              />
              {errors.startDate && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{t('required')}</div>}
            </div>
            <div>
              <label style={labelStyle}>{t('endDate')}</label>
              <input
                type="date"
                className={errors.endDate ? 'invalid admin-search' : 'admin-search'}
                style={{ width: '100%' }}
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
              />
              {errors.endDate && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{t('required')}</div>}
            </div>
          </div>

        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('assignRotationTitle')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecretaryTrainees() {
  const { user: me }    = useAuth();
  const { lang }        = usePrefs();
  const t = k => tr(lang, k);
  const [trainees,      setTrainees     ] = useState([]);
  const [supervisors,   setSupervisors  ] = useState([]);
  const [hospitals,     setHospitals    ] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [search,        setSearch       ] = useState('');
  const [activeTab,     setActiveTab    ] = useState('trainees');
  const [rotFilter,     setRotFilter    ] = useState('all');
  const [showModal,     setShowModal    ] = useState(false);
  const [showRotModal,  setShowRotModal ] = useState(false);
  const [editTrainee,   setEditTrainee  ] = useState(null);
  const [delTrainee,    setDelTrainee   ] = useState(null);
  const [saving,        setSaving       ] = useState(false);
  const [toasts,        setToasts       ] = useState([]);

  const secretarySpecialty = me?.specialtyId || null;

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/secretary/trainees'),
      api.get('/api/secretary/supervisors'),
      api.get('/api/secretary/distributions'),
      api.get('/api/hospitals'),
    ]).then(([tRes, sRes, dRes, hRes]) => {
      setTrainees(     tRes.data?.data || tRes.data || []);
      setSupervisors(  sRes.data?.data || sRes.data || []);
      setDistributions(dRes.data?.data || dRes.data || []);
      setHospitals(    hRes.data?.data || hRes.data || []);
    }).catch(() => showToast(tr(lang, 'loadFailed'), 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveTrainee(data) {
    setSaving(true);
    try {
      if (editTrainee) {
        const res = await api.patch(`/api/secretary/trainees/${editTrainee._id}`, data);
        const updated = res.data?.data || res.data;
        setTrainees(prev => prev.map(t => t._id === editTrainee._id ? updated : t));
        showToast(t('traineeUpdated'));
      } else {
        const res = await api.post('/api/secretary/trainees', data);
        const created = res.data?.data || res.data;
        setTrainees(prev => [created, ...prev]);
        showToast(t('traineeAdded'));
      }
      setShowModal(false);
      setEditTrainee(null);
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTrainee() {
    try {
      await api.delete(`/api/users/${delTrainee._id}`);
      setTrainees(prev => prev.filter(t => t._id !== delTrainee._id));
      showToast(t('traineeDeactivated'));
    } catch { showToast(t('deactivateFailed'), 'error'); }
    finally  { setDelTrainee(null); }
  }

  async function handleSaveRotation(data) {
    setSaving(true);
    try {
      const res = await api.post('/api/secretary/distributions', data);
      const created = res.data?.data || res.data;
      setDistributions(prev => [created, ...prev]);
      setShowRotModal(false);
      showToast(t('rotationAssigned'));
    } catch (err) {
      showToast(err.response?.data?.message || t('rotationFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const filteredTrainees = trainees.filter(t => {
    const q = search.toLowerCase();
    return !q
      || t.name?.toLowerCase().includes(q)
      || t.email?.toLowerCase().includes(q)
      || (t.studentId || '').toLowerCase().includes(q);
  });

  const filteredDists = distributions.filter(d => {
    const q = search.toLowerCase();
    const tName = d.traineeId?.name || d.student?.name || '';
    const sName = d.supervisorId?.name || d.doctor?.name || '';
    return !q || tName.toLowerCase().includes(q) || sName.toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <Sk w={120} h={36} r={8} /><Sk w={140} h={36} r={8} />
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(7)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={24} h={13} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={70}  h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><div style={{ display: 'flex', gap: 6 }}><Sk w={28} h={28} r={6} /><Sk w={28} h={28} r={6} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Centered toggle */}
        <div className="filter-tabs" style={{ justifyContent: 'center', marginBottom: 14 }}>
          <button
            className={`filter-tab${activeTab === 'trainees' ? ' active' : ''}`}
            style={{ height: 42, padding: '0 26px', fontSize: 14, fontWeight: 600 }}
            onClick={() => setActiveTab('trainees')}
          >
            {t('trainees')} ({trainees.length})
          </button>
          <button
            className={`filter-tab${activeTab === 'rotations' ? ' active' : ''}`}
            style={{ height: 42, padding: '0 26px', fontSize: 14, fontWeight: 600 }}
            onClick={() => setActiveTab('rotations')}
          >
            {t('rotations')} ({distributions.length})
          </button>
        </div>

        {/* Action button (own row, follows text direction) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          {activeTab === 'trainees' && (
            <button className="btn-purple" onClick={() => { setEditTrainee(null); setShowModal(true); }}>
              {t('addTrainee')}
            </button>
          )}
          {activeTab === 'rotations' && (
            <button className="btn-purple" onClick={() => setShowRotModal(true)}>
              {t('assignRotation')}
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            className="admin-search"
            style={{ width: '100%', height: 38 }}
            placeholder={activeTab === 'trainees' ? t('searchTrainees') : t('searchRotations')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Trainees Card Grid */}
        {activeTab === 'trainees' && (
          <div className="management-card-grid">
            {filteredTrainees.length === 0 && (
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                  {trainees.length === 0 ? t('noTraineesYet') : t('noTraineesMatch')}
                </div>
                {trainees.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('addFirstTrainee')}</div>
                )}
              </div>
            )}
            {filteredTrainees.map(t2 => (
              <div className="management-card" key={t2._id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {t2.photoUrl
                    ? <img src={`${API_BASE}${t2.photoUrl}`} alt="" className="cell-photo" />
                    : <div className="cell-initials">{t2.initials || t2.name?.[0] || '?'}</div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <div className="management-card-title">{t2.name}</div>
                    <div className="management-card-sub">{t2.email}</div>
                  </div>
                </div>
                <div className="management-card-meta">
                  <span className="specialty-tag">{t2.studentId ? `${t('idTag')} ${t2.studentId}` : (t2.specialtyId?.name || '—')}</span>
                  {t2.year && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('year')} {t2.year}</span>}
                  {t2.phone && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t2.phone}</span>}
                </div>
                <div className="management-card-actions">
                  <button className="btn-action edit" onClick={() => { setEditTrainee(t2); setShowModal(true); }}>
                    <IconEdit />
                  </button>
                  <button className="btn-action delete" onClick={() => setDelTrainee(t2)}>
                    <IconBan />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rotation status filter */}
        {activeTab === 'rotations' && (
          <div className="filter-tabs" style={{ marginBottom: 14 }}>
            {['all', 'upcoming', 'current', 'completed'].map(key => (
              <button
                key={key}
                className={`filter-tab${rotFilter === key ? ' active' : ''}`}
                onClick={() => setRotFilter(key)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}

        {/* Rotations Card Grid */}
        {activeTab === 'rotations' && (() => {
          const rotList = filteredDists.filter(d => rotFilter === 'all' || (d.status || 'upcoming') === rotFilter);
          return (
            <div className="management-card-grid">
              {rotList.length === 0 && (
                <div className="admin-empty" style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                    {distributions.length === 0 ? t('noRotationsYet') : t('noRotationsMatch')}
                  </div>
                  {distributions.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('addFirstRotation')}</div>
                  )}
                </div>
              )}
              {rotList.map(d => {
                const trainee    = d.traineeId    || d.student  || {};
                const supervisor = d.supervisorId  || d.doctor   || {};
                const hospital   = d.hospitalId || d.hospital || {};
                const status     = d.status || 'upcoming';
                const duration   = d.durationWeeks || weeksBetween(d.startDate, d.endDate);
                const statusColor = status === 'current' ? 'var(--success-fg)' : status === 'completed' ? 'var(--info-fg)' : status === 'cancelled' ? 'var(--danger-fg)' : 'var(--warning-fg)';
                const statusBg    = status === 'current' ? 'var(--success-bg)' : status === 'completed' ? 'var(--info-bg)' : status === 'cancelled' ? 'var(--danger-bg)' : 'var(--warning-bg)';
                return (
                  <div className="management-card" key={d._id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="management-card-title">{trainee.name || '—'}</div>
                        {trainee.studentId && <div className="management-card-sub">{trainee.studentId}</div>}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px',
                        borderRadius: 20, background: statusBg, color: statusColor, whiteSpace: 'nowrap'
                      }}>{t(status)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('hospital')}</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'end' }}>{hospital.name || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('supervisor')}</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'end' }}>{supervisor.name || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('dates')}</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'end' }}>{fmtDate(d.startDate, lang)} – {fmtDate(d.endDate, lang)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('duration')}</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'end' }}>{duration ? `${duration} ${t('weeks')}` : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {showModal && (
          <TraineeModal
            editTrainee={editTrainee}
            hospitals={hospitals}
            supervisors={supervisors}
            secretarySpecialty={secretarySpecialty}
            onSave={handleSaveTrainee}
            onClose={() => { setShowModal(false); setEditTrainee(null); }}
            saving={saving}
          />
        )}

        {showRotModal && (
          <RotationModal
            trainees={trainees}
            supervisors={supervisors}
            hospitals={hospitals}
            onSave={handleSaveRotation}
            onClose={() => setShowRotModal(false)}
            saving={saving}
          />
        )}

        {delTrainee && (
          <ConfirmDelete
            name={delTrainee.name}
            onConfirm={handleDeleteTrainee}
            onCancel={() => setDelTrainee(null)}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
