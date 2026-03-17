import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  findAssociateByName,
  parseAssociatesJson,
  upsertWorkspaceAssociate,
  writeAssociatesFile
} from "../lib/associates.ts";

test("parseAssociatesJson keeps only valid associates and sorts them by name", () => {
  const associates = parseAssociatesJson(
    JSON.stringify([
      { characterName: " Vegeta ", tuquCharacterId: " char-2 " },
      { characterName: "Krilin", tuquCharacterId: "char-1", source: "user_photo" },
      { characterName: "", tuquCharacterId: "broken" },
      { random: true }
    ])
  );

  assert.deepEqual(associates, [
    { characterName: "Krilin", tuquCharacterId: "char-1", source: "user_photo", workspacePath: undefined, createdAt: undefined, updatedAt: undefined },
    { characterName: "Vegeta", tuquCharacterId: "char-2", workspacePath: undefined, source: undefined, createdAt: undefined, updatedAt: undefined }
  ]);
  assert.equal(findAssociateByName(associates, "vegeta")?.tuquCharacterId, "char-2");
});

test("upsertWorkspaceAssociate updates a single workspace-local companion record instead of replacing the file", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "openclaw-associates-"));

  try {
    await writeAssociatesFile(workspacePath, [
      {
        characterName: "Vegeta",
        tuquCharacterId: "char-2",
        source: "manual",
        updatedAt: "2026-03-16T00:00:00.000Z"
      }
    ]);

    const first = await upsertWorkspaceAssociate(workspacePath, {
      characterName: "Krilin",
      tuquCharacterId: "char-1",
      source: "user_photo"
    });

    assert.equal(first.characterName, "Krilin");
    assert.equal(first.tuquCharacterId, "char-1");
    assert.equal(first.source, "user_photo");
    assert.ok(first.createdAt);
    assert.ok(first.updatedAt);

    const second = await upsertWorkspaceAssociate(workspacePath, {
      characterName: " krilin ",
      tuquCharacterId: "char-3",
      source: "openclaw_role",
      workspacePath: "/tmp/krilin-workspace"
    });

    assert.equal(second.characterName, "krilin");
    assert.equal(second.tuquCharacterId, "char-3");
    assert.equal(second.source, "openclaw_role");
    assert.equal(second.workspacePath, "/tmp/krilin-workspace");
    assert.equal(second.createdAt, first.createdAt);
    assert.ok(second.updatedAt);

    const raw = JSON.parse(await readFile(path.join(workspacePath, "ASSOCIATES.json"), "utf8")) as Array<{
      characterName: string;
      tuquCharacterId: string;
    }>;

    assert.deepEqual(
      raw.map((entry) => [entry.characterName, entry.tuquCharacterId]),
      [
        ["krilin", "char-3"],
        ["Vegeta", "char-2"]
      ]
    );
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});
