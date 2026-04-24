"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Paperclip, X, Pin, PinOff } from "lucide-react";

export default function DesignerMessagesPage() {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalUser, setPortalUser] = useState<any>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{file: File, url: string, type: string} | null>(null);
  const [firstUnread, setFirstUnread] = useState(-1);
  const [pinnedChats, setPinnedChats] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = () => localStorage.getItem("portal_token") || "";

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user") || "{}");
    setPortalUser(user);
    loadChats();
  }, []);

  const loadChats = async () => {
    const res = await fetch("/api/portal/designer/messages", { headers: { Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") } });
    const data = await res.json();
    setChats(data.chats || []);
    const pins = new Set<string>((data.pinned || []).map((p: any) => p.track_id));
    setPinnedChats(pins);
    setLoading(false);
  };

  const openChat = async (chat: any) => {
    setActiveChat(chat);
    if (pollRef.current) clearInterval(pollRef.current);
    const fetchMsgs = async (isFirst?: boolean) => {
      const res = await fetch("/api/portal/designer/messages", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
        body: JSON.stringify({ action: "get_messages", track_id: chat.track_id }) });
      const data = await res.json();
      const msgs = data.messages || [];
      setMessages(prev => {
        // Only scroll to bottom on first load, not on polls
        if (isFirst) {
          setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 150);
          setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 600);
        }
        return msgs;
      });
      if (isFirst) {
        const idx = msgs.findIndex((m: any) => m.sender_role !== "designer" && !m.read_by_designer);
        setFirstUnread(idx);
      }
      setChats(prev => prev.map(c => c.track_id === chat.track_id ? { ...c, unread_count: 0 } : c));
    };
    await fetchMsgs(true);
    pollRef.current = setInterval(() => fetchMsgs(false), 3000);
  };

  const sendMessage = async (text?: string, attachmentUrl?: string, attachmentType?: string, attachmentName?: string) => {
    const msg = text !== undefined ? text : newMessage.trim();
    if (!msg && !attachmentUrl) return;
    setSending(true);
    await fetch("/api/portal/designer/messages", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
      body: JSON.stringify({ action: "send_message", track_id: activeChat.track_id, product_id: activeChat.product_id, message: msg, attachment_url: attachmentUrl, attachment_type: attachmentType, attachment_name: attachmentName }) });
    setNewMessage("");
    const res = await fetch("/api/portal/designer/messages", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
      body: JSON.stringify({ action: "get_messages", track_id: activeChat.track_id }) });
    const data = await res.json();
    setMessages(data.messages || []);
    setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 100);
    setSending(false);
    loadChats();
  };

  const handleFile = (file: File) => {
    setAttachmentPreview({ file, url: URL.createObjectURL(file), type: file.type.startsWith("image/") ? "image" : "file" });
  };

  const uploadAndSend = async () => {
    if (!attachmentPreview) return;
    setSending(true);
    const formData = new FormData();
    formData.append("file", attachmentPreview.file);
    const res = await fetch("/api/messages/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) await sendMessage(newMessage, data.url, attachmentPreview.type, attachmentPreview.file.name);
    setAttachmentPreview(null);
    setSending(false);
  };

  const togglePin = async (chat: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPinned = pinnedChats.has(chat.track_id);
    await fetch("/api/portal/designer/messages", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
      body: JSON.stringify({ action: isPinned ? "unpin" : "pin", track_id: chat.track_id }) });
    const newPinned = new Set(pinnedChats);
    isPinned ? newPinned.delete(chat.track_id) : newPinned.add(chat.track_id);
    setPinnedChats(newPinned);
  };

  const sortedChats = [...chats].sort((a, b) => {
    const aPin = pinnedChats.has(a.track_id) ? 0 : 1;
    const bPin = pinnedChats.has(b.track_id) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return new Date(b.latest_message?.created_at || 0).getTime() - new Date(a.latest_message?.created_at || 0).getTime();
  });

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <button onClick={() => router.push("/portal/dashboard")} className="text-white/30 hover:text-white/60"><ArrowLeft size={14} /></button>
          <p className="text-sm font-semibold">Messages</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="text-xs text-white/20 text-center py-8">Loading...</p> :
           sortedChats.length === 0 ? <p className="text-xs text-white/20 text-center py-8">No messages yet</p> :
           sortedChats.map(chat => (
            <div key={chat.track_id} onClick={() => openChat(chat)}
              className={`px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-white/[0.02] transition border-b border-white/[0.03] ${activeChat?.track_id === chat.track_id ? "bg-white/[0.04]" : ""}`}>
              {chat.product_image ? <img src={chat.product_image} className="w-10 h-10 rounded-xl object-cover border border-white/[0.06] flex-shrink-0" /> :
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0"><span className="text-white/20 text-xs">📦</span></div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold truncate">{chat.product_name}</p>
                  {chat.unread_count > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-1">{chat.unread_count}</span>}
                </div>
                <p className="text-[10px] text-white/30 truncate">{chat.factory_name}</p>
                {chat.latest_message && <p className="text-[10px] text-white/20 truncate">{chat.latest_message.sender_name}: {chat.latest_message.message || "📎 Attachment"}</p>}
              </div>
              <button onClick={e => togglePin(chat, e)} className="text-white/20 hover:text-white/50 flex-shrink-0">
                {pinnedChats.has(chat.track_id) ? <PinOff size={11} /> : <Pin size={11} />}
              </button>
            </div>
           ))}
        </div>
      </div>

      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3 flex-shrink-0">
            {activeChat.product_image ? <img src={activeChat.product_image} className="w-9 h-9 rounded-xl object-cover border border-white/[0.06]" /> :
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"><span className="text-xs">📦</span></div>}
            <div>
              <p className="text-sm font-semibold">{activeChat.product_name}</p>
              <p className="text-[11px] text-white/40">{activeChat.factory_name} · {activeChat.product_sku}</p>
            </div>
          </div>
          <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-3">
            {messages.map((msg: any, idx: number) => {
              const isMe = msg.sender_role === "designer";
              return (
                <div key={msg.id}>
                  {idx === firstUnread && firstUnread > 0 && (
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-blue-500/30" />
                      <span className="text-[10px] text-blue-400 font-semibold">{messages.length - firstUnread} new</span>
                      <div className="flex-1 h-px bg-blue-500/30" />
                    </div>
                  )}
                  <div className={isMe ? "flex justify-end" : "flex justify-start"}>
                    <div className={isMe ? "bg-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[70%]" : "bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[70%]"}>
                      <p className="text-[10px] font-semibold text-white/40 mb-1">{msg.sender_name}</p>
                      {msg.message && <p className="text-sm text-white/80">{msg.message}</p>}
                      {msg.attachment_url && msg.attachment_type === "image" && <img src={msg.attachment_url} className="mt-2 max-w-xs rounded-xl border border-white/10 cursor-pointer" onClick={() => window.open(msg.attachment_url, "_blank")} />}
                      {msg.attachment_url && msg.attachment_type === "file" && <a href={msg.attachment_url} target="_blank" className="mt-2 flex items-center gap-2 text-xs text-blue-400"><Paperclip size={11} />{msg.attachment_name || "File"}</a>}
                      <p className="text-[9px] text-white/20 mt-1">{new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      {(() => {
                        const lastReadIdx = messages.map((m: any, i: number) => isMe && m.read_by_admin ? i : -1).filter((i: number) => i !== -1).pop();
                        return idx === lastReadIdx ? <p className="text-[9px] text-blue-400/60 mt-0.5 text-right">✓ Seen</p> : null;
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {attachmentPreview && (
            <div className="px-6 py-3 border-t border-white/[0.06] flex items-center gap-3 bg-white/[0.02]">
              {attachmentPreview.type === "image" ? <img src={attachmentPreview.url} className="h-16 w-16 rounded-xl object-cover border border-white/10" /> :
                <div className="h-16 w-16 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center"><Paperclip size={20} className="text-white/30" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 truncate">{attachmentPreview.file.name}</p>
                <p className="text-[10px] text-white/30">{(attachmentPreview.file.size / 1024).toFixed(0)} KB · Ready to send</p>
              </div>
              <button onClick={() => setAttachmentPreview(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
          )}
          <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2 items-end flex-shrink-0">
            <button onClick={() => fileInputRef.current?.click()} className="text-white/30 hover:text-white/60 pb-2"><Paperclip size={16} /></button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); attachmentPreview ? uploadAndSend() : sendMessage(); } }}
              placeholder="Type a message..." rows={1} style={{ resize: "none" }}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none" />
            <button onClick={() => attachmentPreview ? uploadAndSend() : sendMessage()} disabled={(!newMessage.trim() && !attachmentPreview) || sending}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-40"><Send size={14} /></button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><p className="text-2xl mb-2">💬</p><p className="text-sm text-white/30">Select a chat</p></div>
        </div>
      )}
    </div>
  );
}
