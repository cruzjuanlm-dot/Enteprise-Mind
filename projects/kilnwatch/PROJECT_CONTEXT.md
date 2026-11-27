# Kilnwatch project context

## Charter

Kilnwatch is the fictional Hearthline Instruments teaching release. It shows a studio its own firing curve. The catalog editor owns the governed units.

## Scope boundaries

In scope: the Kiln Ledger bench, the Studio Portal sheet, the calibration check, and the decision to keep firing recordings out of the database.

Out of scope: audio, video, and transcript text. A meeting can leave a hash, a segment count, and speaker labels. The words are discarded after compiling.

Company scope does not move a file. A unit that becomes company-wide sets `scope: company` and a `domain` in place.

## Owners

- `person-role.catalog-editor` owns the governed units.
- `person-role.calibration-owner` owns the bench check.
- `person-role.studio-lead` opens a released curve.
