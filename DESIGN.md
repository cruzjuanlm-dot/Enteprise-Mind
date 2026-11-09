# Enterprise Mind design

Status: adopted in the application theme (`src/app/globals.css`) and the review demo screens.
Light theme only. Source contract: the product design notes for this pilot. Tokens below are the values components use.

## Decisions

1. Audience and job: a reviewer turns a meeting transcript into evidence-backed knowledge, accepts or rejects each proposal, and publishes only accepted units as shared context.
2. Character: composed, precise, accountable. A working reference desk.
3. Visual vocabulary: company / department / project scope, a quoted passage beside the extracted statement, and labeled review states.
4. Attention: the proposal under review and its source quotation. Accept is the leading action. Reject is explicit and separate.
5. Identifying detail: the evidence rail. Unknown fields stay unknown. Fixture previews are labeled as not stored.

## Color

Components use these semantic names. Do not introduce a second accent.

| Token | Value | Role |
| --- | --- | --- |
| canvas | #F8FAFC | App background |
| surface | #FFFFFF | Panels |
| surface-subtle | #F1F5F9 | Hover and grouped regions |
| text-primary | #0F172A | Titles and body |
| text-secondary | #475569 | Support text, and metadata on a selection fill |
| text-muted | #64748B | Metadata on white or canvas |
| border-subtle | #CBD5E1 | Dividers |
| border-control | #64748B | Control boundaries |
| action / hover / pressed | #0F766E / #115E59 / #134E4A | Primary action and the evidence marker |
| on-action | #FFFFFF | Primary label |
| selection | #CCFBF1 | Selected row, with an action-colored marker |
| focus | #1D4ED8 | 2px ring, 2px offset |
| success | #166534 / #F0FDF4 | Accepted |
| warning | #92400E / #FFFBEB | Missing fields, running work |
| danger | #991B1B / #FEF2F2 | Rejected, failed, destructive |
| info | #1E40AF / #EFF6FF | Proposed, explanation |
| disabled | #64748B / #E2E8F0 | Disabled controls, no extra opacity |

Pair each hue with its label. Selection is not success. Ready for review is not accepted.

## Type

Geist Sans, then system-ui. Geist Mono for ids. Tabular figures for counts and times.

| Style | Size / line height | Weight |
| --- | --- | --- |
| Page title | 1.5rem / 2rem | 600 |
| Section title | 1.125rem / 1.75rem | 600 |
| Body | 1rem / 1.5rem | 400 |
| Controls | 0.875rem / 1.25rem | 500 |
| Metadata | 0.75rem / 1.125rem | 400 |

Sentence case. Timestamps include the timezone. Confidence stays “not assessed.”

## Layout

Page padding 24px, 16px below 768px. Panel padding 16px. Section gap 24px. Control gap 8px.
From 1200px: 248px navigation and a 360px evidence rail. Below that, navigation is a drawer and the rail stacks under the statement.
Touch targets are at least 44px. Rows are at least 48px and may grow. Prose stays within 72ch. Radius is 8px for panels, 6px for controls, and 4px for status labels. No ambient shadow. The drawer uses `0 8px 24px rgb(15 23 42 / 0.12)`.
Motion is 180ms on the drawer transform only, and off under reduced motion.

## Product rules

Demo fixtures and live records are labeled differently. The synthetic company is Hearthline Instruments (Field Systems / Sensor firmware review, plus Calibration vault for admins). Bramble Civic Works is the other tenant. No production customer data.
The end-to-end path runs on the deterministic reader when no model key is set.
Accept publishes a unit into project context. Reject keeps it out. Neither executes work.
