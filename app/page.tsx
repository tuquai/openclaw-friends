import { DesignerApp } from "@/components/designer-app";
import { getUserProfile, listCharacters } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [characters, userProfile] = await Promise.all([listCharacters(), getUserProfile()]);

  return <DesignerApp initialCharacters={characters} initialUserProfile={userProfile} />;
}
