import { PageHero, Container, RichText } from "./section";
import { mediaUrl } from "@/lib/media";
import type { SitePage } from "@/lib/data/public";

export function CmsPage({ page, eyebrow, fallbackTitle, children }: { page: SitePage | null; eyebrow: string; fallbackTitle: string; children?: React.ReactNode }) {
  const img = mediaUrl(page?.image_path);
  return (
    <>
      <PageHero eyebrow={eyebrow} title={page?.title || fallbackTitle} description={page?.summary || undefined} />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="max-w-3xl">
          {page?.body ? <RichText text={page.body} className="text-[16.5px]" /> : (
            <p className="text-muted">This page has not been written yet. Administrators can add it in Admin → Website → Pages.</p>
          )}
          {children}
        </div>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="w-full rounded-md border border-line object-cover lg:sticky lg:top-32" />
        )}
      </Container>
    </>
  );
}
