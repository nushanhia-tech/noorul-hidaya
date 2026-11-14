import { Paperclip, Lock } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { formatDateTime, formatBytesSafe } from "@/lib/format-extra";
import { cn } from "@/lib/utils";

export type ThreadMessage = { id: string; body: string; created_at: string; is_internal?: boolean; author_id: string | null; author?: { full_name: string } | null };
export type Attachment = { id: string; file_name: string; size_bytes: number; created_at: string };

/** Conversation timeline used by help desk tickets and parent messages. */
export function Thread({ messages, me, requesterId, staffLabel = "School office" }: { messages: ThreadMessage[]; me: string; requesterId?: string; staffLabel?: string }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = m.author_id === me;
        const fromRequester = requesterId ? m.author_id === requesterId : mine;
        return (
          <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
            <Avatar name={m.author?.full_name ?? staffLabel} size={32} />
            <div className={cn("max-w-[85%] rounded-md border px-4 py-3 sm:max-w-[75%]",
              m.is_internal ? "border-warning/30 bg-warning-50" : fromRequester ? "border-line bg-white" : "border-royal/15 bg-royal-50/60")}>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="font-medium text-ink-soft">{m.author?.full_name ?? staffLabel}</span>
                <span>{formatDateTime(m.created_at)}</span>
                {m.is_internal && <span className="inline-flex items-center gap-1 font-medium text-warning"><Lock className="h-3 w-3" /> Internal note</span>}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AttachmentList({ items }: { items: Attachment[] }) {
  if (!items.length) return <p className="text-sm text-muted">No attachments.</p>;
  return (
    <ul className="divide-y divide-line rounded-sm border border-line bg-white">
      {items.map((a) => (
        <li key={a.id}>
          <a href={`/api/documents/${a.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-ivory">
            <Paperclip className="h-4 w-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
            <span className="shrink-0 text-xs text-muted">{formatBytesSafe(a.size_bytes)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
