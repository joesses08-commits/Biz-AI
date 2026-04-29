"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

export default function DrivePendingPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-6">
          <Clock size={32} className="text-yellow-400" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">Google Drive</h1>
        <p className="text-text-muted mb-6">
          Google integration is pending verification. We're working with Google to complete the security review process.
        </p>
        <p className="text-text-muted text-sm mb-8">
          In the meantime, you can use <strong className="text-text-primary">Microsoft OneDrive</strong> for files.
        </p>
        <Link href="/microsoft/drive" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition">
          Use OneDrive Instead
        </Link>
      </div>
    </div>
  );
}
