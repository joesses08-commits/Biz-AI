"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Users, X, Check, Search, Send, Paperclip, Image as ImageIcon } from "lucide-react";

export default function MessagesPage() {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [chatMembers, setChatMembers] = useState<any[]>([]);
  const [firstUnread, setFirstUnread] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{file: File, url: string, type: string} | null>(null);

  useEffect(() => { loadChats(); }, []);

  const loadChats = async () => {
    const res = await fetch("/api/messages");
    const data = await res.json();
    setChats(data.chats || []);
    setLoading(false);
  };

  const openChat = async (chat: any) => {
    setActiveChat(chat);
    if (pollRef.current) clearInterval(pollRef.current);
    const fetchMsgs = async (isFirst?: boolean) => {
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_messages", track_id: chat.track_id }) });
      const data = await res.json();
      const msgs = data.messages || [];
      setMessages(msgs);
      if (isFirst) {
        const idx = msgs.findIndex((m: any) => m.sender_role === "factory" && !m.read_by_admin);
        setFirstUnread(idx);
      }
      if (isFirst) setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 100);
      // Update unread in chat list
      setChats(prev => prev.map(c => c.track_id === chat.track_id ? { ...c, unread_count: 0 } : c));
    };
    await fetchMsgs(true);
    pollRef.current = setInterval(() => fetchMsgs(false), 3000);
    // Load team members from profiles
    const teamRes = await fetch("/api/messages/team");
    const teamData = await teamRes.json();
    setTeamMembers(teamData.members || []);
    // Load current chat members
    const membersRes = await fetch("/api/messages/members?track_id=" + chat.track_id);
    const membersData = await membersRes.json();
    setChatMembers(membersData.members || []);
  };

  const sendMessage = async (text?: string, attachmentUrl?: string, attachmentType?: string, attachmentName?: string) => {
    const msg = text || newMessage.trim();
    if (!msg && !attachmentUrl) return;
    setSending(true);
    await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_message", track_id: activeChat.track_id, product_id: activeChat.product_id, message: msg, attachment_url: attachmentUrl, attachment_type: attachmentType, attachment_name: attachmentName }) });
    setNewMessage("");
    const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_messages", track_id: activeChat.track_id }) });
    const data = await res.json();
    setMessages(data.messages || []);
    setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, 100);
    setSending(false);
    loadChats();
  };

  const handleFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setAttachmentPreview({ file, url: previewUrl, type: file.type.startsWith("image/") ? "image" : "file" });
  };

  const uploadAndSend = async () => {
    if (!attachmentPreview) return;
    setSending(true);
    const formData = new FormData();
    formData.append("file", attachmentPreview.file);
    formData.append("track_id", activeChat.track_id);
    const res = await fetch("/api/messages/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) await sendMessage(newMessage, data.url, attachmentPreview.type, attachmentPreview.file.name);
    setAttachmentPreview(null);
    setSending(false);
  };

  const togglePin = async (chat: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: chat.is_pinned ? "unpin" : "pin", track_id: chat.track_id }) });
    loadChats();
  };

  const filteredChats = chats.filter(c =>
    !search || c.product_name?.toLowerCase().includes(search.toLowerCase()) || c.factory_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedChats = filteredChats.filter(c => c.is_pinned);
  const unpinnedChats = filteredChats.filter(c => !c.is_pinned);

  return (
    <div className="flex h-[calc(100vh-0px)] bg-[#0a0a0a] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold mb-3">Messages</p>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-white/20 text-center py-8">Loading...</p>
          ) : filteredChats.length === 0 ? (
            <p className="text-xs text-white/20 text-center py-8">No chats yet</p>
          ) : (
            <>
              {pinnedChats.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest px-5 pt-4 pb-2">Pinned</p>
                  {pinnedChats.map(chat => <ChatRow key={chat.track_id} chat={chat} active={activeChat?.track_id === chat.track_id} onClick={() => openChat(chat)} onPin={e => togglePin(chat, e)} />)}
                </div>
              )}
              {unpinnedChats.length > 0 && (
                <div>
                  {pinnedChats.length > 0 && <p className="text-[10px] text-white/20 uppercase tracking-widest px-5 pt-4 pb-2">All Chats</p>}
                  {unpinnedChats.map(chat => <ChatRow key={chat.track_id} chat={chat} active={activeChat?.track_id === chat.track_id} onClick={() => openChat(chat)} onPin={e => togglePin(chat, e)} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              {activeChat.product_image ? (
                <img src={activeChat.product_image} className="w-9 h-9 rounded-xl object-cover border border-white/[0.06]" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <span className="text-white/20 text-xs">📦</span>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">{activeChat.product_name}</p>
                <p className="text-[11px] text-white/40">{activeChat.factory_name} · {activeChat.product_sku}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowMembers(true)}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-xl transition">
                <Users size={12} />Members
              </button>
              <button onClick={() => router.push(`/plm/${activeChat.product_id}`)}
                className="text-xs text-white/30 hover:text-white/60 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-xl transition">
                View Product →
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-3">
            {messages.map((msg: any, idx: number) => (
              <div key={msg.id}>
                {idx === firstUnread && firstUnread > 0 && (
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-blue-500/30" />
                    <span className="text-[10px] text-blue-400 font-semibold">{messages.length - firstUnread} new message{messages.length - firstUnread !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-blue-500/30" />
                  </div>
                )}
                <div className={msg.sender_role === "admin" || msg.sender_role === "designer" ? "flex justify-end" : "flex justify-start"}>
                  <div className={msg.sender_role === "factory"
                    ? "bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[70%]"
                    : "bg-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[70%]"}>
                    <p className="text-[10px] font-semibold mb-1" style={{color: (() => {
                      const colors = ["#60a5fa","#34d399","#f472b6","#fb923c","#a78bfa","#facc15","#38bdf8","#f87171"];
                      let hash = 0;
                      for (let i = 0; i < (msg.sender_name||"").length; i++) hash = (msg.sender_name.charCodeAt(i) + ((hash << 5) - hash));
                      return colors[Math.abs(hash) % colors.length];
                    })()}}>{msg.sender_name}</p>
                    {msg.message && <p className="text-sm text-white/80">{msg.message}</p>}
                    {msg.attachment_url && msg.attachment_type === "image" && (
                      <img src={msg.attachment_url} className="mt-2 max-w-xs rounded-xl border border-white/10 cursor-pointer" onClick={() => window.open(msg.attachment_url, "_blank")} />
                    )}
                    {msg.attachment_url && msg.attachment_type === "file" && (
                      <a href={msg.attachment_url} target="_blank" className="mt-2 flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
                        <Paperclip size={11} />{msg.attachment_name || "File"}
                      </a>
                    )}
                    <p className="text-[9px] text-white/20 mt-1">{new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                    {(() => {
                      const lastReadAdminIdx = messages.map((m: any, i: number) => m.sender_role === "admin" && m.read_by_factory ? i : -1).filter((i: number) => i !== -1).pop();
                      return idx === lastReadAdminIdx ? <p className="text-[9px] text-blue-400/60 mt-0.5 text-right">✓ Seen</p> : null;
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          {attachmentPreview && (
              <div className="px-6 py-3 border-t border-white/[0.06] flex items-center gap-3 bg-white/[0.02]">
                {attachmentPreview.type === "image" ? (
                  <img src={attachmentPreview.url} className="h-16 w-16 rounded-xl object-cover border border-white/10" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                    <Paperclip size={20} className="text-white/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 truncate">{attachmentPreview.file.name}</p>
                  <p className="text-[10px] text-white/30">{(attachmentPreview.file.size / 1024).toFixed(0)} KB · Ready to send</p>
                </div>
                <button onClick={() => setAttachmentPreview(null)} className="text-white/30 hover:text-white/60">
                  <X size={14} />
                </button>
              </div>
            )}
          <div className={`px-6 py-4 border-t border-white/[0.06] flex-shrink-0 ${dragging ? "bg-blue-500/5 border-blue-500/20" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={async e => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) await handleFile(file); }}>
            {dragging && <p className="text-xs text-blue-400 text-center mb-2">Drop file to attach</p>}
            <div className="flex gap-2 items-end">
              <button onClick={() => fileInputRef.current?.click()}
                className="text-white/30 hover:text-white/60 transition flex-shrink-0 pb-2">
                <Paperclip size={16} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.doc,.docx,.csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                rows={1} style={{ resize: "none" }}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/20 transition" />
              <button onClick={() => attachmentPreview ? uploadAndSend() : sendMessage()} disabled={(!newMessage.trim() && !attachmentPreview) || sending}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-40 transition">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm text-white/30">Select a chat to start messaging</p>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembers && activeChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Chat Members</p>
              <button onClick={() => setShowMembers(false)} className="text-white/30 hover:text-white/60">×</button>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Always in chat</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03]">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px]">A</div>
                <p className="text-xs text-white/60">Admin</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03]">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">F</div>
                <p className="text-xs text-white/60">{activeChat.factory_name}</p>
              </div>
            </div>
            {teamMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Team Members</p>
                {teamMembers.map((m: any) => {
                  const isIn = chatMembers.some((cm: any) => cm.user_id === m.id);
                  const isPending = pendingMemberIds.includes(m.id);
                  return (
                    <div key={m.id} onClick={() => { if (isIn) return; setPendingMemberIds((prev: string[]) => prev.includes(m.id) ? prev.filter((id: string) => id !== m.id) : [...prev, m.id]); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${isIn ? "opacity-40 cursor-default border-white/[0.04] bg-white/[0.01]" : isPending ? "cursor-pointer border-white/20 bg-white/[0.06]" : "cursor-pointer border-white/[0.04] bg-white/[0.02]"}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isIn ? "border-emerald-500/30 bg-emerald-500/10" : isPending ? "bg-white border-white" : "border-white/20"}`}>
                        {isIn ? <Check size={9} className="text-emerald-400" /> : isPending ? <Check size={9} className="text-black" /> : null}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px]">{(m.full_name || m.email || "?")[0].toUpperCase()}</div>
                      <p className={`text-xs flex-1 ${isIn ? "text-white/30" : "text-white/60"}`}>{m.full_name || m.email}</p>
                      {isIn && <span className="text-[9px] text-emerald-400/50">In chat</span>}
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setShowMembers(false); setPendingMemberIds([]); }}
                    className="flex-1 px-3 py-2 rounded-xl border border-white/[0.08] text-white/40 text-xs">Cancel</button>
                  <button disabled={savingMembers || pendingMemberIds.length === 0} onClick={async () => {
                    setSavingMembers(true);
                    const currentIds = chatMembers.map((cm: any) => cm.user_id);
                    for (const id of pendingMemberIds) {
                      if (!currentIds.includes(id)) {
                        await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "add_member", track_id: activeChat.track_id, member_user_id: id }) });
                      }
                    }
                    for (const id of currentIds) {
                      if (!pendingMemberIds.includes(id) && teamMembers.some((m: any) => m.id === id)) {
                        await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "remove_member", track_id: activeChat.track_id, member_user_id: id }) });
                      }
                    }
                    const membersRes = await fetch("/api/messages/members?track_id=" + activeChat.track_id);
                    const membersData = await membersRes.json();
                    setChatMembers(membersData.members || []);
                    setSavingMembers(false);
                    setShowMembers(false);
                    setPendingMemberIds([]);
                  }} className="flex-1 px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingMembers ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatRow({ chat, active, onClick, onPin }: { chat: any, active: boolean, onClick: () => void, onPin: (e: React.MouseEvent) => void }) {
  return (
    <div onClick={onClick} className={`px-5 py-3 cursor-pointer flex items-center gap-3 hover:bg-white/[0.02] transition ${active ? "bg-white/[0.04] border-r-2 border-white/20" : ""}`}>
      {chat.product_image ? (
        <img src={chat.product_image} className="w-10 h-10 rounded-xl object-cover border border-white/[0.06] flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          <span className="text-white/20 text-xs">📦</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-semibold truncate">{chat.product_name}</p>
          {chat.unread_count > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex-shrink-0 ml-1">{chat.unread_count}</span>
          )}
        </div>
        <p className="text-[10px] text-white/30 truncate">{chat.factory_name}</p>
        {chat.latest_message && (
          <p className="text-[10px] text-white/20 truncate mt-0.5">{chat.latest_message.sender_name}: {chat.latest_message.message || "📎 Attachment"}</p>
        )}
      </div>
      <button onClick={onPin} className="text-white/20 hover:text-white/50 transition flex-shrink-0">
        {chat.is_pinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>
    </div>
  );
}
