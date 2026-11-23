---
id: kiln-ledger-split
title: Kiln Ledger and Studio Portal stay separate
bucket: architecture
version: 1
status: accepted
owner: person-role.catalog-editor
entities:
  - system.kiln-ledger
  - system.studio-portal
  - system.glaze-notebook
  - integration.ledger-to-portal
supersedes: null
---

## Two products, one bench

Hearthline Instruments builds Kilnwatch, a bench instrument for teaching studios that fire ceramics. The software around the instrument is split so a studio view cannot edit the bench log.

Kiln Ledger keeps firing curves. Studio Portal shows a studio the curves it is allowed to see. Glaze Notebook is a proposed notebook for glaze recipes and is not on this path.

## The only hop

integration.ledger-to-portal carries the firing-curve data source from Kiln Ledger to Studio Portal. It does not carry audio, video, or a written record of anyone speaking.

Git holds this description. A later job may copy the system rows into Postgres. The git history of this file is the version log.
