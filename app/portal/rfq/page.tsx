"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Upload, FileSpreadsheet } from "lucide-react";

export default function PortalRFQPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalUser, setPortalUser] = useState<any>(null);

  const token = () => localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user") || localStorage.getItem("portal_user_designer") || "{}");
    setPortalUser(user);
    load();
  }, []);

  const load = async () => {
    const res = await fetch("/api/portal/rfq", { headers: { Authorization: "Bearer " + token() } });
    const data = await res.json();
    setJobs(data.jobs || []);
    setLoading(false);
  };

  const STATUS_COLORS: Record<string,string> = {
    draft: "text-text-muted", rfq_sent: "text-blue-400", complete: "text-emerald-400"
  };
  const STATUS_LABELS: Record<string,string> = {
    draft: "Draft", rfq_sent: "RFQs Sent", complete: "Complete"
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6">
      <button onClick={() => router.push("/portal/dashboard?role=designer")}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary text-xs mb-6 transition">
        <ArrowLeft size={14} />Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold mb-1">RFQ Workflow</h1>
          <p className="text-xs text-text-muted">Factory quote requests and responses</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <FileSpreadsheet size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No quote jobs yet</p>
          <p className="text-xs mt-1">Your admin creates RFQ jobs and factories respond here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <div key={job.id} className="border border-bg-border rounded-2xl p-4 bg-bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{job.job_name}</p>
                  <p className="text-xs text-text-muted">{new Date(job.created_at).toLocaleDateString()} · Created by {job.created_by_name || "Admin"}</p>
                </div>
                <span className={"text-xs font-semibold " + (STATUS_COLORS[job.status] || "text-text-muted")}>
                  {STATUS_LABELS[job.status] || job.status}
                </span>
              </div>
              <div className="text-xs text-text-muted">
                Quotes received: {(job.factory_quote_responses || []).length} / {(job.factories || []).length} factories
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
