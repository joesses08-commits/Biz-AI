"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortalDocDropperPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/plm");
  }, []);
  return null;
}
