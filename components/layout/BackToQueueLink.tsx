"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToQueueLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
      &larr; Back to queue
    </Link>
  );
}
