// Portal pages are always rendered per request: they depend on the signed-in user.
export const dynamic = "force-dynamic";

export default function PortalRoot({ children }: { children: React.ReactNode }) {
  return children;
}
