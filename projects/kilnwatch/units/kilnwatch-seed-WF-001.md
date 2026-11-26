---
id: kilnwatch-seed-WF-001
title: Calibration check procedure
type: WF
scope: project
project: project.kilnwatch
source_id: source.seed
version: 1
status: accepted
owner: person-role.calibration-owner
entities:
  - workflow.calibration-check
  - environment.kiln-ledger-bench
  - person-role.calibration-owner
  - system.kiln-ledger
supersedes: null
---

## Purpose

This procedure is the how-to for the calibration check. It is an SOP for the bench, not a glossary entry.

## Steps

- Confirm the bench environment is the one attached to Kiln Ledger.
- Run the calibration check workflow before releasing a curve.
- Record the peak temperature on the firing curve. Do not record voices or video.
- Leave the curve unreleased if the check does not finish.

The calibration owner role performs the check. The git history of this file is the version log.
