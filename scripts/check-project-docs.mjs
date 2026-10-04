import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const imports = [
  "AGENTS.md",
  "docs/requirements_definition.md",
  "docs/development-handoff.md",
];
const documents = [
  "CLAUDE.md",
  ...imports,
  "README.md",
  "docs/product-specification.md",
  "docs/implementation-plan.md",
  "docs/data-model.md",
  "docs/extension-design.md",
  "docs/phase-1-report.md",
];
const errors = [];
const contents = new Map();

for (const document of documents) {
  try {
    contents.set(document, await readFile(path.join(root, document), "utf8"));
  } catch {
    errors.push(`共通文書を読み取れません: ${document}`);
  }
}

const entry = contents.get("CLAUDE.md") ?? "";
const actualImports = [...entry.matchAll(/^@([^\s]+)\s*$/gm)].map(
  (match) => match[1],
);
if (JSON.stringify(actualImports) !== JSON.stringify(imports)) {
  errors.push(
    "CLAUDE.mdはAGENTS.md・要件書・引き継ぎ記録をこの順に直接インポートしてください",
  );
}
if (entry.split(/\r?\n/).length > 12) {
  errors.push(
    "CLAUDE.mdへ独立した仕様を追記せず、共通の正本を更新してください",
  );
}

for (const [document, content] of contents) {
  for (const match of content.matchAll(/`(docs\/[A-Za-z0-9_./-]+\.md)`/g)) {
    const referenced = match[1];
    const resolved = path.resolve(root, referenced);
    if (!resolved.startsWith(root)) {
      errors.push(`${document}: プロジェクト外への文書参照: ${referenced}`);
      continue;
    }
    try {
      await access(resolved);
    } catch {
      errors.push(`${document}: 存在しない文書参照: ${referenced}`);
    }
  }
}

const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
for (const command of [
  "docs:check",
  "typecheck",
  "lint",
  "test",
  "test:db",
  "test:e2e",
  "build:cloudflare",
]) {
  if (!packageJson.scripts?.[command]) {
    errors.push(`共通の検証コマンドがありません: npm run ${command}`);
  }
}

for (const document of [
  "AGENTS.md",
  "docs/requirements_definition.md",
  "README.md",
]) {
  const content = contents.get(document) ?? "";
  for (const reference of [
    "docs/requirements_definition.md",
    "docs/development-handoff.md",
  ]) {
    if (!content.includes(reference)) {
      errors.push(
        `${document}: 共通ファイルへの参照がありません: ${reference}`,
      );
    }
  }
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `共通入口・3件のインポート・${documents.length}件の文書参照・検証コマンドを確認しました。\n`,
  );
  process.stdout.write(
    "仕様の意味の一致、Claude Code実起動時の読み込み、本番状態はこの検査の対象外です。\n",
  );
}
