import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const execFile = promisify(execFileCb);

const AGENT_ID = "designer-llm";

function getOpenClawRoot() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getWorkspacePath() {
  return path.join(getOpenClawRoot(), "workspace-designer-llm");
}

export async function isOpenClawAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFile(
      "openclaw",
      ["gateway", "call", "health", "--json", "--timeout", "3000"],
      { timeout: 5000 }
    );
    const result = JSON.parse(stdout);
    return result.ok === true;
  } catch {
    return false;
  }
}

async function isAgentRegistered(): Promise<boolean> {
  try {
    const { stdout } = await execFile("openclaw", ["agents", "list", "--json"], {
      timeout: 10_000
    });
    const agents = JSON.parse(stdout) as Array<{ id: string }>;
    return agents.some((a) => a.id === AGENT_ID);
  } catch {
    return false;
  }
}

const WORKSPACE_IDENTITY = [
  "# Designer LLM",
  "",
  "Character blueprint generator for OpenClaw Friends.",
  ""
].join("\n");

const WORKSPACE_AGENTS = [
  "# Designer LLM",
  "",
  "You are a JSON generation utility for OpenClaw Friends.",
  "",
  "## Behavior",
  "",
  "- Your ONLY purpose is to receive character creation prompts and return structured JSON responses.",
  "- NEVER use tools (no read, write, exec, browser, or any other tool call).",
  "- NEVER perform web searches or file operations.",
  "- Respond with ONLY the requested JSON object. No markdown code fences, no commentary, no additional text.",
  "- Follow the output schema specified in each message precisely.",
  ""
].join("\n");

async function ensureWorkspace(): Promise<string> {
  const workspacePath = getWorkspacePath();
  await fs.mkdir(workspacePath, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(workspacePath, "IDENTITY.md"), WORKSPACE_IDENTITY, "utf8"),
    fs.writeFile(path.join(workspacePath, "AGENTS.md"), WORKSPACE_AGENTS, "utf8")
  ]);
  return workspacePath;
}

export async function ensureDesignerAgent(): Promise<void> {
  if (await isAgentRegistered()) {
    return;
  }

  const workspacePath = await ensureWorkspace();

  try {
    await execFile(
      "openclaw",
      ["agents", "add", AGENT_ID, "--workspace", workspacePath, "--non-interactive", "--json"],
      { timeout: 15_000 }
    );
  } catch {
    if (await isAgentRegistered()) {
      return;
    }
    throw new Error(`Failed to register ${AGENT_ID} agent in OpenClaw`);
  }

  try {
    await execFile("openclaw", ["gateway", "restart", "--json"], { timeout: 30_000 });
  } catch {
    // Gateway might auto-detect config changes or might not be running as a service
  }
}

export async function sendToDesignerAgent(message: string): Promise<string> {
  await ensureDesignerAgent();

  const sessionId = `designer-compose-${Date.now()}`;
  const { stdout } = await execFile(
    "openclaw",
    [
      "agent",
      "--agent", AGENT_ID,
      "--message", message,
      "--json",
      "--session-id", sessionId,
      "--timeout", "120"
    ],
    { timeout: 130_000, maxBuffer: 10 * 1024 * 1024 }
  );

  const result = JSON.parse(stdout);
  if (result.status !== "ok") {
    throw new Error(`OpenClaw agent returned status: ${result.status} (${result.summary ?? "unknown"})`);
  }

  const text = result.result?.payloads?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenClaw agent returned empty response");
  }

  return text.trim();
}
