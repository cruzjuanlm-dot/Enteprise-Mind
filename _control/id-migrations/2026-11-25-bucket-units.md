# Bucket units to project units

The five sample units moved out of `units/<bucket>/<slug>/UNIT.md`. Each file is one concept. The type code is in the id. Scope stays `project`.

| Old id | Old path | New id | New path | Type | Why |
| --- | --- | --- | --- | --- | --- |
| kiln-ledger-split | units/architecture/kiln-ledger-split/UNIT.md | kilnwatch-seed-ARC-001 | projects/kilnwatch/units/kilnwatch-seed-ARC-001.md | ARC | Architecture bucket. The concept is the split between Kiln Ledger and Studio Portal. |
| studio-firing-sheet | units/design/studio-firing-sheet/UNIT.md | kilnwatch-seed-DS-001 | projects/kilnwatch/units/kilnwatch-seed-DS-001.md | DS | Design bucket. The concept is the studio firing sheet, not the system split. |
| bench-handoff-notes | units/conversations/bench-handoff-notes/UNIT.md | kilnwatch-handoff-BR-001 | projects/kilnwatch/units/kilnwatch-handoff-BR-001.md | BR | Conversation summary of a settled rule: the calibration check runs before a curve is released. It is not an open question. |
| firing-recordings-stay-out | units/decisions/firing-recordings-stay-out/UNIT.md | kilnwatch-seed-DEC-001 | projects/kilnwatch/units/kilnwatch-seed-DEC-001.md | DEC | Decision bucket. |
| calibration-check | units/procedures/calibration-check/UNIT.md | kilnwatch-seed-WF-001 | projects/kilnwatch/units/kilnwatch-seed-WF-001.md | WF | Procedure bucket. The concept is the calibration SOP. |

`ProjectID` is the catalog project id without the `project.` prefix. `SourceIDShort` is `source_id` without the `source.` prefix, with no hyphens. Sequence starts at `001` for each project, source, and type.
