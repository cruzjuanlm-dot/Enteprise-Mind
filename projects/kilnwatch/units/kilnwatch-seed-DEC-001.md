---
id: kilnwatch-seed-DEC-001
title: Firing recordings stay out of the database
type: DEC
scope: project
project: project.kilnwatch
source_id: source.seed
version: 1
status: accepted
owner: person-role.catalog-editor
entities:
  - decision.no-recordings
  - requirement.studio-sees-own-curve
  - data-source.firing-curves
supersedes: null
---

## Decision

Hearthline does not keep firing recordings. A studio seeing its own curve does not require a stored session. The firing-curve data source is the record: curve id, studio code, peak temperature, and day.

## Consequence

Entity rows may be mirrored into Postgres later. Recording files and transcripts are out of scope for that database. This file is the governed decision, and its git history is the version log.
