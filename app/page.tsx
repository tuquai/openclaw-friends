import { DesignerApp } from "@/components/designer-app";
import { getUserProfile, listCharacters } from "@/lib/data";
import { getSiteMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [characters, userProfile, siteMeta] = await Promise.all([
    listCharacters(),
    getUserProfile(),
    getSiteMeta()
  ]);

  return (
    <DesignerApp
      githubUrl={siteMeta.githubUrl}
      initialCharacters={characters}
      initialUserProfile={userProfile}
      repoUpdatedAt={siteMeta.updatedAt}
    />
  );
}
