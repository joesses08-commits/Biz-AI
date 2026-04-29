"use client";
import { useState, useEffect, useRef } from "react";
import { Package, CheckCircle, AlertTriangle, LogOut, ArrowDown, MessageCircle, Send } from "lucide-react";

export default function WarehousePortal() {
  const [warehouseUser, setWarehouseUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"incoming" | "inventory" | "messages">("incoming");
  const [shipments, setShipments] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showReceive, setShowReceive] = useState<any>(null);
  const [showDamage, setShowDamage] = useState<any>(null);
  const [receiveForm, setReceiveForm] = useState({ quantity: "", notes: "" });
  const [damageForm, setDamageForm] = useState({ quantity: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<any>(null);

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-sm focus:outline-none focus:border-white/20";

  async function login() {
    setLoggingIn(true);
    setLoginError("");
    const res = await fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) });
    const data = await res.json();
    if (!res.ok) { setLoginError("Invalid email or password"); setLoggingIn(false); return; }
    const wu = data.user;
    setWarehouseUser(wu);
    localStorage.setItem("warehouse_user", JSON.stringify(wu));
    setLoggingIn(false);
    loadData(wu);
  }

  async function loadData(wu: any) {
    const [shipmentsRes, inventoryRes, messagesRes] = await Promise.all([
      fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_shipments", warehouse_id: wu.warehouse_id, user_id: wu.user_id }) }),
      fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_inventory", warehouse_id: wu.warehouse_id, user_id: wu.user_id }) }),
      fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_messages", warehouse_id: wu.warehouse_id, user_id: wu.user_id }) }),
    ]);
    setShipments((await shipmentsRes.json()).shipments || []);
    setInventoryItems((await inventoryRes.json()).inventory || []);
    setMessages((await messagesRes.json()).messages || []);
  }

  async function receiveGoods() {
    if (!showReceive || !warehouseUser) return;
    setSaving(true);
    await fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "receive_goods", inventory_id: showReceive.id, quantity_received: parseInt(receiveForm.quantity), notes: receiveForm.notes, warehouse_user_id: warehouseUser.id, user_id: warehouseUser.user_id }) });
    setSaving(false);
    setShowReceive(null);
    setReceiveForm({ quantity: "", notes: "" });
    loadData(warehouseUser);
  }

  async function reportDamage() {
    if (!showDamage || !warehouseUser) return;
    setSaving(true);
    const res = await fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report_damage", inventory_id: showDamage.id, quantity_damaged: parseInt(damageForm.quantity), notes: damageForm.notes, user_id: warehouseUser.user_id }) });
    if (res.ok) {
      const total = showDamage.quantity_incoming || 0;
      const damaged = parseInt(damageForm.quantity) || 0;
      const good = total - damaged;
      await fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_message", warehouse_id: warehouseUser.warehouse_id, user_id: warehouseUser.user_id, message: `⚠️ Damage reported: ${showDamage.plm_products?.name} — ${total} incoming, ${damaged} damaged, ${good} in good condition. Reason: ${damageForm.notes}`, sender_role: "warehouse", sender_name: warehouseUser.name }) });
    }
    setSaving(false);
    setShowDamage(null);
    setDamageForm({ quantity: "", notes: "" });
    loadData(warehouseUser);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !warehouseUser) return;
    setSendingMsg(true);
    await fetch("/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_message", warehouse_id: warehouseUser.warehouse_id, user_id: warehouseUser.user_id, message: newMessage.trim(), sender_role: "warehouse", sender_name: warehouseUser.name }) });
    setNewMessage("");
    setSendingMsg(false);
    loadData(warehouseUser);
  }

  useEffect(() => {
    const saved = localStorage.getItem("warehouse_user");
    if (saved) {
      const wu = JSON.parse(saved);
      setWarehouseUser(wu);
      loadData(wu);
    }
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!warehouseUser) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4">
            <Package size={20} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Warehouse Portal</h1>
          <p className="text-white/30 text-sm">Sign in to manage incoming shipments</p>
        </div>
        <div className="space-y-3 mb-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={inputClass} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={inputClass} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        {loginError && <p className="text-red-400 text-xs text-center mb-3">{loginError}</p>}
        <button onClick={login} disabled={loggingIn || !email || !password} className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm disabled:opacity-40 hover:bg-white/90 transition">
          {loggingIn ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{warehouseUser.warehouses?.name}</p>
          <p className="text-xs text-white/30">{warehouseUser.name}</p>
        </div>
        <button onClick={() => { localStorage.removeItem("warehouse_user"); setWarehouseUser(null); }} className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs transition">
          <LogOut size={12} /> Sign out
        </button>
      </div>

      <div className="px-6 py-4 flex-1 flex flex-col">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab("incoming")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition ${activeTab === "incoming" ? "bg-white text-black" : "text-white/40 border border-white/[0.08]"}`}>
            <ArrowDown size={12} /> Incoming ({shipments.length})
          </button>
          <button onClick={() => setActiveTab("inventory")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition ${activeTab === "inventory" ? "bg-white text-black" : "text-white/40 border border-white/[0.08]"}`}>
            <Package size={12} /> Inventory ({inventoryItems.length})
          </button>
          <button onClick={() => setActiveTab("messages")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition ${activeTab === "messages" ? "bg-white text-black" : "text-white/40 border border-white/[0.08]"}`}>
            <MessageCircle size={12} /> Messages
          </button>
        </div>

        {activeTab === "incoming" && (
          <div className="space-y-3">
            {shipments.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No incoming shipments</p>
              </div>
            ) : shipments.map((item: any) => (
              <div key={item.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  {item.plm_products?.images?.[0] && <img src={item.plm_products.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{item.plm_products?.name}</p>
                    {item.plm_products?.sku && <p className="text-xs text-white/30 font-mono">{item.plm_products.sku}</p>}
                    {item.po_number && <p className="text-xs text-white/30 mt-1">PO: {item.po_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-400">{item.quantity_incoming}</p>
                    <p className="text-[10px] text-white/25">expected units</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowReceive(item); setReceiveForm({ quantity: String(item.quantity_incoming), notes: "" }); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 transition">
                    <CheckCircle size={12} /> Mark Received
                  </button>
                  {item.quantity_on_hand > 0 && (
                  <button onClick={() => { setShowDamage(item); setDamageForm({ quantity: "", notes: "" }); }} className="px-3 py-2 rounded-xl border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition">
                    <AlertTriangle size={12} />
                  </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-2">
            {inventoryItems.length === 0 ? (
              <div className="text-center py-16">
                <Package size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No inventory yet</p>
              </div>
            ) : inventoryItems.map((item: any) => (
              <div key={item.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
                {item.plm_products?.images?.[0] && <img src={item.plm_products.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/80">{item.plm_products?.name}</p>
                  {item.plm_products?.sku && <p className="text-[10px] text-white/25 font-mono">{item.plm_products.sku}</p>}
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-lg font-bold text-white">{item.quantity_on_hand}</p>
                    <p className="text-[10px] text-white/25">on hand</p>
                  </div>
                  {item.quantity_incoming > 0 && (
                    <div>
                      <p className="text-lg font-bold text-amber-400">{item.quantity_incoming}</p>
                      <p className="text-[10px] text-white/25">incoming</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[60vh]">
              {messages.length === 0 ? (
                <div className="text-center py-16">
                  <MessageCircle size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No messages yet</p>
                </div>
              ) : messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.sender_role === "warehouse" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.sender_role === "warehouse" ? "bg-white text-black" : "bg-white/[0.06] text-white/80"}`}>
                    <p>{m.message}</p>
                    <p className={`text-[10px] mt-1 ${m.sender_role === "warehouse" ? "text-black/40" : "text-white/25"}`}>{m.sender_name} · {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()} placeholder="Type a message..." className={inputClass} />
              <button onClick={sendMessage} disabled={sendingMsg || !newMessage.trim()} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40 hover:bg-white/90 transition">
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showReceive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-sm font-bold mb-1">Receive Shipment</h3>
            <p className="text-xs text-white/30 mb-4">{showReceive.plm_products?.name}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Units Received *</label>
                <input type="number" value={receiveForm.quantity} onChange={e => setReceiveForm({...receiveForm, quantity: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Notes</label>
                <input value={receiveForm.notes} onChange={e => setReceiveForm({...receiveForm, notes: e.target.value})} placeholder="e.g. All units in good condition" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowReceive(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-xs">Cancel</button>
              <button onClick={receiveGoods} disabled={saving || !receiveForm.quantity} className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40">
                {saving ? "Saving..." : "Confirm Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDamage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-sm font-bold mb-1">Report Damage</h3>
            <p className="text-xs text-white/30 mb-4">{showDamage.plm_products?.name}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Damaged Units *</label>
                <input type="number" value={damageForm.quantity} onChange={e => setDamageForm({...damageForm, quantity: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Description *</label>
                <input value={damageForm.notes} onChange={e => setDamageForm({...damageForm, notes: e.target.value})} placeholder="e.g. Broken during transit" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDamage(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-xs">Cancel</button>
              <button onClick={reportDamage} disabled={saving || !damageForm.quantity || !damageForm.notes} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-semibold disabled:opacity-40">
                {saving ? "Saving..." : "Report Damage"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
