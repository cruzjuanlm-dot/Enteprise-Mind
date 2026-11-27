import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listCredentials, lookupCredential, resolveStatus } from "../lib/verify";

const asOf = new Date("2026-11-26T15:00:00Z");

describe("verify lookup", () => {
  it("returns empty when the field is blank", () => {
    assert.equal(lookupCredential("").kind, "empty");
    assert.equal(lookupCredential("   ").kind, "empty");
  });

  it("returns the active practitioner credential", () => {
    const result = lookupCredential("flx-p-1042", asOf);
    assert.equal(result.kind, "found");
    if (result.kind !== "found") return;
    assert.equal(result.credential.id, "FLX-P-1042");
    assert.equal(result.credential.holder, "Mara Ellison");
    assert.equal(result.tierSlug, "practitioner");
    assert.equal(result.tierName, "Practitioner");
    assert.equal(result.displayStatus, "active");
    assert.equal(result.credential.issued, "2026-03-12");
    assert.equal(result.credential.expires, "2029-03-12");
  });

  it("returns the expired steward credential from its status", () => {
    const result = lookupCredential("FLX-S-1007", asOf);
    assert.equal(result.kind, "found");
    if (result.kind !== "found") return;
    assert.equal(result.displayStatus, "expired");
    assert.equal(result.credential.holder, "C. Okonkwo");
    assert.equal(result.tierSlug, "steward");
  });

  it("returns the revoked trainer credential, even though the expiry is still ahead", () => {
    const result = lookupCredential(" FLX-T-1019 ", asOf);
    assert.equal(result.kind, "found");
    if (result.kind !== "found") return;
    assert.equal(result.displayStatus, "revoked");
    assert.equal(result.credential.expires, "2027-06-01");
    assert.equal(result.tierSlug, "trainer");
  });

  it("returns unknown for a well-formed id that is not in the sample", () => {
    const result = lookupCredential("FLX-P-0000", asOf);
    assert.deepEqual(result, { kind: "unknown", id: "FLX-P-0000" });
  });

  it("returns an error for an id the register cannot parse", () => {
    const result = lookupCredential("not-an-id", asOf);
    assert.equal(result.kind, "error");
    if (result.kind !== "error") return;
    assert.equal(result.id, "NOT-AN-ID");
  });

  it("keeps the three sample statuses and no others", () => {
    const statuses = listCredentials().map((credential) => credential.status).sort();
    assert.deepEqual(statuses, ["active", "expired", "revoked"]);
  });

  it("treats a mark as current through the expiry date and expired the next day", () => {
    assert.equal(resolveStatus("active", "2029-03-12", new Date("2029-03-12T23:00:00Z")), "active");
    assert.equal(resolveStatus("active", "2029-03-12", new Date("2029-03-13T00:00:00Z")), "expired");
    assert.equal(resolveStatus("revoked", "2029-03-12", new Date("2026-01-01T00:00:00Z")), "revoked");
    assert.equal(resolveStatus("expired", "2030-01-01", new Date("2026-01-01T00:00:00Z")), "expired");
  });

  it("shows the active sample as expired once the real expiry has passed", () => {
    const result = lookupCredential("FLX-P-1042", new Date("2030-01-01T00:00:00Z"));
    assert.equal(result.kind, "found");
    if (result.kind !== "found") return;
    assert.equal(result.displayStatus, "expired");
  });
});
