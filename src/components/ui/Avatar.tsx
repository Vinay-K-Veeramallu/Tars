"use client";

export function Avatar({
  src,
  name,
  size = "md",
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  };
  const s = sizeClasses[size];
  const initial = name?.charAt(0)?.toUpperCase() ?? "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ring-2 ring-[var(--border)] ${s} ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] font-semibold text-[var(--accent)] ring-2 ring-[var(--border)] backdrop-blur-sm ${s} ${className}`}
    >
      {initial}
    </div>
  );
}
