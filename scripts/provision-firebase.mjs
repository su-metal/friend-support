// このサービス専用の実行アカウントを作成する。秘密値は画面に出さない。
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const require = createRequire(import.meta.url),
  auth = require("firebase-tools/lib/auth.js");
const account = auth.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error("Firebaseにログインしてください");
const token = await auth.getAccessToken(account.tokens.refresh_token, [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
]);
const project = "support-circle-31a09",
  email = `friend-support-worker@${project}.iam.gserviceaccount.com`;
const origin = "https://friend-support.tossy104104.workers.dev";
async function google(url, method = "GET", body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(
      `${method} ${new URL(url).pathname}: ${response.status} ${data.error?.message ?? ""}`,
    );
  }
  return response.json();
}
const serviceUrl = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
try {
  await google(serviceUrl);
} catch (e) {
  if (!e.message.includes(": 404 ")) throw e;
  await google(
    `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,
    "POST",
    {
      accountId: "friend-support-worker",
      serviceAccount: { displayName: "となりの手 Cloudflare実行用" },
    },
  );
}
const roleName = `projects/${project}/roles/friendSupportSession`;
try {
  await google(`https://iam.googleapis.com/v1/${roleName}`);
} catch (e) {
  if (!e.message.includes(": 404 ")) throw e;
  await google(
    `https://iam.googleapis.com/v1/projects/${project}/roles`,
    "POST",
    {
      roleId: "friendSupportSession",
      role: {
        title: "Friend Support Auth Session",
        description: "セッション発行と失効確認のみ",
        stage: "GA",
        includedPermissions: [
          "firebaseauth.users.get",
          "firebaseauth.users.createSession",
        ],
      },
    },
  );
}
const policyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
const policy = await google(`${policyUrl}:getIamPolicy`, "POST", {
  options: { requestedPolicyVersion: 3 },
});
policy.bindings ??= [];
for (const role of ["roles/datastore.user", roleName]) {
  let binding = policy.bindings.find((b) => b.role === role && !b.condition);
  if (!binding) {
    binding = { role, members: [] };
    policy.bindings.push(binding);
  }
  if (!binding.members.includes(`serviceAccount:${email}`))
    binding.members.push(`serviceAccount:${email}`);
}
await google(`${policyUrl}:setIamPolicy`, "POST", { policy });
await mkdir(".secrets", { recursive: true });
let key;
try {
  key = JSON.parse(
    await readFile(".secrets/firebase-service-account.json", "utf8"),
  );
  if (key.client_email !== email)
    throw new Error("実行アカウントが一致しません");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  const created = await google(`${serviceUrl}/keys`, "POST", {
    privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
    keyAlgorithm: "KEY_ALG_RSA_2048",
  });
  key = JSON.parse(Buffer.from(created.privateKeyData, "base64").toString());
  await writeFile(
    ".secrets/firebase-service-account.json",
    JSON.stringify(key),
    { mode: 0o600 },
  );
}
let previous = {};
try {
  previous = JSON.parse(await readFile(".secrets/cloudflare.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const secrets = {
  APP_SECRET: previous.APP_SECRET ?? randomBytes(32).toString("hex"),
  CRON_SECRET: previous.CRON_SECRET ?? randomBytes(32).toString("hex"),
  FIREBASE_CLIENT_EMAIL: email,
  FIREBASE_PRIVATE_KEY: key.private_key,
};
await writeFile(".secrets/cloudflare.json", JSON.stringify(secrets), {
  mode: 0o600,
});
const authUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const config = await google(authUrl);
const authorizedDomains = [
  ...new Set([...config.authorizedDomains, new URL(origin).hostname]),
];
await google(
  `${authUrl}?updateMask=authorizedDomains,signIn.email.enabled,signIn.email.passwordRequired`,
  "PATCH",
  {
    authorizedDomains,
    signIn: { email: { enabled: true, passwordRequired: false } },
  },
);
const wrangler = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
wrangler.vars.APP_URL = origin;
await writeFile("wrangler.jsonc", JSON.stringify(wrangler, null, 2) + "\n");
console.log(
  JSON.stringify({
    project,
    serviceAccount: email,
    roles: ["roles/datastore.user", roleName],
    emailLinkEnabled: true,
    origin,
    secretsSaved: true,
  }),
);
