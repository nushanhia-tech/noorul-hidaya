import { CmsPage } from "@/components/site/cms-page";
import { getPage } from "@/lib/data/public";

export const revalidate = 300;
export const metadata = { title: "Mission & Vision" };

export default async function MissionPage() {
  return <CmsPage page={await getPage("mission-vision")} eyebrow="About" fallbackTitle="Mission & Vision" />;
}
