import "server-only";
import { isDemoMode } from "@/lib/env";
import { FirestoreRestStore } from "@/lib/firebase/firestore-rest";
import { makeDemoStore } from "./demo";
import { SupportService } from "./support";
declare global {
  var friendSupportDemoStore: ReturnType<typeof makeDemoStore> | undefined;
}
export async function getStore() {
  if (isDemoMode())
    return (globalThis.friendSupportDemoStore ??= makeDemoStore());
  return new FirestoreRestStore();
}
export async function supportService() {
  return new SupportService(await getStore());
}
