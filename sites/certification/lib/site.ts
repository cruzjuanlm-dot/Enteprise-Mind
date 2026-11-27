export const site = {
  name: "Flux",
  version: "0.1",
  status: "Draft" as const,
  updated: "2026-11-26T00:00:00Z",
  repository: "https://github.com/cruzjuanlm-dot/enteprise-mind",
};

export function commentIssueUrl(): string {
  const url = new URL(`${site.repository}/issues/new`);
  url.searchParams.set("title", "Comment on Flux Standard v0.1");
  url.searchParams.set(
    "body",
    [
      "Flux Standard v0.1 (Draft).",
      "",
      "Section:",
      "",
      "Comment:",
      "",
      "What should change:",
      "",
    ].join("\n"),
  );
  return url.toString();
}

export const primaryNav = [
  { href: "/standard", label: "Standard" },
  { href: "/courses", label: "Courses" },
  { href: "/certification", label: "Certification" },
  { href: "/implement", label: "Implement" },
  { href: "/verify", label: "Verify" },
] as const;

export const prototypeBanner =
  "Prototype. Fictional data. Not an accredited certification.";
