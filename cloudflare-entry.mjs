import nextWorker from "./.open-next/worker.js";
const worker = {
  fetch: nextWorker.fetch,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const response = await env.WORKER_SELF_REFERENCE.fetch(
          new Request(`${env.APP_URL}/api/jobs`, {
            headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
          }),
        );
        console.log(
          JSON.stringify({
            event: "scheduled_notifications",
            ok: response.ok,
            status: response.status,
          }),
        );
        if (!response.ok) throw new Error("Scheduled notification job failed");
      })(),
    );
  },
};
export default worker;
