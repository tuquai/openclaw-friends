import { DesignerApp } from "@/components/designer-app";
import { listCharacters } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const characters = await listCharacters();

  return <DesignerApp initialCharacters={characters} />;
}
