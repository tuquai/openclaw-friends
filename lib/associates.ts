import { promises as fs } from "fs";
import path from "path";

export type WorkspaceAssociate = {
  characterName: string;
  tuquCharacterId: string;
  workspacePath?: string;
  source?: "user_photo" | "openclaw_role" | "manual";
  createdAt?: string;
  updatedAt?: string;
};

function normalizeAssociateName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function normalizeWorkspaceAssociate(raw: unknown): WorkspaceAssociate | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<WorkspaceAssociate>;
  const characterName = typeof candidate.characterName === "string" ? candidate.characterName.trim() : "";
  const tuquCharacterId = typeof candidate.tuquCharacterId === "string" ? candidate.tuquCharacterId.trim() : "";

  if (!characterName || !tuquCharacterId) {
    return null;
  }

  return {
    characterName,
    tuquCharacterId,
    workspacePath: typeof candidate.workspacePath === "string" && candidate.workspacePath.trim()
      ? candidate.workspacePath.trim()
      : undefined,
    source:
      candidate.source === "manual" || candidate.source === "openclaw_role" || candidate.source === "user_photo"
        ? candidate.source
        : undefined,
    createdAt: typeof candidate.createdAt === "string" && candidate.createdAt.trim() ? candidate.createdAt.trim() : undefined,
    updatedAt: typeof candidate.updatedAt === "string" && candidate.updatedAt.trim() ? candidate.updatedAt.trim() : undefined
  };
}

function sortAssociates(associates: WorkspaceAssociate[]) {
  return [...associates].sort((left, right) => left.characterName.localeCompare(right.characterName));
}

export function parseAssociatesJson(raw: string): WorkspaceAssociate[] {
  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortAssociates(
      parsed
        .map((entry) => normalizeWorkspaceAssociate(entry))
        .filter((entry): entry is WorkspaceAssociate => Boolean(entry))
    );
  } catch {
    return [];
  }
}

export function findAssociateByName(associates: WorkspaceAssociate[], name: string) {
  const normalized = normalizeAssociateName(name);
  return associates.find((associate) => normalizeAssociateName(associate.characterName) === normalized);
}

export async function readAssociatesFile(workspacePath: string): Promise<WorkspaceAssociate[]> {
  try {
    const raw = await fs.readFile(path.join(workspacePath, "ASSOCIATES.json"), "utf8");
    return parseAssociatesJson(raw);
  } catch {
    return [];
  }
}

export async function writeAssociatesFile(workspacePath: string, associates: WorkspaceAssociate[] = []) {
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, "ASSOCIATES.json"),
    JSON.stringify(sortAssociates(associates), null, 2),
    "utf8"
  );
}

export async function upsertWorkspaceAssociate(
  workspacePath: string,
  associate: Omit<WorkspaceAssociate, "createdAt" | "updatedAt"> & Partial<Pick<WorkspaceAssociate, "createdAt" | "updatedAt">>
) {
  const existing = await readAssociatesFile(workspacePath);
  const match = findAssociateByName(existing, associate.characterName);
  const now = new Date().toISOString();
  const next: WorkspaceAssociate = {
    ...match,
    ...associate,
    characterName: associate.characterName.trim(),
    tuquCharacterId: associate.tuquCharacterId.trim(),
    createdAt: match?.createdAt ?? associate.createdAt ?? now,
    updatedAt: associate.updatedAt ?? now
  };

  const remaining = existing.filter(
    (entry) => normalizeAssociateName(entry.characterName) !== normalizeAssociateName(associate.characterName)
  );
  const associates = sortAssociates([...remaining, next]);
  await writeAssociatesFile(workspacePath, associates);
  return next;
}
