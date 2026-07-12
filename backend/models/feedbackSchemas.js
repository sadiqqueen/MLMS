// backend/models/feedbackSchemas.js
// Shared sub-schemas for the "Event Feedback" subsystem (separate from the
// medical WPBA Evaluation model). A form is a JSON `fields` array; each field is
// one of the supported types below. These sub-schemas are embedded by both
// FeedbackForm (the editable head) and FeedbackFormVersion (immutable snapshots),
// so the builder, the mobile renderer, and stored responses all share one shape.
const mongoose = require('mongoose');
const { Schema } = mongoose;

// The field types the builder can create and the mobile app can render.
const FIELD_TYPES = [
  'short_text',    // single-line text
  'long_text',     // multi-line textarea
  'date',          // date input
  'single_choice', // radio / pick-one (e.g. Mode of delivery)
  'multi_choice',  // checkboxes / pick-many
  'yes_no',        // Yes/No toggle
  'rating',        // Likert scale (emoji faces 1..5 by default)
  'email',         // email input
  'section_header' // visual divider / non-input label
];

// Option for single_choice / multi_choice fields.
const optionSchema = new Schema({
  id:      { type: String, required: true },
  label:   { type: String, default: '' },
  labelAr: { type: String, default: '' },
  value:   { type: String, default: '' },
}, { _id: false });

// Rating scale config (defaults to the AMETI 5-point emoji Likert).
const ratingSchema = new Schema({
  min:      { type: Number, default: 1 },
  max:      { type: Number, default: 5 },
  minLabel: { type: String, default: '' },
  maxLabel: { type: String, default: '' },
  style:    { type: String, enum: ['emoji', 'number', 'star'], default: 'emoji' },
}, { _id: false });

// Conditional visibility: show this field only when another field's answer matches.
const showIfSchema = new Schema({
  fieldId: { type: String, default: '' },
  op:      { type: String, enum: ['equals', 'not_equals', 'in', 'truthy'], default: 'equals' },
  value:   { type: Schema.Types.Mixed },
}, { _id: false });

// One field in a form. `id` is a stable identifier — answers are keyed by it, so
// relabeling or reordering never orphans previously collected responses.
const feedbackFieldSchema = new Schema({
  id:         { type: String, required: true },
  type:       { type: String, enum: FIELD_TYPES, required: true },
  label:      { type: String, default: '' },
  labelAr:    { type: String, default: '' },
  helpText:   { type: String, default: '' },
  helpTextAr: { type: String, default: '' },
  placeholder:{ type: String, default: '' },
  required:   { type: Boolean, default: false },
  // Group label used to render one section per screen and to group analytics.
  section:    { type: String, default: '' },
  sectionAr:  { type: String, default: '' },
  options:    { type: [optionSchema], default: undefined },
  rating:     { type: ratingSchema, default: undefined },
  showIf:     { type: showIfSchema, default: undefined },
}, { _id: false });

// Brand colors (Warm Rounded accent by default).
const brandSchema = new Schema({
  primary:   { type: String, default: '#F0892B' },
  secondary: { type: String, default: '#4C94D8' },
}, { _id: false });

// Footer/provider details surfaced in the app.
const footerSchema = new Schema({
  org:   { type: String, default: 'Qimam Foundation' },
  email: { type: String, default: 'cpd@ksb-med.org' },
  ref:   { type: String, default: 'CPDEF.V2-2020' },
}, { _id: false });

module.exports = { FIELD_TYPES, feedbackFieldSchema, brandSchema, footerSchema };
