import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CmsPage } from "@/components/site/cms-page";
import { getPage } from "@/lib/data/public";

export const revalidate = 300;
export const metadata = { title: "About the College" };

export default async function AboutPage() {
  const page = await getPage("about");
  return (
    <CmsPage page={page} eyebrow="About" fallbackTitle="About the College">
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {[["Mission & Vision", "/about/mission-vision"], ["Administration", "/about/administration"], ["Departments", "/departments"], ["Programmes", "/programmes"]].map(([l, h]) => (
          <Link key={h} href={h} className="group flex items-center justify-between rounded-md border border-line bg-paper px-5 py-4 font-medium hover:border-line-strong">
            {l} <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        ))}
      </div>
    </CmsPage>
  );
}
