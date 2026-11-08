export const FIXTURES = {
  pilotTenant: "11111111-1111-4111-8111-111111111111",
  otherTenant: "22222222-2222-4222-8222-222222222222",
  deliveryDept: "33333333-3333-4333-8333-333333333333",
  otherDept: "33333333-3333-4333-8333-333333333334",
  rolloutProject: "44444444-4444-4444-8444-444444444444",
  restrictedProject: "44444444-4444-4444-8444-444444444445",
  otherProject: "44444444-4444-4444-8444-444444444446",
  reviewer: "55555555-5555-4555-8555-555555555555",
  member: "66666666-6666-4666-8666-666666666666",
  admin: "77777777-7777-4777-8777-777777777777",
  outsider: "88888888-8888-4888-8888-888888888888",
} as const;

export const LOCAL_ACCOUNTS = [
  { id: FIXTURES.reviewer, email: "reviewer@local.test", roleLabel: "Reviewer" },
  { id: FIXTURES.member, email: "member@local.test", roleLabel: "Member" },
  { id: FIXTURES.admin, email: "admin@local.test", roleLabel: "Admin" },
  { id: FIXTURES.outsider, email: "outsider@local.test", roleLabel: "Other tenant" },
] as const;

export function findLocalAccount(emailOrId: string) {
  const needle = emailOrId.trim().toLowerCase();
  return LOCAL_ACCOUNTS.find((account) => account.email === needle || account.id === emailOrId) ?? null;
}
