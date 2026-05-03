"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortalRFQPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workflows/factory-quote");
  }, []);
  return null;
}
