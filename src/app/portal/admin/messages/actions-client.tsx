"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setContactStatus } from "../website/actions";

export function MessageActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => setContactStatus(id, "replied"))}>Mark replied</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setContactStatus(id, "archived"))}>Archive</Button>
    </div>
  );
}
