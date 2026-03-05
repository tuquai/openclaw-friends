import { listCharacters } from "../lib/data";
import { syncWorkspaceSkills } from "../lib/workspace";

async function main() {
  const characters = await listCharacters();

  for (const character of characters) {
    if (!character.workspacePath) {
      console.log(`⏭  ${character.name} — no workspace, skipping`);
      continue;
    }

    try {
      await syncWorkspaceSkills(character);
      console.log(`✅ ${character.name} — synced skills to ${character.workspacePath}`);
    } catch (error) {
      console.error(`❌ ${character.name} — ${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch(console.error);
