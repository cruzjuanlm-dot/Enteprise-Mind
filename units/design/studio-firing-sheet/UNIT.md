---
id: studio-firing-sheet
title: Studio firing sheet
bucket: design
version: 1
status: accepted
owner: person-role.catalog-editor
entities:
  - system.studio-portal
  - use-case.instructor-opens-curve
  - table-schema.firing-curve
supersedes: null
---

## What the sheet shows

The studio firing sheet is one screen in Studio Portal. It shows the curve id, the studio code, the peak temperature, and the day the curve was logged. Those are the columns on the firing-curve table.

## What the sheet leaves out

There is no control for playing a recording, and no list of people who were in the room. The instructor use case ends when the curve is on screen.

The catalog editor role owns this layout. The git history of this file is the version log.
