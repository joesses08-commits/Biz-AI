
"use client";
import { useState, useEffect } from "react";
import { Package, Warehouse, Plus, ArrowDown, ArrowUp, RefreshCw, X, ChevronRight } from "lucide-react";

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWarehouse, setActiveWarehouse] = useState<string>("all");
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAdjust, setShowAdjust] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [warehouseForm, setWarehouseForm] = useState({ name: "", address: "", city: "", state: "", country: "US", contact_name: "", contact_email: "", contact_phone: "", notes: "" });
  const [userForm, setUserForm] = useState({ warehouse_id: "", name: "", email: "", password: "" });
  const [adjustForm, setAdjustForm] = useState({ quantity_adjustment: "", notes: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/inventory");
    const data = await res.json();
    setWarehouses(data.warehouses || []);
    setInventory(data.inventory || []);
    setMovements(data.movements || []);
    setLoading(false);
  }

  async function createWarehouse() {
    setSaving(true);
    await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_warehouse", ...warehouseForm }) });
    setSaving(false);
    setShowAddWarehouse(false);
    setWarehouseForm({ name: "", address: "", city: "", state: "", country: "US", contact_name: "", contact_email: "", contact_phone: "", notes: "" });
    load();
  }

  async function createWarehouseUser() {
    setSaving(true);
    await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_warehouse_user", ...userForm }) });
    setSaving(false);
    setShowAddUser(false);
    setUserForm({ warehouse_id: "", name: "", email: "", pin: "" });
  }

  async function adjustInventory() {
    if (!showAdjust) return;
    setSaving(true);
    await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "adjust_inventory", product_id: showAdjust.product_id, warehouse_id: showAdjust.warehouse_id, quantity_adjustment: parseInt(adjustForm.quantity_adjustment), notes: adjustForm.notes }) });
    setSaving(false);
    setShowAdjust(null);
    setAdjustForm({ quantity_adjustment: "", notes: "" });
    load();
  }

  const filteredInventory = activeWarehouse === "all" ? inventory : inventory.filter((i: any) => i.warehouse_id === activeWarehouse);
  const totalOnHand = filteredInventory.reduce((sum: number, i: any) => sum + (i.quantity_on_hand || 0), 0);
  const totalIncoming = filteredInventory.reduce((sum: number, i: any) => sum + (i.quantity_incoming || 0), 0);

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20";
  const labelClass = "text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Package size={16} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
              <p className="text-xs text-white/30 mt-0.5">Track stock across all warehouses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-white/50 hover:text-white text-xs transition">
              <Plus size={12} /> Warehouse User
            </button>
            <button onClick={() => setShowAddWarehouse(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 transition">
              <Warehouse size={12} /> Add Warehouse
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32"><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Warehouses", value: warehouses.length, icon: Warehouse, color: "text-blue-400" },
                { label: "Units On Hand", value: totalOnHand.toLocaleString(), icon: Package, color: "text-emerald-400" },
                { label: "Units Incoming", value: totalIncoming.toLocaleString(), icon: ArrowDown, color: "text-amber-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <stat.icon size={16} className={stat.color} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-white/30">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Warehouse filter tabs */}
            {warehouses.length > 0 && (
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
                <button onClick={() => setActiveWarehouse("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0 ${activeWarehouse === "all" ? "bg-white text-black" : "text-white/40 hover:text-white border border-white/[0.08]"}`}>
                  All Warehouses
                </button>
                {warehouses.map((w: any) => (
                  <button key={w.id} onClick={() => setActiveWarehouse(w.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0 ${activeWarehouse === w.id ? "bg-white text-black" : "text-white/40 hover:text-white border border-white/[0.08]"}`}>
                    {w.name} {w.city ? `· ${w.city}` : ""}
                  </button>
                ))}
              </div>
            )}

            {warehouses.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
                <Warehouse size={32} className="text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm font-medium">No warehouses yet</p>
                <p className="text-white/20 text-xs mt-1 mb-6">Add a warehouse to start tracking inventory</p>
                <button onClick={() => setShowAddWarehouse(true)} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 transition">
                  Add First Warehouse
                </button>
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center">
                <Package size={32} className="text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm">No inventory yet</p>
                <p className="text-white/20 text-xs mt-1">Inventory is created automatically when POs are issued</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInventory.map((item: any) => {
                  const product = item.plm_products;
                  const warehouse = item.warehouses;
                  return (
                    <div key={item.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4 flex items-center gap-4">
                      {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white/80 truncate">{product?.name}</p>
                          {product?.sku && <span className="text-[10px] text-white/25 font-mono">{product.sku}</span>}
                        </div>
                        <p className="text-[11px] text-white/30">{warehouse?.name}{warehouse?.city ? ` · ${warehouse.city}, ${warehouse.state}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{item.quantity_on_hand || 0}</p>
                          <p className="text-[10px] text-white/25">On Hand</p>
                        </div>
                        {(item.quantity_incoming || 0) > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-amber-400">{item.quantity_incoming}</p>
                            <p className="text-[10px] text-white/25">Incoming</p>
                          </div>
                        )}
                        {(item.quantity_reserved || 0) > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-blue-400">{item.quantity_reserved}</p>
                            <p className="text-[10px] text-white/25">Reserved</p>
                          </div>
                        )}
                        <button onClick={() => setShowAdjust(item)} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/40 hover:text-white text-[10px] transition">
                          Adjust
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent movements */}
            {movements.length > 0 && (
              <div className="mt-8">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">Recent Movements</p>
                <div className="space-y-1">
                  {movements.slice(0, 20).map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${m.type === "received" ? "bg-emerald-500/15" : m.type === "damaged" ? "bg-red-500/15" : "bg-blue-500/15"}`}>
                        {m.type === "received" ? <ArrowDown size={10} className="text-emerald-400" /> : m.type === "damaged" ? <X size={10} className="text-red-400" /> : <RefreshCw size={10} className="text-blue-400" />}
                      </div>
                      <span className="text-[11px] text-white/50 flex-1">{m.plm_products?.name} · {m.warehouses?.name}</span>
                      <span className={`text-[11px] font-semibold ${m.quantity > 0 ? "text-emerald-400" : "text-red-400"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity} units</span>
                      <span className="text-[10px] text-white/20 capitalize">{m.type}</span>
                      <span className="text-[10px] text-white/20">{new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Warehouse Modal */}
      {showAddWarehouse && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold">Add Warehouse</h2>
              <button onClick={() => setShowAddWarehouse(false)}><X size={16} className="text-white/30" /></button>
            </div>
            <div className="space-y-4">
              <div><label className={labelClass}>Warehouse Name *</label><input value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} placeholder="West Coast Warehouse" className={inputClass} /></div>
              <div><label className={labelClass}>Address</label><input value={warehouseForm.address} onChange={e => setWarehouseForm({...warehouseForm, address: e.target.value})} placeholder="123 Warehouse Blvd" className={inputClass} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>City</label><input value={warehouseForm.city} onChange={e => setWarehouseForm({...warehouseForm, city: e.target.value})} placeholder="Los Angeles" className={inputClass} /></div>
                <div><label className={labelClass}>State</label><input value={warehouseForm.state} onChange={e => setWarehouseForm({...warehouseForm, state: e.target.value})} placeholder="CA" className={inputClass} /></div>
              </div>
              <div><label className={labelClass}>Contact Name</label><input value={warehouseForm.contact_name} onChange={e => setWarehouseForm({...warehouseForm, contact_name: e.target.value})} placeholder="John Smith" className={inputClass} /></div>
              <div><label className={labelClass}>Contact Email</label><input value={warehouseForm.contact_email} onChange={e => setWarehouseForm({...warehouseForm, contact_email: e.target.value})} placeholder="john@warehouse.com" className={inputClass} /></div>
              <div><label className={labelClass}>Contact Phone</label><input value={warehouseForm.contact_phone} onChange={e => setWarehouseForm({...warehouseForm, contact_phone: e.target.value})} placeholder="+1 (555) 000-0000" className={inputClass} /></div>
              <div><label className={labelClass}>Notes</label><textarea value={warehouseForm.notes} onChange={e => setWarehouseForm({...warehouseForm, notes: e.target.value})} rows={2} className={inputClass + " resize-none"} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddWarehouse(false)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-xs">Cancel</button>
              <button onClick={createWarehouse} disabled={saving || !warehouseForm.name} className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 hover:bg-emerald-400 transition">
                {saving ? "Saving..." : "Add Warehouse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Warehouse User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold">Add Warehouse User</h2>
              <button onClick={() => setShowAddUser(false)}><X size={16} className="text-white/30" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Warehouse *</label>
                <select value={userForm.warehouse_id} onChange={e => setUserForm({...userForm, warehouse_id: e.target.value})} className={inputClass}>
                  <option value="">Select warehouse...</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Name *</label><input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="John Smith" className={inputClass} /></div>
              <div><label className={labelClass}>Email *</label><input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="john@warehouse.com" className={inputClass} /></div>
              <div><label className={labelClass}>Password *</label><input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Create a password" className={inputClass} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddUser(false)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-xs">Cancel</button>
              <button onClick={createWarehouseUser} disabled={saving || !userForm.warehouse_id || !userForm.name || !userForm.email || !userForm.password} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 hover:bg-blue-400 transition">
                {saving ? "Saving..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">Adjust Inventory</h2>
              <button onClick={() => setShowAdjust(null)}><X size={16} className="text-white/30" /></button>
            </div>
            <p className="text-xs text-white/40 mb-4">{showAdjust.plm_products?.name} · {showAdjust.warehouses?.name}</p>
            <p className="text-xs text-white/30 mb-4">Current on hand: <span className="text-white font-semibold">{showAdjust.quantity_on_hand}</span></p>
            <div className="space-y-3">
              <div><label className={labelClass}>Adjustment (+ to add, - to remove)</label><input type="number" value={adjustForm.quantity_adjustment} onChange={e => setAdjustForm({...adjustForm, quantity_adjustment: e.target.value})} placeholder="+10 or -5" className={inputClass} /></div>
              <div><label className={labelClass}>Reason</label><input value={adjustForm.notes} onChange={e => setAdjustForm({...adjustForm, notes: e.target.value})} placeholder="e.g. Damaged goods, stock count correction" className={inputClass} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdjust(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-xs">Cancel</button>
              <button onClick={adjustInventory} disabled={saving || !adjustForm.quantity_adjustment} className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40 hover:bg-white/90 transition">
                {saving ? "Saving..." : "Apply Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
