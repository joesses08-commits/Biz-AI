"use client";

import { useEffect, useState } from "react";

export default function QuickBooksPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quickbooks/data")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-white text-lg">Loading QuickBooks data...</p></div>;
  }

  if (!data || !data.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-3xl font-bold mb-4">QuickBooks Not Connected</h1>
          <p className="text-gray-400 mb-8">Connect your QuickBooks account to see your financial data.</p>
          <a href="/api/quickbooks/connect" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg">Connect QuickBooks</a>
        </div>
      </div>
    );
  }

  const invoices = data.invoices || [];
  const unpaidInvoices = invoices.filter((inv: any) => inv.Balance > 0);
  const totalUnpaid = unpaidInvoices.reduce((sum: number, inv: any) => sum + inv.Balance, 0);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">QuickBooks</h1>
            <p className="text-green-400 text-sm">Connected</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Outstanding Invoices</h2>
            <span className="text-yellow-400 font-bold">${totalUnpaid.toLocaleString()} unpaid</span>
          </div>
          {unpaidInvoices.length === 0 ? (
            <p className="text-gray-400">No outstanding invoices.</p>
          ) : (
            <div className="space-y-3">
              {unpaidInvoices.map((inv: any) => (
                <div key={inv.Id} className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <p className="font-medium">{inv.CustomerRef?.name || "Unknown Customer"}</p>
                    <p className="text-gray-400 text-sm">Invoice #{inv.DocNumber} · {inv.TxnDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">${inv.Balance.toLocaleString()} due</p>
                    <p className="text-gray-400 text-sm">Total: ${inv.TotalAmt.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-gray-400">No invoices found.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv: any) => (
                <div key={inv.Id} className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <p className="font-medium">{inv.CustomerRef?.name || "Unknown Customer"}</p>
                    <p className="text-gray-400 text-sm">Invoice #{inv.DocNumber} · {inv.TxnDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${inv.TotalAmt.toLocaleString()}</p>
                    <p className={inv.Balance > 0 ? "text-yellow-400 text-sm" : "text-green-400 text-sm"}>{inv.Balance > 0 ? `$${inv.Balance.toLocaleString()} due` : "Paid"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
