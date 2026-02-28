"use client";

export function Skeleton({
  className = "",
  circle = false,
}: {
  className?: string;
  circle?: boolean;
}) {
  return (
    <div
      className={`animate-pulse bg-[var(--surface-hover)] ${circle ? "rounded-full" : "rounded-[var(--radius)]"} ${className}`}
    />
  );
}

export function ConversationListSkeleton() {
  return (
    <ul className="flex flex-col gap-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0" circle />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-start">
        <Skeleton className="h-14 w-48 rounded-2xl rounded-bl-md" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-40 rounded-2xl rounded-br-md" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-10 w-56 rounded-2xl rounded-bl-md" />
      </div>
    </div>
  );
}
