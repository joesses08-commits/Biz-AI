
"use client";
import { useState } from "react";
import { Package, CheckCircle, AlertTriangle, LogOut, ArrowDown } from "lucide-react";

export default function WarehousePortal() {
  const [warehouseUser, setWarehouseUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"incoming" | "inventory">("incoming");
  const [shipments, setShipments] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showReceive, setShowReceive] = useState<any>(null);
  const [showDamage, setShowDamage] = useState<any>(null);
  const [receiveForm, setReceiveForm] = useState({ quantity: "", notes: "" });
  const [damageForm, setDamageForm] = useState({ quantity: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function login() {
    setLoggingIn(true);
    setLoginError("");
    const res = await fetch("https://myjimmy.ai/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) });
    const data = await res.json();
    if (!res.ok) { setLoginError("Invalid email or PIN"); setLoggingIn(false); return; }
    setWarehouseUser(data.user || data.warehouse_user);
    loadData(data.warehouse_user);
    setLoggingIn(false);
  }

  async function loadData(wu: any) {
    const [shipmentsRes, inventoryRes] = await Promise.all([
      fetch("https://myjimmy.ai/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_shipments", warehouse_id: wu.warehouse_id, user_id: wu.user_id }) }),
      fetch("https://myjimmy.ai/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_inventory", warehouse_id: wu.warehouse_id, user_id: wu.user_id }) }),
    ]);
    const shipmentsData = await shipmentsRes.json();
    const inventoryData = await inventoryRes.json();
    setShipments(shipmentsData.shipments || []);
    setInventoryItems(inventoryData.inventory || []);
  }

  async function receiveGoods() {
    if (!showReceive || !warehouseUser) return;
    setSaving(true);
    await fetch("https://myjimmy.ai/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "receive_goods", inventory_id: showReceive.id, quantity_received: parseInt(receiveForm.quantity), notes: receiveForm.notes, warehouse_user_id: warehouseUser.id, user_id: warehouseUser.user_id }) });
    setSaving(false);
    setShowReceive(null);
    setReceiveForm({ quantity: "", notes: "" });
    loadData(warehouseUser);
  }

  async function reportDamage() {
    if (!showDamage || !warehouseUser) return;
    setSaving(true);
    await fetch("https://myjimmy.ai/api/warehouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report_damage", inventory_id: showDamage.id, quantity_damaged: parseInt(damageForm.quantity), notes: damageForm.notes, user_id: warehouseUser.user_id }) });
    setSaving(false);
    setShowDamage(null);
    setDamageForm({ quantity: "", notes: "" });
    loadData(warehouseUser);
  }

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-sm focus:outline-none focus:border-white/20";

  if (!warehouseUser) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <line x1="24" y1="8" x2="24" y2="26" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round"/>
              <path d="M24 26 Q24 34 18 35 Q11 36 10 30" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{warehouseUser.warehouses?.name}</p>
          <p className="text-xs text-white/30">{warehouseUser.name}</p>
        </div>
        <button onClick={() => setWarehouseUser(null)} className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs transition">
          <LogOut size={12} /> Sign out
        </button>
      </div>

      <div className="px-6 py-4">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab("incoming")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition ${activeTab === "incoming" ? "bg-white text-black" : "text-white/40 border border-white/[0.08]"}`}>
            <ArrowDown size={12} /> Incoming ({shipments.length})
          </button>
          <button onClick={() => setActiveTab("inventory")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition ${activeTab === "inventory" ? "bg-white text-black" : "text-white/40 border border-white/[0.08]"}`}>
            <Package size={12} /> Inventory ({inventoryItems.length})
          </button>
        </div>

        {activeTab === "incoming" && (
          <div className="space-y-3">
            {shipments.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No incoming shipments</p>
              </div>
            ) : shipments.map((item: any) => {
              const product = item.plm_products;
              const batch = product?.plm_batches?.[0];
              return (
                <div key={item.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{product?.name}</p>
                      {product?.sku && <p className="text-xs text-white/30 font-mono">{product.sku}</p>}
                      {batch?.linked_po_number && <p className="text-xs text-white/30 mt-1">PO: {batch.linked_po_number}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-400">{item.incoming}</p>
                      <p className="text-[10px] text-white/25">expected units</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowReceive(item); setReceiveForm({ quantity: String(item.incoming), notes: "" }); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 transition">
                      <CheckCircle size={12} /> Mark Received
                    </button>
                    <button onClick={() => { setShowDamage(item); setDamageForm({ quantity: "", notes: "" }); }} className="px-3 py-2 rounded-xl border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition">
                      <AlertTriangle size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{item.on_hand}</p>
                  <p className="text-[10px] text-white/25">on hand</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receive Modal */}
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

      {/* Damage Modal */}
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
