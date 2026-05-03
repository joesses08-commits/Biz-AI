"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortalRFQPage() {
  const router = useRouter();
  useEffect(() => {
    // RFQ workflow is admin-only for now, redirect back
    router.push("/portal/dashboard?role=designer");
  }, []);
  return null;
}
