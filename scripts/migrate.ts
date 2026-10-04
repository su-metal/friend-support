import { readFile } from "node:fs/promises";
import { FirestoreRestStore } from "@/lib/firebase/firestore-rest";
import { categories, caseTemplates, pricing } from "@/config/product";
async function main() {
  const saved = JSON.parse(await readFile(".secrets/cloudflare.json", "utf8"));
  Object.assign(process.env, saved, {
    FIREBASE_PROJECT_ID: "support-circle-31a09",
  });
  const store = new FirestoreRestStore();
  const migrated = await store.transaction(async (tx) => {
    if (await tx.get("schema_versions/v1")) return false;
    categories.forEach((c) =>
      tx.set(`support_categories/${c.id}`, { ...c, active: true }),
    );
    caseTemplates.forEach((t) => tx.set(`case_templates/${t.id}`, { ...t }));
    tx.set("config/pricing", { ...pricing });
    tx.set("schema_versions/v1", {
      version: 1,
      createdAt: new Date().toISOString(),
      description: "Phase 1 categories and template",
    });
    return true;
  });
  console.log(
    JSON.stringify({
      migrated,
      version: 1,
      categories: categories.length,
      templates: caseTemplates.length,
    }),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "移行に失敗しました");
  process.exitCode = 1;
});
