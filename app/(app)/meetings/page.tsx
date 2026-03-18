"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, RefreshCw, Users, Calendar, CheckSquare, ChevronDown, ChevronUp, FileText } from "lucide-react";

type ActionItem = {
  title: string;
  detail: string;
  assigned_to: string;
  due_date: string;
  priority: string;
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  duration_minutes: number;
  participants: string[];
  summary: string;
  decisions: string[];
  action_items_extracted: ActionItem[];
  source: string;
  created_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  zoom: "Zoom",
  manual: "Manual Upload",
};

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };

  const priorityColors: Record<string, string> = {
    critical: "text-red-400",
    high: "text-amber-400",
    medium: "text-blue-400",
    low: "text-white/30",
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/10 transition">
      <div className="p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white truncate">{meeting.title}</h3>
              <span className="text-[10px] text-white/25 border border-white/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {SOURCE_LABELS[meeting.source] || meeting.source}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-white/30 mb-3">
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(meeting.date)}
              </div>
              {meeting.duration_minutes && (
                <span>{meeting.duration_minutes} min</span>
              )}
              {meeting.participants?.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users size={10} />
                  {meeting.participants.slice(0, 3).join(", ")}
                  {meeting.participants.length > 3 && ` +${meeting.participants.length - 3}`}
                </div>
              )}
            </div>
            <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{meeting.summary}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {meeting.action_items_extracted?.length > 0 && (
              <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                <CheckSquare size={10} className="text-blue-400" />
                <span className="text-[10px] text-blue-400">{meeting.action_items_extracted.length} actions</span>
              </div>
            )}
            {expanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] p-5 space-y-5">

          {/* Decisions */}
          {meeting.decisions?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Decisions Made</p>
              <div className="space-y-2">
                {meeting.decisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-white/60 leading-relaxed">{d}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {meeting.action_items_extracted?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
                Action Items — Added to Tracker
              </p>
              <div className="space-y-2">
                {meeting.action_items_extracted.map((item, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-xs font-medium ${priorityColors[item.priority] || "text-white/70"}`}>
                        {item.title}
                      </p>
                      {item.assigned_to && (
                        <span className="text-[10px] text-white/25 flex-shrink-0">{item.assigned_to}</span>
                      )}
                    </div>
                    {item.detail && <p className="text-[11px] text-white/30">{item.detail}</p>}
                    {item.due_date && (
                      <p className="text-[10px] text-white/20 mt-1">Due: {item.due_date}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          {meeting.participants?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Participants</p>
              <div className="flex flex-wrap gap-2">
                {meeting.participants.map((p, i) => (
                  <span key={i} className="text-[11px] text-white/40 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanningTeams, setScanningTeams] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMeetings(); }, []);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meetings");
      const data = await res.json();
      setMeetings(data.meetings || []);
    } catch {}
    setLoading(false);
  };

  const scanDrive = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/meetings/scan", { method: "POST" });
      const data = await res.json();
      if (data.processed > 0) {
        setScanResult(`Found ${data.new_found} new meetings, processed ${data.processed}`);
        await loadMeetings();
      } else if (data.new_found === 0) {
        setScanResult("No new Google Meet transcripts found in your Drive");
      } else {
        setScanResult(`Found ${data.new_found} transcripts but none could be processed`);
      }
    } catch {
      setScanResult("Failed to scan Drive");
    }
    setScanning(false);
  };

  const scanTeams = async () => {
    setScanningTeams(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/meetings/scan-teams", { method: "POST" });
      const data = await res.json();
      if (data.processed > 0) {
        setScanResult(`Teams: Found ${data.new_found} new transcripts, processed ${data.processed}`);
        await loadMeetings();
      } else if (data.new_found === 0) {
        setScanResult("No new Teams transcripts found in OneDrive");
      } else {
        setScanResult(`Teams: Found ${data.new_found} transcripts but none could be processed`);
      }
    } catch {
      setScanResult("Failed to scan Teams");
    }
    setScanningTeams(false);
  };

  const processTranscript = async () => {
    if (!transcript.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, title: meetingTitle, source: "manual" }),
      });
      const data = await res.json();
      if (data.meeting) {
        setMeetings(prev => [data.meeting, ...prev]);
        setTranscript("");
        setMeetingTitle("");
        setShowUpload(false);
        setScanResult(`Meeting processed — ${data.action_items_created} action items added to tracker`);
      }
    } catch {}
    setProcessing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setTranscript(text);
    setMeetingTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Meeting Intelligence</h1>
            <p className="text-white/30 text-sm">
              {meetings.length} meetings processed · Action items auto-added to tracker
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={scanTeams} disabled={scanningTeams}
              className="flex items-center gap-2 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition disabled:opacity-40">
              <RefreshCw size={12} className={scanningTeams ? "animate-spin" : ""} />
              {scanningTeams ? "Scanning..." : "Scan Teams"}
            </button>
            <button onClick={scanDrive} disabled={scanning}
              className="flex items-center gap-2 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition disabled:opacity-40">
              <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
              {scanning ? "Scanning..." : "Scan Google Meet"}
            </button>
            <button onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 text-xs text-black bg-white hover:bg-white/90 px-3 py-2 rounded-xl transition font-semibold">
              <Upload size={12} />
              Upload Transcript
            </button>
          </div>
        </div>

        {/* Scan result */}
        {scanResult && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-6 text-xs text-blue-300">
            {scanResult}
          </div>
        )}

        {/* How it works — shown when no meetings */}
        {meetings.length === 0 && !loading && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 mb-6">
            <h3 className="text-sm font-semibold text-white mb-4">How Meeting Intelligence Works</h3>
            <div className="space-y-3">
              {[
                { step: "1", text: "Record your Google Meet or Microsoft Teams meeting with transcription enabled" },
                { step: "2", text: "Click 'Scan Google Meet' or 'Scan Teams' — BizAI finds and processes transcripts automatically" },
                { step: "3", text: "Action items are automatically added to your Action Tracker" },
                { step: "4", text: "Meeting summaries and decisions are saved to your AI's memory" },
                { step: "5", text: "Paste any transcript manually using 'Upload Transcript'" },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white/50">
                    {item.step}
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <p className="text-xs text-amber-300/70">
                <span className="font-semibold text-amber-300">Google Meet:</span> During a meeting, click Activities → Transcripts → Start Transcript. <span className="font-semibold text-amber-300 ml-2">Microsoft Teams:</span> Click More → Record & Transcribe → Start Transcription. Both save automatically.
              </p>
            </div>
          </div>
        )}

        {/* Upload transcript */}
        {showUpload && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6 space-y-4">
            <h3 className="text-sm font-semibold">Process a Transcript</h3>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Meeting Title</label>
              <input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)}
                placeholder="e.g. Q1 Sales Review, Client Kickoff Call"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-white/30 uppercase tracking-widest">Transcript</label>
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white border border-white/10 px-2 py-1 rounded-lg transition">
                  <FileText size={10} /> Upload file
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".txt,.doc,.docx,.vtt" onChange={handleFileUpload} className="hidden" />
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here... or upload a .txt file above"
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/20 resize-none leading-relaxed" />
              <p className="text-[10px] text-white/20 mt-1">{transcript.length} characters</p>
            </div>
            <div className="flex gap-2">
              <button onClick={processTranscript} disabled={processing || !transcript.trim()}
                className="text-xs text-black bg-white hover:bg-white/90 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-30">
                {processing ? "Processing..." : "Process Meeting"}
              </button>
              <button onClick={() => { setShowUpload(false); setTranscript(""); setMeetingTitle(""); }}
                className="text-xs text-white/40 hover:text-white border border-white/10 px-4 py-2 rounded-xl transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Meetings list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-white/[0.02] border border-white/[0.05] rounded-2xl animate-pulse" />)}
          </div>
        ) : meetings.length > 0 ? (
          <div className="space-y-3">
            {meetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} />)}
          </div>
        ) : null}

      </div>
    </div>
  );
}
