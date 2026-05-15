"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { showBackButton, hapticImpact } from "../lib/telegram";

export default function TgBackButton() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (path === "/") return;
    const off = showBackButton(() => {
      hapticImpact("light");
      router.back();
    });
    return off;
  }, [path, router]);

  return null;
}
