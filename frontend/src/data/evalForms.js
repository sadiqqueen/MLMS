// Shared definitions for the three workplace-based assessment (WPBA) forms used
// by supervisors to evaluate trainees: Mini-CEX, CBD and DOPS.
//
// Each trainee is evaluated with each of these three forms at most once per
// calendar month. The definitions here drive both the supervisor entry screen
// (SupervisorEvaluations) and the trainee results display (Grades).

// The N/A + 6-stage rating scale shared by every competency domain.
// `value` is what gets stored; numeric values feed the average score.
// Scale: N/A, -2, 0, 4, 7, 10.
export const SCORE_SCALE = [
  { value: 'na', label: 'N/A',                       short: 'N/A', color: '#b2bec3', bg: '#f0f2f3' },
  { value: -2,   label: '-2 · Unsatisfactory',       short: '-2',  color: '#FF4757', bg: '#fef0f0' },
  { value: 0,    label: '0 · Needs Improvement',     short: '0',   color: '#FF7F50', bg: '#fff3ee' },
  { value: 4,    label: '4 · Meets Expectations',    short: '4',   color: '#f39c12', bg: '#fff8e1' },
  { value: 7,    label: '7 · Exceeds Expectations',  short: '7',   color: '#27ae60', bg: '#eafaf1' },
  { value: 10,   label: '10 · Exceptional',          short: '10',  color: '#00B894', bg: '#e8fdf3' },
];

// Highest attainable per-domain score, used for printed grade output.
export const MAX_SCORE = 10;

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

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL INTERACTIVE FORMS — appended to EVAL_FORMS below so all six forms
// appear together in the supervisor's evaluation flow. Only MSF-360 has multiple
// sub-forms (Parts A–E). These use their own rating scales.
// ─────────────────────────────────────────────────────────────────────────────

// 1–5 + N/A. Numeric values feed the average; 'na' is excluded from scoring.
export const FIVE_POINT_SCALE = [
  { value: 'na', label: 'N/A', short: 'N/A', color: '#b2bec3', bg: '#f0f2f3' },
  { value: 1,    label: '1',   short: '1',   color: '#FF4757', bg: '#fef0f0' },
  { value: 2,    label: '2',   short: '2',   color: '#FF7F50', bg: '#fff3ee' },
  { value: 3,    label: '3',   short: '3',   color: '#f39c12', bg: '#fff8e1' },
  { value: 4,    label: '4',   short: '4',   color: '#27ae60', bg: '#eafaf1' },
  { value: 5,    label: '5',   short: '5',   color: '#00B894', bg: '#e8fdf3' },
];

// 3-point qualitative scale + N/A (used by the Internship FITER form).
export const THREE_POINT_SCALE = [
  { value: 'na', label: 'N/A',            short: 'N/A',   color: '#b2bec3', bg: '#f0f2f3' },
  { value: 1,    label: 'Below standard', short: 'Below', color: '#FF7F50', bg: '#fff3ee' },
  { value: 2,    label: 'Meets standard', short: 'Meets', color: '#f39c12', bg: '#fff8e1' },
  { value: 3,    label: 'Above standard', short: 'Above', color: '#27ae60', bg: '#eafaf1' },
];

// Build sectioned domain items: sections = [[sectionLabel, [itemLabels...]], ...]
function items(sections) {
  const out = [];
  let n = 0;
  sections.forEach(([section, labels]) => labels.forEach(label => out.push({ key: 'q' + (++n), section, label })));
  return out;
}

const MSF_HDR = [
  { key: 'pgyLevel', label: 'PGY Level',         type: 'select', options: PGY_LEVELS },
  { key: 'period',   label: 'Period',            type: 'text' },
  { key: 'rotation', label: 'Rotation / Service', type: 'text' },
];
const MSF_NOTE = '1 Never · 2 Rarely · 3 Sometimes · 4 Usually · 5 Consistently · N/A Unable to assess';

// Form A (faculty) item set — reused by Form E (self-assessment).
const A_SECTIONS = [
  ['Patient Care & Procedural Skills (PC)', [
    'Gathers accurate, focused histories and performs appropriate physical examinations.',
    'Develops prioritized differential diagnoses and evidence-based management plans appropriate to level of training.',
    'Recognizes clinical deterioration and escalates care in a timely manner.',
    'Performs procedures with appropriate preparation, technique, and attention to patient safety.',
  ]],
  ['Medical Knowledge (MK)', [
    'Demonstrates a clinical knowledge base appropriate to level of training.',
    'Applies knowledge to clinical reasoning rather than reciting facts; recognizes the limits of their knowledge.',
  ]],
  ['Practice-Based Learning & Improvement (PBLI)', [
    'Accepts feedback nondefensively and demonstrably changes behavior in response.',
    'Identifies own knowledge gaps and independently seeks answers (literature, guidelines, consultation).',
    'Participates meaningfully in quality improvement, morbidity and mortality review, or audit activities.',
  ]],
  ['Interpersonal & Communication Skills (ICS)', [
    'Communicates effectively and empathetically with patients and families, including in difficult conversations.',
    'Presents clinical information to the team in an organized, accurate, and concise manner.',
    'Maintains timely, accurate, and complete medical records.',
    'Conducts effective handoffs / transitions of care.',
  ]],
  ['Professionalism (PROF)', [
    'Demonstrates honesty and integrity, including acknowledging errors.',
    'Is reliable: punctual, completes tasks, follows through on commitments.',
    'Treats patients, families, and all team members with respect regardless of role, background, or status.',
    'Maintains appropriate boundaries and composure under stress.',
    'Demonstrates sensitivity to diversity and delivers equitable care.',
    'Attends to patient confidentiality and informed consent.',
  ]],
  ['Systems-Based Practice (SBP)', [
    'Uses consultants, ancillary services, and health system resources effectively and cost-consciously.',
    'Advocates for safe patient care; reports and addresses patient safety events (near misses, errors).',
    'Coordinates care effectively across settings (admissions, discharges, referrals).',
    'Considers social determinants and barriers in care planning.',
  ]],
];

const MSF_360 = {
  type: 'MSF-360',
  title: 'MSF',
  fullName: 'Multi-Source Feedback (360°) — Part 2 Instruments',
  accent: '#0EA5E9',
  scale: FIVE_POINT_SCALE,
  // A part must be chosen before the form renders (the “second option” to select A–E).
  parts: [
    {
      code: 'A',
      label: 'Form A — Faculty / Attending Evaluation of Resident',
      header: MSF_HDR, scaleNote: MSF_NOTE,
      domains: items(A_SECTIONS),
      overall: { key: 'globalRating', label: 'Overall — this resident’s professional performance relative to peers',
        options: ['1 · Well below peers', '2 · Below peers', '3 · At level', '4 · Above peers', '5 · Well above peers'] },
      feedback: [
        { key: 'continue', label: 'CONTINUE — one specific behavior this resident should continue' },
        { key: 'change',   label: 'CHANGE / DEVELOP — one specific behavior to change or develop' },
        { key: 'concern',  label: 'Any professionalism or patient-safety concern (leave blank if none)' },
      ],
    },
    {
      code: 'B',
      label: 'Form B — Peer (Resident-to-Resident) Evaluation',
      header: MSF_HDR, scaleNote: MSF_NOTE,
      domains: items([
        ['Teamwork & Communication (ICS)', [
          'Communicates clearly and respectfully with co-residents.',
          'Gives complete, organized, and safe handoffs.',
          'Shares clinical information proactively so the team is never surprised.',
          'Is approachable when I need help or need to raise a concern.',
        ]],
        ['Professionalism & Reliability (PROF)', [
          'Carries a fair share of the team’s workload.',
          'Is punctual and present for clinical duties, conferences, and call responsibilities.',
          'Responds professionally to pages and messages from colleagues.',
          'Is honest about what they have and have not done (e.g., pending tasks, results).',
          'Treats junior team members and students respectfully; does not belittle or blame.',
          'Maintains composure and professionalism during high-stress situations.',
        ]],
        ['Learning Climate & Improvement (PBLI / MK)', [
          'Teaches and shares knowledge willingly with peers and students.',
          'Accepts correction or disagreement from peers without hostility or defensiveness.',
          'Asks for help appropriately rather than working beyond their competence.',
        ]],
        ['Systems & Safety (SBP)', [
          'Speaks up about patient safety concerns, including to seniors.',
          'Uses team resources (nursing, pharmacy, consults) collaboratively rather than adversarially.',
        ]],
      ]),
      overall: { key: 'globalRating', label: 'Overall — I would want this resident on my team / caring for my own family member',
        options: ['1 · Strongly disagree', '2 · Disagree', '3 · Neutral', '4 · Agree', '5 · Strongly agree'] },
      feedback: [
        { key: 'doneWell', label: 'One thing this colleague does well' },
        { key: 'improve',  label: 'One thing this colleague could improve' },
      ],
    },
    {
      code: 'C',
      label: 'Form C — Nursing & Allied Health Professional Evaluation',
      header: MSF_HDR, scaleNote: MSF_NOTE,
      domains: items([
        ['Communication (ICS)', [
          'Communicates orders and plans clearly, and clarifies willingly when asked.',
          'Listens to and seriously considers input from nursing and allied health staff.',
          'Keeps patients and families informed in understandable language.',
          'Is reachable and responds to pages / calls in a timely, courteous manner.',
        ]],
        ['Professionalism (PROF)', [
          'Treats nursing, allied health, and support staff with courtesy and respect.',
          'Remains calm and professional in urgent or stressful situations.',
          'Accepts questioning of orders (e.g., dose checks, safety concerns) without irritation or retaliation.',
          'Is honest and takes responsibility rather than shifting blame.',
          'Shows compassion and respect toward patients and families, including difficult or vulnerable patients.',
        ]],
        ['Patient Care & Safety (PC / SBP)', [
          'Responds promptly when notified of a change in patient condition.',
          'Writes / enters orders that are clear, complete, and safe.',
          'Participates constructively in interprofessional rounds, huddles, and care coordination.',
          'Follows infection-control and patient-safety practices (hand hygiene, time-outs, ID checks).',
        ]],
      ]),
      overall: { key: 'globalRating', label: 'Overall — working with this resident supports good patient care',
        options: ['1', '2', '3', '4', '5'] },
      feedback: [{ key: 'comments', label: 'Comments or specific examples (optional)' }],
    },
    {
      code: 'D',
      label: 'Form D — Patient / Family Experience Questionnaire',
      header: [], scaleNote: '1 Poor · 2 Fair · 3 Good · 4 Very good · 5 Excellent · N/A Does not apply',
      domains: items([
        ['Thinking about this doctor, how would you rate the doctor at …', [
          'Greeting you and making you feel comfortable and respected.',
          'Letting you tell your story without interrupting.',
          'Explaining your condition and the plan in words you could understand.',
          'Answering your questions fully.',
          'Involving you in decisions about your care.',
          'Showing care and concern for you as a person.',
          'Respecting your privacy.',
          'Spending enough time with you.',
          'Telling you what to expect next (tests, follow-up, warning signs).',
        ]],
      ]),
      overall: { key: 'globalRating', label: 'Overall — how would you rate this doctor?',
        options: ['1 · Poor', '2 · Fair', '3 · Good', '4 · Very good', '5 · Excellent'] },
      feedback: [{ key: 'comments', label: 'Anything else you would like this doctor or the hospital to know (optional)' }],
    },
    {
      code: 'E',
      label: 'Form E — Resident Self-Assessment',
      header: MSF_HDR, scaleNote: MSF_NOTE,
      // Self-rates the same items as Form A, then answers reflective prompts.
      domains: items(A_SECTIONS),
      feedback: [
        { key: 'strengths', label: 'My three greatest strengths this period are' },
        { key: 'growth',    label: 'My three most important growth areas are' },
        { key: 'goal',      label: 'One goal I set from my last feedback, and what I did about it' },
        { key: 'predict',   label: 'In which competency do you expect your lowest external ratings? Why?' },
      ],
    },
  ],
};

const ACADEMIC_SUPERVISOR_REPORT = {
  type: 'Academic Supervisor Report',
  title: 'ASR',
  fullName: 'Academic Supervisor Report',
  accent: '#B45309',
  scale: FIVE_POINT_SCALE,
  scaleNote: '1 Unsatisfactory · 2 Needs Improvement · 3 Meets Expectations · 4 Exceeds Expectations · 5 Exceptional · N/A',
  header: [
    { key: 'pgyLevel',      label: 'PGY Level',          type: 'select', options: PGY_LEVELS },
    { key: 'rotation',      label: 'Rotation / Service',  type: 'text' },
    { key: 'evaluatorRole', label: 'Evaluator Role',      type: 'select', options: ['Attending', 'Fellow', 'Peer', 'Nurse', 'Other'] },
  ],
  domains: items([
    ['1. Patient Care', ['History taking & physical examination', 'Clinical reasoning & diagnosis', 'Management planning & procedures']],
    ['2. Medical Knowledge', ['Foundational & clinical sciences', 'Evidence-based medicine application', 'Clinical guidelines adherence']],
    ['3. Interpersonal & Communication Skills', ['Patient & family communication', 'Team communication & handoffs', 'Documentation quality']],
    ['4. Professionalism', ['Integrity, ethics & accountability', 'Reliability & punctuality', 'Compassion & respect']],
    ['5. Practice-Based Learning', ['Self-directed learning & feedback', 'Quality improvement participation', 'Teaching & supervision of juniors']],
    ['6. Systems-Based Practice', ['Resource utilization', 'Multidisciplinary team collaboration', 'Patient safety awareness']],
  ]),
  // CCC decision reuses the single-select "supervision" slot in the form renderer.
  supervision: {
    key: 'cccDecision',
    label: 'CCC Decision',
    options: ['Promote to Next Level', 'Continue with Monitoring', 'Remediation Plan Required', 'Requires Further Review'],
  },
  overall: {
    key: 'globalRating', label: 'Overall Rating',
    options: ['Unsatisfactory', 'Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Exceptional'],
  },
  feedback: [{ key: 'narrative', label: 'Narrative Summary (Strengths / Areas for Development / Goals for Next Period)' }],
};

const INTERNSHIP_FITER = {
  type: 'FITER',
  title: 'FITER',
  fullName: 'Internship — Final In-Training Evaluation Report',
  accent: '#0D9488',
  scale: THREE_POINT_SCALE,
  scaleNote: 'Below standard · Meets standard · Above standard · N/A (not applicable)',
  header: [
    { key: 'imaNumber', label: 'Trainee IMA Number', type: 'text' },
    { key: 'rota',      label: 'ROTA',                type: 'select', options: ['Medicine', 'Surgery', 'OBG', 'Pediatrics'] },
    { key: 'hospital',  label: 'Hospital',            type: 'text' },
    { key: 'period',    label: 'Evaluation Period',   type: 'text' },
  ],
  domains: items([
    ['Domain I: Knowledge — A. Biomedical Scientific Principles', [
      'Apply anatomy, physiology, and pathophysiology to understand common clinical presentations',
      'Apply pharmacological principles to medication management',
      'Apply principles of microbiology and immunology to infection management',
    ]],
    ['Domain I: Knowledge — B. Clinical Sciences & Diagnostic Reasoning', [
      'Formulate differential diagnoses for common clinical presentations',
      'Select and interpret diagnostic investigations appropriately',
    ]],
    ['Domain I: Knowledge — C. Population Health & Healthcare Systems', [
      'Apply principles of epidemiology and public health to patient care',
      'Understand the Iraqi healthcare system structure and function',
    ]],
    ['Domain I: Knowledge — D. Evidence-Based Medicine & Research', [
      'Apply principles of evidence-based medicine to clinical decision-making',
      'Participate in quality improvement and clinical audit activities',
    ]],
    ['Domain II: Skills — A. Patient Assessment & Clinical Examination', [
      'Conduct comprehensive patient consultations',
      'Document clinical encounters accurately and completely',
    ]],
    ['Domain II: Skills — B. Clinical Diagnosis & Management', [
      'Diagnose and manage common acute medical conditions',
      'Diagnose and manage common surgical conditions',
      'Manage chronic diseases in the outpatient and inpatient settings',
    ]],
    ['Domain II: Skills — C. Emergency Care & Resuscitation', [
      'Provide immediate care in medical emergencies',
      'Manage common emergency presentations',
    ]],
    ['Domain II: Skills — D. Prescribing & Therapeutics', [
      'Prescribe medications safely and effectively',
      'Monitor and manage therapeutic interventions',
    ]],
    ['Domain II: Skills — E. Clinical Procedures', [
      'Perform essential diagnostic procedures safely',
      'Perform essential therapeutic procedures safely',
    ]],
    ['Domain II: Skills — F. Communication & Interpersonal Skills', [
      'Communicate effectively with patients and families',
      'Communicate effectively with healthcare colleagues',
    ]],
    ['Domain II: Skills — G. Information Management & Technology', [
      'Use information systems effectively in clinical practice',
      'Access and apply medical information resources',
    ]],
    ['Domain III: Attitudes — A. Professional Values & Ethics', [
      'Demonstrate ethical principles in medical practice',
      'Show respect and compassion toward all patients',
    ]],
    ['Domain III: Attitudes — B. Patient Safety & Quality of Care', [
      'Prioritize patient safety in all activities',
      'Participate in quality improvement activities',
    ]],
    ['Domain III: Attitudes — C. Legal & Regulatory Responsibilities', [
      'Understand and fulfil legal obligations',
      'Maintain professional registration and compliance',
    ]],
    ['Domain III: Attitudes — D. Teamwork & Collaboration', [
      'Function effectively as a member of healthcare teams',
      'Demonstrate effective leadership when appropriate',
    ]],
    ['Domain III: Attitudes — E. Professional Development & Self-Care', [
      'Engage in continuous professional development',
      'Maintain personal health and well-being',
    ]],
    ['Domain III: Attitudes — F. Dealing with Complexity & Uncertainty', [
      'Manage clinical uncertainty appropriately',
      'Care for vulnerable and challenging patients',
    ]],
  ]),
  overall: {
    key: 'globalRating',
    label: 'Global Rating — overall judgement of performance and professionalism',
    options: ['Competent', 'Not-Competent'],
  },
  feedback: [{ key: 'comments', label: 'Assessor comments — what was effective, what could be improved, suggested actions & timeline' }],
};

// Selectable TRAINEE forms. The Internship (FITER) form was removed from the
// selectable list, but stays in ALL_FORMS below so previously saved FITER
// evaluations still resolve (title, domains, print layout).
EVAL_FORMS.push(MSF_360, ACADEMIC_SUPERVISOR_REPORT);

// Every historical form, including the now-unselectable Internship/FITER — used
// only by getForm() to render/print saved evaluations of removed forms.
const ALL_FORMS = [...EVAL_FORMS, INTERNSHIP_FITER];

// Supervisor-subject evaluations currently expose NO forms (product decision).
// Future supervisor forms are added here, not to EVAL_FORMS.
export const SUPERVISOR_EVAL_FORMS = [];

export const FORM_TYPES = EVAL_FORMS.map(f => f.type);

// Resolve a form by type. Exact match covers every form (and 'MSF-360' itself,
// which keeps its Part A–E selector). A submitted MSF part ('MSF-360 · Form A')
// resolves to that part merged onto the MSF parent, so consumers see its domains.
export function getForm(type) {
  const raw = String(type || '');
  const exact = ALL_FORMS.find(f => f.type === raw);
  if (exact) return exact;
  const m = raw.match(/^(.*) · Form ([A-E])$/);
  if (m) {
    const parent = ALL_FORMS.find(f => f.type === m[1]);
    const part = parent && parent.parts && parent.parts.find(p => p.code === m[2]);
    if (parent && part) return { ...parent, ...part };
  }
  return null;
}
