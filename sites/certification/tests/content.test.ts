import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { catalogIssues } from "../lib/catalog";
import { directoryIssues } from "../lib/directory";
import { repositoryUnitPath, vendoredUnitPath } from "../lib/example-unit";
import { getPhases } from "../lib/phases";
import { renderMarkdown } from "../lib/markdown";
import { standardIssues } from "../lib/standard";

describe("catalog and standard", () => {
  it("keeps courses and tiers on one join", () => {
    assert.deepEqual(catalogIssues(), []);
  });

  it("keeps the standard on v0.1 Draft, with a version history", () => {
    assert.deepEqual(standardIssues(), []);
  });

  it("only lists active credentials in the directory", () => {
    assert.deepEqual(directoryIssues(), []);
  });

  it("ships a worksheet for every phase artifact", () => {
    for (const phase of getPhases()) {
      assert.ok(phase.downloads.length > 0, phase.slug);
      for (const download of phase.downloads) {
        const file = path.join(process.cwd(), "public", download.href);
        assert.equal(fs.existsSync(file), true, download.href);
      }
    }
  });

  it("keeps the vendored Kilnwatch unit identical to the repository file", () => {
    const repo = repositoryUnitPath();
    assert.equal(fs.existsSync(repo), true);
    assert.equal(fs.readFileSync(vendoredUnitPath(), "utf8"), fs.readFileSync(repo, "utf8"));
  });

  it("escapes raw html in markdown", () => {
    const html = renderMarkdown("<script>alert(1)</script>\n\nSee [the cycle](/value-cycle).");
    assert.equal(html.includes("<script>"), false);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /href="\/value-cycle"/);
    assert.equal(html.includes("javascript:"), false);
  });

  it("renders the version history table", () => {
    const html = renderMarkdown(
      "| Version | Status |\n| --- | --- |\n| 0.1 | Draft |\n",
    );
    assert.match(html, /<table>/);
    assert.match(html, /<th>Version<\/th>/);
    assert.match(html, /<td>Draft<\/td>/);
  });
});
