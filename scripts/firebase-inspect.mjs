import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const auth = require("firebase-tools/lib/auth.js");
const account = auth.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error("Firebase CLIへのログインが必要です");
const token = await auth.getAccessToken(account.tokens.refresh_token, [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
]);
const project = "support-circle-31a09";
for (const [label, url] of [
  [
    "databases",
    `https://firestore.googleapis.com/v1/projects/${project}/databases`,
  ],
  [
    "auth",
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`,
  ],
  [
    "serviceAccounts",
    `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,
  ],
]) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!response.ok) {
    console.log(JSON.stringify({ label, status: response.status }));
    continue;
  }
  const data = await response.json();
  console.log(
    JSON.stringify({
      label,
      data:
        label === "databases"
          ? data.databases?.map((d) => ({
              name: d.name,
              locationId: d.locationId,
              type: d.type,
            }))
          : label === "auth"
            ? {
                emailEnabled: data.signIn?.email?.enabled,
                passwordRequired: data.signIn?.email?.passwordRequired,
                authorizedDomains: data.authorizedDomains,
              }
            : data.accounts?.map((a) => ({
                email: a.email,
                disabled: a.disabled,
              })),
    }),
  );
}
