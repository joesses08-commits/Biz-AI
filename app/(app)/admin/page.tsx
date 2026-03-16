"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const ADMIN_EMAIL = "jo.esses08@gmail.com";

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: string;
  status: string;
  stripe_customer_id: string;
  created_at: string;
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", plan: "starter" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email === ADMIN_EMAIL) {
      setAuthorized(true);
      loadCustomers();
    } else {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    const res = await fetch("/api/admin/customers");
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  }

  async function createCustomer() {
    if (!form.name || !form.email) {
      setMessage("Name and email are required.");
      return;
    }
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) {
      setMessage(data.error);
    } else {
      setMessage("Customer created successfully.");
      setForm({ name: "", email: "", company: "", plan: "starter" });
      setShowForm(false);
      loadCustomers();
    }
    setSaving(false);
  }

  async function sendPaymentLink(customer: Customer) {
    const res = await fetch("/api/admin/payment-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id, email: customer.email, plan: customer.plan }),
    });
    const data = await res.json();
    if (data.url) {
      navigator.clipboard.writeText(data.url);
      setMessage(`Payment link copied for ${customer.name}`);
    } else {
      setMessage("Failed to create payment link.");
    }
  }

  async function updateStatus(customerId: string, status: string) {
    await fetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, status }),
    });
    loadCustomers();
  }

  if (!loading && !authorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl font-bold">Access Denied</p>
          <p className="text-gray-400 mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const planPrice: Record<string, string> = {
    starter: "$299/mo",
    growth: "$999/mo",
    professional: "$2,500/mo",
    enterprise: "Custom",
  };

  const statusColor: Record<string, string> = {
    trial: "text-yellow-400",
    active: "text-green-400",
    churned: "text-red-400",
    pending: "text-blue-400",
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-400 text-sm mt-1">Manage customers and billing</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-white text-black font-bold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition"
          >
            + New Customer
          </button>
        </div>

        {message && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-3 mb-6">
            <p className="text-green-400 text-sm">{message}</p>
          </div>
        )}

        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Create New Customer</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Email *</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Company</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white"
                >
                  <option value="starter">Starter — $299/mo</option>
                  <option value="growth">Growth — $999/mo</option>
                  <option value="professional">Professional — $2,500/mo</option>
                  <option value="enterprise">Enterprise — Custom</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={createCustomer}
                disabled={saving}
                className="bg-white text-black font-bold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Customer"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="bg-gray-800 text-white px-6 py-2.5 rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Customers</p>
            <p className="text-3xl font-bold">{customers.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Active</p>
            <p className="text-3xl font-bold text-green-400">{customers.filter(c => c.status === "active").length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Trial</p>
            <p className="text-3xl font-bold text-yellow-400">{customers.filter(c => c.status === "trial").length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">MRR</p>
            <p className="text-3xl font-bold text-green-400">
              ${customers.filter(c => c.status === "active").reduce((sum, c) => {
                const prices: Record<string, number> = { starter: 299, growth: 999, professional: 2500, enterprise: 0 };
                return sum + (prices[c.plan] || 0);
              }, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-xl font-bold">Customers</h2>
          </div>
          {loading ? (
            <div className="p-6"><p className="text-gray-400">Loading...</p></div>
          ) : customers.length === 0 ? (
            <div className="p-6"><p className="text-gray-400">No customers yet. Create your first one above.</p></div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-400 text-sm font-medium">Customer</th>
                  <th className="text-left px-6 py-3 text-gray-400 text-sm font-medium">Plan</th>
                  <th className="text-left px-6 py-3 text-gray-400 text-sm font-medium">Status</th>
                  <th className="text-left px-6 py-3 text-gray-400 text-sm font-medium">Joined</th>
                  <th className="text-left px-6 py-3 text-gray-400 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                    <td className="px-6 py-4">
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-gray-400 text-sm">{customer.email}</p>
                      {customer.company && <p className="text-gray-500 text-xs">{customer.company}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium capitalize">{customer.plan}</span>
                      <p className="text-gray-400 text-xs">{planPrice[customer.plan]}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={customer.status}
                        onChange={(e) => updateStatus(customer.id, e.target.value)}
                        className={`bg-transparent text-sm font-medium ${statusColor[customer.status] || "text-white"} border border-gray-700 rounded px-2 py-1`}
                      >
                        <option value="trial">Trial</option>
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="churned">Churned</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => sendPaymentLink(customer)}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                      >
                        Copy Payment Link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
