import { readFile } from "node:fs/promises";
import path from "node:path";
const configPath = path.join(
  process.env.APPDATA,
  "xdg.config",
  ".wrangler",
  "config",
  "default.toml",
);
const config = await readFile(configPath, "utf8");
const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error("Wranglerのログイン情報が必要です");
const accountId = "352ede2243e00fc85ff3285c54c3075d";
for (const [label, uri] of [
  ["subdomain", `accounts/${accountId}/workers/subdomain`],
  ["worker", `accounts/${accountId}/workers/services/friend-support`],
]) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/${uri}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  console.log(
    JSON.stringify({
      label,
      status: response.status,
      ...(label === "subdomain"
        ? { subdomain: data.result?.subdomain }
        : { exists: response.ok }),
    }),
  );
}
