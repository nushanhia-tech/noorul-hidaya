import { PageHero, Container } from "@/components/site/section";
import { getGallery } from "@/lib/data/public";
import { EmptyState } from "@/components/ui/misc";
import { mediaUrl } from "@/lib/media";

export const revalidate = 300;
export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const items = await getGallery(200);
  const albums = Array.from(new Set(items.map((i) => i.album)));
  return (
    <>
      <PageHero eyebrow="Campus life" title="Gallery" description="Photographs of the campus, its people and its occasions." />
      <Container className="py-14 sm:py-20">
        {items.length === 0 && <EmptyState title="No photographs yet" description="Photographs are added in Admin → Website → Gallery." />}
        {albums.map((album) => (
          <section key={album} className="mb-14 last:mb-0">
            <h2 className="mb-5 font-display text-xl font-semibold">{album}</h2>
            <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
              {items.filter((i) => i.album === album).map((g) => (
                <figure key={g.id} className="mb-3 break-inside-avoid overflow-hidden rounded-sm border border-line bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(g.image_path)!} alt={g.title} loading="lazy" className="w-full" />
                  <figcaption className="px-3 py-2 text-[13px]"><span className="font-medium">{g.title}</span>{g.caption && <span className="block text-muted">{g.caption}</span>}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </Container>
    </>
  );
}
