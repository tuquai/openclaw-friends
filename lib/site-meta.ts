import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_GITHUB_URL = "https://github.com/tuquai/openclaw-friends";
const FALLBACK_META_FILES = ["app/page.tsx", "components/designer-app.tsx", "README.md", "package.json"];

export type SiteMeta = {
  githubUrl: string;
  updatedAt: string;
};

export async function getSiteMeta(): Promise<SiteMeta> {
  const [githubUrl, updatedAt] = await Promise.all([resolveGithubUrl(), resolveUpdatedAt()]);

  return {
    githubUrl,
    updatedAt
  };
}

async function resolveGithubUrl() {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: process.cwd()
    });

    return normalizeGitHubUrl(stdout.trim()) ?? DEFAULT_GITHUB_URL;
  } catch {
    return DEFAULT_GITHUB_URL;
  }
}

async function resolveUpdatedAt() {
  try {
    const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%cI"], {
      cwd: process.cwd()
    });
    const updatedAt = stdout.trim();

    if (updatedAt) {
      return updatedAt;
    }
  } catch {
    // Fall through to file mtimes when git metadata is unavailable.
  }

  const stats = await Promise.all(
    FALLBACK_META_FILES.map(async (relativePath) => {
      try {
        const file = path.join(process.cwd(), relativePath);
        return await stat(file);
      } catch {
        return null;
      }
    })
  );

  const latestMtime = stats.reduce<Date | null>((latest, entry) => {
    if (!entry) {
      return latest;
    }

    if (!latest || entry.mtime > latest) {
      return entry.mtime;
    }

    return latest;
  }, null);

  return latestMtime?.toISOString() ?? new Date().toISOString();
}

function normalizeGitHubUrl(rawUrl: string) {
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith("git@github.com:")) {
    return `https://github.com/${rawUrl.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }

  if (rawUrl.startsWith("ssh://git@github.com/")) {
    return `https://github.com/${rawUrl.slice("ssh://git@github.com/".length).replace(/\.git$/, "")}`;
  }

  if (rawUrl.startsWith("https://github.com/") || rawUrl.startsWith("http://github.com/")) {
    return rawUrl.replace(/^http:\/\//, "https://").replace(/\.git$/, "");
  }

  return null;
}
