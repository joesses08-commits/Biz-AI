"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Loader2, X, ArrowLeft, Check,
  Package, Clock, Eye
} from "lucide-react";
import { useRef } from "react";

export default function POGeneratorPage() {
  const router = useRouter();

  const [products, setProducts] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [poSelectedProducts, setPOSelectedProducts] = useState<string[]>([]);
  const [poLineItems, setPOLineItems] = useState<Record<string, { qty: string; unit_price: string }>>({});
  const [poFactoryPerProduct, setPOFactoryPerProduct] = useState<Record<string, string>>({});
  const [poForm, setPOForm] = useState({
    po_number: `PO-${Date.now().toString().slice(-6)}`,
    payment_terms: "30% deposit, 70% before shipment",
    delivery_terms: "FOB Factory",
    ship_date: "",
    destination: "",
    company_name: "",
    company_address: "",
    contact_name: "",
    notes: "",
  });
  const [generatingPO, setGeneratingPO] = useState(false);
  const [emailModal, setEmailModal] = useState<{
    factory: any; po_number: string; html: string; pdfUrl?: string; subject: string; body: string;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bothConnected, setBothConnected] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { load(); }, []);

  async function htmlToPdfBase64(html: string): Promise<string> {
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "1000px";
    iframe.style.height = "1400px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    await new Promise<void>(resolve => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });

    await new Promise(r => setTimeout(r, 500));

    const canvas = await html2canvas(iframe.contentDocument!.body, {
      scale: 2,
      useCORS: true,
      width: 1000,
      windowWidth: 1000,
    });

    document.body.removeChild(iframe);

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let y = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();
    while (y < pdfHeight) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -y, pdfWidth, pdfHeight);
      y += pageHeight;
    }

    return pdf.output("datauristring").split(",")[1];
  }

  async function load() {
    setLoading(true);
    const [plmRes, historyRes, profileRes] = await Promise.all([
      fetch("/api/plm"),
      fetch("/api/plm/po-history"),
      fetch("/api/profile"),
    ]);
    const plmData = await plmRes.json();
    setProducts(plmData.products || []);
    setFactories(plmData.factories || []);
    if (historyRes.ok) {
      const historyData = await historyRes.json();
      setHistory(historyData.history || []);
    }
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      const p = profileData.profile || {};
      setPOForm(f => ({
        ...f,
        company_name: p.company_name || f.company_name,
        contact_name: p.full_name || f.contact_name,
        company_address: p.address || f.company_address,
      }));
    }
    setLoading(false);
  }

  async function handleGeneratePO() {
    if (poSelectedProducts.length === 0) return;
    setGeneratingPO(true);
    const res = await fetch("/api/plm/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_ids: poSelectedProducts,
        line_items: poLineItems,
        factory_per_product: poFactoryPerProduct,
        ...poForm,
      }),
    });
    const data = await res.json();
    setGeneratingPO(false);
    if (data.html) {
      // Generate PDF
      const pdfBase64 = await htmlToPdfBase64(data.html);
      const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

      // Preview in new tab
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      // Upload to Supabase storage
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const fileName = `${data.po_number}-${Date.now()}.pdf`;
      await supabase.storage.from("po-files").upload(fileName, pdfBlob, { contentType: "application/pdf" });
      const { data: urlData } = supabase.storage.from("po-files").getPublicUrl(fileName);
      const publicUrl = urlData?.publicUrl || "";

      setBothConnected(data.both_connected || false);
      setEmailModal({
        factory: data.factory,
        po_number: data.po_number,
        html: data.html,
        pdfUrl: publicUrl,
        subject: `Purchase Order ${data.po_number} — ${poForm.company_name || "Order"}`,
        body: (data.email_body || "") + (publicUrl ? `

Download PO: ${publicUrl}` : ""),
      });
      setPOSelectedProducts([]);
      setPOLineItems({});
      setPOFactoryPerProduct({});
      setPOForm(f => ({ ...f, po_number: `PO-${Date.now().toString().slice(-6)}` }));
      load();
    }
  }

  async function sendEmail(provider?: string) {
    if (!emailModal) return;
    setSendingEmail(true);
    await fetch("/api/plm/po", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_email",
        factory: emailModal.factory,
        subject: emailModal.subject,
        body: emailModal.body,
        po_number: emailModal.po_number,
        pdf_url: emailModal.pdfUrl || null,
        ...(provider ? { provider } : {}),
      }),
    });
    setSendingEmail(false);
    setEmailModal(null);
  }

  async function openPO(html: string) {
    const pdfBase64 = await htmlToPdfBase64(html);
    const pdfBlob = new Blob([Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))], { type: "application/pdf" });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }

  const totalValue = poSelectedProducts.reduce((sum, pid) => {
    const line = poLineItems[pid];
    if (!line) return sum;
    return sum + (parseFloat(line.qty) || 0) * (parseFloat(line.unit_price) || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.push("/workflows")}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs mb-4 transition">
            <ArrowLeft size={12} /> Back to Workflows
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileText size={16} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PO Generator</h1>
              <p className="text-xs text-white/30 mt-0.5">Create purchase orders and send them to factories</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={20} className="animate-spin text-white/20" />
          </div>
        ) : (
          <>
            {/* Builder */}
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-6 space-y-6">
              <div>
                <p className="text-sm font-semibold text-white">New Purchase Order</p>
                <p className="text-xs text-white/30 mt-0.5">Select products, fill in details, then generate a print-ready PO</p>
              </div>

              {/* Buyer Info */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Your Company (Buyer)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">Company Name</label>
                    <input value={poForm.company_name} onChange={e => setPOForm({ ...poForm, company_name: e.target.value })}
                      placeholder="Your company name"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">Contact Name</label>
                    <input value={poForm.contact_name} onChange={e => setPOForm({ ...poForm, contact_name: e.target.value })}
                      placeholder="Your name"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">Company Address</label>
                    <input value={poForm.company_address} onChange={e => setPOForm({ ...poForm, company_address: e.target.value })}
                      placeholder="123 Main St, New York NY"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                </div>
              </div>

              {/* Products */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Products & Line Items</p>
                  <button onClick={() => {
                    const approved = products.filter(p =>
                      (p.plm_sample_requests || []).some((r: any) => r.status === "approved") &&
                      (!p.plm_batches || p.plm_batches.length === 0)
                    ).map(p => p.id);
                    setPOSelectedProducts(approved);
                    approved.forEach(id => {
                      const p = products.find((pr: any) => pr.id === id);
                      const req = (p?.plm_sample_requests || []).find((r: any) => r.status === "approved");
                      if (req?.factory_catalog?.id) {
                        setPOFactoryPerProduct(prev => ({ ...prev, [id]: req.factory_catalog.id }));
                      }
                    });
                  }} className="text-[11px] text-blue-400 hover:text-blue-300 transition">
                    Select Sample Approved
                  </button>
                </div>
                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                    <div className="col-span-1" />
                    <div className="col-span-3 text-[10px] text-white/30 uppercase tracking-widest">Product</div>
                    <div className="col-span-3 text-[10px] text-white/30 uppercase tracking-widest">Factory</div>
                    <div className="col-span-2 text-[10px] text-white/30 uppercase tracking-widest">Qty</div>
                    <div className="col-span-3 text-[10px] text-white/30 uppercase tracking-widest">Unit Price ($)</div>
                  </div>
                  {products.length === 0 ? (
                    <div className="text-center py-10">
                      <Package size={24} className="text-white/10 mx-auto mb-2" />
                      <p className="text-white/20 text-xs">No products found</p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
                      {products.map(p => {
                        const isSelected = poSelectedProducts.includes(p.id);
                        const line = poLineItems[p.id] || { qty: "", unit_price: "" };
                        const approvedReq = (p.plm_sample_requests || []).find((r: any) => r.status === "approved");
                        const approvedFactory = approvedReq?.factory_catalog;
                        const selectedFactoryId = poFactoryPerProduct[p.id] || approvedFactory?.id || "";
                        return (
                          <div key={p.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center transition ${isSelected ? "bg-blue-500/[0.04]" : "hover:bg-white/[0.01]"}`}>
                            <div className="col-span-1">
                              <input type="checkbox" checked={isSelected}
                                onChange={e => {
                                  setPOSelectedProducts(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                                  if (e.target.checked && approvedFactory?.id) {
                                    setPOFactoryPerProduct(prev => ({ ...prev, [p.id]: approvedFactory.id }));
                                  }
                                }} className="rounded" />
                            </div>
                            <div className="col-span-3 flex items-center gap-2 min-w-0">
                              {p.images?.[0] && <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-xs text-white/70 truncate">{p.name}</p>
                                {p.sku && <p className="text-[10px] text-white/25 font-mono">{p.sku}</p>}
                              </div>
                            </div>
                            <div className="col-span-3">
                              {isSelected ? (
                                <select value={selectedFactoryId}
                                  onChange={e => setPOFactoryPerProduct(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none">
                                  <option value="">Select factory</option>
                                  {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                              ) : (
                                <span className="text-[10px] text-white/20">{approvedFactory?.name || "—"}</span>
                              )}
                            </div>
                            <div className="col-span-2">
                              {isSelected && (
                                <input type="number" value={line.qty}
                                  onChange={e => setPOLineItems(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { qty: "", unit_price: "" }), qty: e.target.value } }))}
                                  placeholder="0"
                                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none" />
                              )}
                            </div>
                            <div className="col-span-3">
                              {isSelected && (
                                <input type="number" value={line.unit_price}
                                  onChange={e => setPOLineItems(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || { qty: "", unit_price: "" }), unit_price: e.target.value } }))}
                                  placeholder="0.00" step="0.01"
                                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-white/25">{poSelectedProducts.length} product{poSelectedProducts.length !== 1 ? "s" : ""} selected</p>
                  {totalValue > 0 && <p className="text-[11px] text-white/40">Total: <span className="text-white/60 font-semibold">${totalValue.toFixed(2)}</span></p>}
                </div>
              </div>

              {/* PO Details */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Order Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">PO Number</label>
                    <input value={poForm.po_number} onChange={e => setPOForm({ ...poForm, po_number: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">Requested Ship Date</label>
                    <input type="date" value={poForm.ship_date} onChange={e => setPOForm({ ...poForm, ship_date: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">Payment Terms</label>
                    <input value={poForm.payment_terms} onChange={e => setPOForm({ ...poForm, payment_terms: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/25 mb-1.5 block">Delivery Terms</label>
                    <input value={poForm.delivery_terms} onChange={e => setPOForm({ ...poForm, delivery_terms: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-white/25 mb-1.5 block">Destination / Ship To Address</label>
                    <input value={poForm.destination} onChange={e => setPOForm({ ...poForm, destination: e.target.value })}
                      placeholder="e.g. 123 Warehouse St, Brooklyn NY 11201"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-white/25 mb-1.5 block">Notes / Special Instructions</label>
                    <textarea value={poForm.notes} onChange={e => setPOForm({ ...poForm, notes: e.target.value })}
                      placeholder="e.g. Package individually, mark cartons with PO number..."
                      rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none focus:border-white/20 resize-none" />
                  </div>
                </div>
              </div>

              <button onClick={handleGeneratePO} disabled={generatingPO || poSelectedProducts.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {generatingPO ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {generatingPO ? "Generating..." : `Generate PO${poSelectedProducts.length > 0 ? ` for ${poSelectedProducts.length} Product${poSelectedProducts.length !== 1 ? "s" : ""}` : ""}`}
              </button>
            </div>

            {/* History */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-white/30" />
                <p className="text-sm font-semibold text-white">PO History</p>
              </div>
              {history.length === 0 ? (
                <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-10 text-center">
                  <FileText size={28} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No purchase orders yet</p>
                  <p className="text-white/15 text-xs mt-1">POs you generate will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((event: any) => {
                    const poNum = event.po_number;
                    const productCount = event.product_count || 0;
                    const total = event.total_value;
                    const date = new Date(event.created_at);
                    const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <div key={event.id} onClick={() => event.html_content && openPO(event.html_content)}
                        className={`bg-[#111] border border-white/[0.06] rounded-xl px-5 py-4 flex items-center justify-between hover:border-white/10 transition ${event.html_content ? "cursor-pointer" : ""}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <FileText size={13} className="text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white/80">{poNum}</p>
                              <span className="text-[10px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">
                                {productCount} product{productCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/30 mt-0.5">{dateStr} at {timeStr}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {total > 0 && <p className="text-sm font-semibold text-white/60">${total.toFixed(2)}</p>}
                          <div className="flex items-center gap-3">
                            {event.html_content && (
                              <div className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition">
                                <Eye size={11} /> View
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                              <Check size={10} /> Generated
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Send PO to Factory</p>
                <p className="text-xs text-white/30 mt-0.5">To: {emailModal.factory?.email || "factory"}</p>
              </div>
              <button onClick={() => setEmailModal(null)} className="text-white/30 hover:text-white/60 transition"><X size={14} /></button>
            </div>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Subject</label>
              <input value={emailModal.subject} onChange={e => setEmailModal({ ...emailModal, subject: e.target.value })}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Message</label>
              <textarea value={emailModal.body} onChange={e => setEmailModal({ ...emailModal, body: e.target.value })}
                rows={8} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none resize-none" />
            </div>
            <p className="text-[10px] text-white/25">📎 A PDF download link will be included in the email</p>
            <div className="flex gap-2">
              {bothConnected ? (
                <>
                  <button onClick={() => sendEmail("gmail")} disabled={sendingEmail}
                    className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                    {sendingEmail ? "Sending..." : "Send via Gmail"}
                  </button>
                  <button onClick={() => sendEmail("outlook")} disabled={sendingEmail}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/5 transition disabled:opacity-40">
                    Send via Outlook
                  </button>
                </>
              ) : (
                <button onClick={() => sendEmail()} disabled={sendingEmail}
                  className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-400 transition disabled:opacity-40">
                  {sendingEmail ? "Sending..." : "Send PO to Factory"}
                </button>
              )}
              <button onClick={() => setEmailModal(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
