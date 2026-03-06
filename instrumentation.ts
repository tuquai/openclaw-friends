export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { isOpenClawAvailable, ensureDesignerAgent } = await import("@/lib/openclaw-agent");
    if (await isOpenClawAvailable()) {
      try {
        await ensureDesignerAgent();
        console.log("[instrumentation] designer-llm agent ready");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(`[instrumentation] Failed to ensure designer-llm agent: ${detail}`);
      }
    } else {
      console.log("[instrumentation] OpenClaw Gateway not available, skipping designer-llm agent setup");
    }
  }
}
