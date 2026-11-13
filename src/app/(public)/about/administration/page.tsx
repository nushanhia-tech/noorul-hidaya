import { CmsPage } from "@/components/site/cms-page";
import { getLeadership, getPage } from "@/lib/data/public";
import { Avatar } from "@/components/ui/misc";
import { mediaUrl } from "@/lib/media";

export const revalidate = 300;
export const metadata = { title: "Administration" };

export default async function AdministrationPage() {
  const [page, leaders] = await Promise.all([getPage("administration"), getLeadership()]);
  return (
    <CmsPage page={page} eyebrow="About" fallbackTitle="Administration">
      {leaders.length > 0 && (
        <div className="mt-12 space-y-4">
          {leaders.map((l) => (
            <article key={l.id} className="flex flex-col gap-5 rounded-md border border-line bg-paper p-6 sm:flex-row">
              <Avatar name={l.name} src={mediaUrl(l.photo_path)} size={72} />
              <div>
                <h2 className="font-display text-lg font-semibold">{l.name}</h2>
                <p className="text-sm text-accent-600">{l.designation}</p>
                {l.message && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{l.message}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </CmsPage>
  );
}
