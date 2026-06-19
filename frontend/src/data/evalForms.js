// Shared definitions for the three workplace-based assessment (WPBA) forms used
// by supervisors to evaluate trainees: Mini-CEX, CBD and DOPS.
//
// Each trainee is evaluated with each of these three forms at most once per
// calendar month. The definitions here drive both the supervisor entry screen
// (SupervisorEvaluations) and the trainee results display (Grades).

// The 1–5 + N/A rating scale shared by every competency domain.
// `value` is what gets stored; numeric values feed the average score.
export const SCORE_SCALE = [
  { value: 'na', label: 'N/A',   short: 'N/A', color: '#b2bec3', bg: '#f0f2f3' },
  { value: 1,    label: '1 · Unsatisfactory',       short: '1', color: '#FF4757', bg: '#fef0f0' },
  { value: 2,    label: '2 · Needs Improvement',    short: '2', color: '#FF7F50', bg: '#fff3ee' },
  { value: 3,    label: '3 · Meets Expectations',   short: '3', color: '#f39c12', bg: '#fff8e1' },
  { value: 4,    label: '4 · Exceeds Expectations', short: '4', color: '#27ae60', bg: '#eafaf1' },
  { value: 5,    label: '5 · Exceptional',          short: '5', color: '#00B894', bg: '#e8fdf3' },
];

export function scoreMeta(value) {
  return SCORE_SCALE.find(s => String(s.value) === String(value)) || null;
}

const PGY_LEVELS = ['PGY-1', 'PGY-2', 'PGY-3', 'PGY-4', 'PGY-5'];
const COMPLEXITY = ['Low', 'Moderate', 'High'];
const GLOBAL_COMPETENCE = ['Competent', 'Not Yet Competent', 'Borderline'];

// Common feedback fields (labels vary per form).
function feedback(doneWell, improve, action) {
  return [
    { key: 'doneWell',   label: doneWell },
    { key: 'improve',    label: improve },
    { key: 'actionPlan', label: action },
  ];
}

export const EVAL_FORMS = [
  {
    type: 'Mini-CEX',
    title: 'Mini-CEX',
    fullName: 'Mini Clinical Evaluation Exercise',
    accent: '#185FA5',
    header: [
      { key: 'pgyLevel',       label: 'PGY Level',          type: 'select', options: PGY_LEVELS },
      { key: 'specialty',      label: 'Specialty / Rotation', type: 'select', options: ['Medicine', 'Surgery', 'OBG', 'Paediatrics', 'Other'] },
      { key: 'clinicalSetting',label: 'Clinical Setting',   type: 'select', options: ['OPD', 'Inpatient', 'ICU', 'A&E'] },
      { key: 'patient',        label: 'Patient (Age / Sex)', type: 'text' },
      { key: 'clinicalProblem',label: 'Clinical Problem',   type: 'text' },
      { key: 'complexity',     label: 'Complexity',         type: 'select', options: COMPLEXITY },
    ],
    domains: [
      { key: 'interviewing',     label: 'Medical Interviewing & Communication Skills' },
      { key: 'history',          label: 'History Taking Skills' },
      { key: 'examination',      label: 'Physical Examination Skills' },
      { key: 'judgement',        label: 'Clinical Judgement / Clinical Reasoning' },
      { key: 'counselling',      label: 'Counselling, Education & Management Skills' },
      { key: 'professionalism',  label: 'Professionalism & Humanistic Skills' },
      { key: 'organisation',     label: 'Organisation & Efficiency' },
    ],
    times: [
      { key: 'observingMins', label: 'Observing (mins)' },
      { key: 'feedbackMins',  label: 'Feedback (mins)' },
    ],
    overall: { key: 'globalRating', label: 'Global Rating (Overall)', options: GLOBAL_COMPETENCE },
    feedback: feedback('What was effective', 'Areas to improve', 'Agreed action plan'),
  },

  {
    type: 'CBD',
    title: 'CbD',
    fullName: 'Case-Based Discussion',
    accent: '#7C3AED',
    header: [
      { key: 'pgyLevel',        label: 'PGY Level',           type: 'select', options: PGY_LEVELS },
      { key: 'specialty',       label: 'Specialty / Rotation', type: 'select', options: ['Medicine', 'Surgery', 'OBG', 'Pediatrics', 'Other'] },
      { key: 'clinicalSetting', label: 'Clinical Setting',    type: 'select', options: ['OPD', 'Inpatient', 'ICU', 'A&E'] },
      { key: 'caseTitle',       label: 'CBD Title / Case',    type: 'text' },
      { key: 'clinicalProblem', label: 'Clinical Problem',    type: 'text' },
      { key: 'complexity',      label: 'Case Complexity',     type: 'select', options: COMPLEXITY },
      { key: 'patient',         label: 'Patient (Age / Sex)', type: 'text' },
      { key: 'caseSelectedBy',  label: 'Case Selected By',    type: 'select', options: ['Trainee', 'Assessor'] },
      { key: 'assessorRole',    label: 'Assessor Role',       type: 'select', options: ['Attending', 'Fellow', 'Senior Resident', 'Other'] },
    ],
    domains: [
      { key: 'history',          label: 'History Taking',                  hint: 'Accuracy, completeness, systematic approach' },
      { key: 'findings',         label: 'Clinical Findings & Interpretation', hint: 'Exam findings, investigations, correct interpretation' },
      { key: 'reasoning',        label: 'Clinical Reasoning & Diagnosis',  hint: 'Differential diagnosis, integration of findings' },
      { key: 'management',       label: 'Management Plan',                 hint: 'Investigations, treatment decisions, evidence-based' },
      { key: 'followUp',         label: 'Follow-up & Future Planning',     hint: 'Safety-netting, patient education, continuity' },
      { key: 'communication',    label: 'Communication Skills',            hint: 'Clarity with patient/family/team; structured presentation' },
      { key: 'professionalism',  label: 'Professionalism & Ethics',        hint: 'Consent, confidentiality, ethical reasoning' },
      { key: 'recordKeeping',    label: 'Organisation & Record Keeping',   hint: 'Time management, documentation, structured thinking' },
    ],
    times: [
      { key: 'discussionMins', label: 'Discussion (mins)' },
      { key: 'feedbackMins',   label: 'Feedback (mins)' },
    ],
    overall: {
      key: 'globalRating',
      label: 'Overall Rating',
      options: ['Unsatisfactory', 'Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Exceptional'],
    },
    feedback: feedback('Done well', 'Areas to improve', 'Agreed action plan'),
  },

  {
    type: 'DOPS',
    title: 'DOPS',
    fullName: 'Direct Observation of Procedural Skills',
    accent: '#0E9F6E',
    header: [
      { key: 'pgyLevel',        label: 'PGY Level',            type: 'select', options: PGY_LEVELS },
      { key: 'specialty',       label: 'Specialty / Rotation', type: 'select', options: ['Medicine', 'Surgery', 'OBG', 'Pediatrics', 'Other'] },
      { key: 'clinicalSetting', label: 'Clinical Setting',     type: 'select', options: ['OPD', 'Inpatient', 'ICU', 'A&E', 'OR / Procedure Room'] },
      { key: 'procedureName',   label: 'Procedure Name',       type: 'text' },
      { key: 'timesPerformed',  label: 'No. of Times Performed', type: 'select', options: ['1st time', '2–5 times', '6–10 times', '>10 times'] },
      { key: 'consent',         label: 'Patient Consent',      type: 'select', options: ['Written', 'Verbal', 'N/A (emergency)'] },
    ],
    domains: [
      { key: 'indications',     label: 'Clinical Assessment & Indications', hint: 'Understands indications, contraindications & relevant anatomy' },
      { key: 'consent',         label: 'Informed Consent',                  hint: 'Obtains consent; explains procedure, risks & alternatives' },
      { key: 'preparation',     label: 'Pre-Procedure Preparation',         hint: 'Equipment, patient positioning, sterile field, safety checks' },
      { key: 'technical',       label: 'Technical Ability',                 hint: 'Dexterity, instrument handling, procedural steps in correct sequence' },
      { key: 'aseptic',         label: 'Aseptic / Infection-Control Technique', hint: 'Hand hygiene, sterile technique, sharps safety' },
      { key: 'postProcedure',   label: 'Post-Procedure Management',         hint: 'Documentation, specimen handling, patient monitoring & handover' },
      { key: 'communication',   label: 'Communication & Professionalism',   hint: 'Patient interaction, team communication, responds to concerns' },
      { key: 'seeksHelp',       label: 'Seeks Help Appropriately',          hint: 'Recognises own limits; escalates when needed' },
      { key: 'organisation',    label: 'Organisation & Efficiency',         hint: 'Time management, preparation, record-keeping' },
    ],
    times: [
      { key: 'observingMins', label: 'Observing (mins)' },
      { key: 'feedbackMins',  label: 'Feedback (mins)' },
    ],
    // DOPS has an extra single-select supervision level in addition to the overall rating.
    supervision: {
      key: 'supervisionLevel',
      label: 'Level of Supervised Practice',
      options: [
        'Unable to perform the procedure',
        'Requires direct supervision / hands-on assistance',
        'Competent in skills lab only (not yet clinical competence)',
        'Able to perform with limited supervision',
        'Competent to perform unsupervised & manage complications',
      ],
    },
    overall: { key: 'globalRating', label: 'Overall Rating', options: GLOBAL_COMPETENCE },
    feedback: feedback('Done well', 'Areas to improve', 'Agreed action plan'),
  },
];

export const FORM_TYPES = EVAL_FORMS.map(f => f.type);

export function getForm(type) {
  return EVAL_FORMS.find(f => f.type === type) || null;
}
