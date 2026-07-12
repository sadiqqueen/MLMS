# Event Feedback — form schema contract

The single shape shared by the backend (`FeedbackForm` / `FeedbackFormVersion`),
the web builder, and the mobile renderer. Keep all three in sync with this doc.

## Form
```
{ id, title, titleAr, description, descriptionAr,
  brand: { primary, secondary },
  footer: { org, email, ref },
  version, status,            // status: draft | published | unpublished | archived
  fields: [Field] }
```

## Field
```
{ id,                         // stable uuid — answers are keyed by this
  type,                       // see types below
  label, labelAr,
  helpText, helpTextAr, placeholder,
  required,                   // bool
  section, sectionAr,         // group label → one screen per section in the app
  options: [ { id, label, labelAr, value } ],   // single_choice | multi_choice
  rating: { min, max, minLabel, maxLabel, style },  // rating (style: emoji|number|star)
  showIf: { fieldId, op, value } }              // op: equals | not_equals | in | truthy
```

### Field types
`short_text · long_text · date · single_choice · multi_choice · yes_no · rating · email · section_header`

## Answer values (what a response stores per field id)
| type | value |
|------|-------|
| short_text / long_text / date | string |
| email | string (validated) |
| single_choice | option `value` (string) |
| multi_choice | array of option `value`s |
| yes_no | `"yes"` \| `"no"` |
| rating | integer in `[min, max]` |
| section_header | (no answer) |

## Rules (enforced server-side in `utils/feedbackValidateResponse.js`, mirrored in mobile `src/formLogic.js`)
- Unknown field ids are stripped.
- A field hidden by `showIf` is never required and its value is not stored.
- `required` empty → validation error (422).
- Choice values must be members of the field's options; ratings must be in range; emails must match.

## Endpoints
- Public (app): `GET/POST /api/event-feedback/public/events/:code[...]`
- Admin (super_admin): `/api/event-feedback/forms`, `/api/event-feedback/events`, `/api/event-feedback/events/:id/analytics|responses|responses/export`
