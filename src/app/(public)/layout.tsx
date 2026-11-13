import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { SetupNotice } from "@/components/site/section";
import { getSiteSettings } from "@/lib/data/site";
import { isSupabaseConfigured } from "@/lib/env";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <SiteHeader settings={settings} />
      {!isSupabaseConfigured() && <SetupNotice />}
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
