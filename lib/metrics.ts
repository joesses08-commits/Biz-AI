import { createServerClient } from "./supabase";
import { BusinessMetrics, ProductMetric, CustomerMetric, CostCategory, MonthlyDataPoint } from "@/types";
import { toYearMonth } from "./utils";

export async function computeMetrics(): Promise<BusinessMetrics | null> {
  const supabase = createServerClient();
  const userId = "demo-user";

  // Get latest upload IDs for each type
  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, type")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!uploads?.length) return null;

  const getUploadId = (type: string) => uploads.find(u => u.type === type)?.id;
  const salesId = getUploadId("sales");
  const costsId = getUploadId("costs");

  if (!salesId) return null;

  // ── Sales ──────────────────────────────────────────────────────────────────
  const { data: salesRows } = await supabase
    .from("sales_rows")
    .select("*")
    .eq("upload_id", salesId);

  const { data: costRows } = costsId
    ? await supabase.from("cost_rows").select("*").eq("upload_id", costsId)
    : { data: [] };

  const sales = salesRows || [];
  const costs = costRows || [];

  // Top-line metrics
  const totalRevenue = sales.reduce((s, r) => s + Number(r.revenue), 0);
  const totalCosts = costs.reduce((s, r) => s + Number(r.amount), 0);
  const grossProfit = totalRevenue - totalCosts;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const revenueByMonth: Record<string, number> = {};
  const costsByMonth: Record<string, number> = {};

  sales.forEach(r => {
    const m = r.date ? toYearMonth(r.date) : "Unknown";
    revenueByMonth[m] = (revenueByMonth[m] || 0) + Number(r.revenue);
  });
  costs.forEach(r => {
    const m = r.date ? toYearMonth(r.date) : "Unknown";
    costsByMonth[m] = (costsByMonth[m] || 0) + Number(r.amount);
  });

  const allMonths = [...new Set([...Object.keys(revenueByMonth), ...Object.keys(costsByMonth)])]
    .filter(m => m !== "Unknown")
    .sort();

  const monthlyTrend: MonthlyDataPoint[] = allMonths.map(month => {
    const rev = revenueByMonth[month] || 0;
    const cost = costsByMonth[month] || 0;
    return { month, revenue: rev, costs: cost, profit: rev - cost };
  });

  // MoM change (last 2 months)
  let momRevenueChange: number | null = null;
  let momMarginChange: number | null = null;
  if (monthlyTrend.length >= 2) {
    const last = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend[monthlyTrend.length - 2];
    momRevenueChange = prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : null;
    const lastMargin = last.revenue > 0 ? (last.profit / last.revenue) * 100 : 0;
    const prevMargin = prev.revenue > 0 ? (prev.profit / prev.revenue) * 100 : 0;
    momMarginChange = lastMargin - prevMargin;
  }

  // ── Top products ──────────────────────────────────────────────────────────
  const productMap: Record<string, ProductMetric> = {};
  sales.forEach(r => {
    const id = r.product_id || r.product_name || "Unknown";
    const name = r.product_name || r.product_id || "Unknown";
    if (!productMap[id]) productMap[id] = { id, name, revenue: 0, units: 0 };
    productMap[id].revenue += Number(r.revenue);
    productMap[id].units += Number(r.quantity);
  });
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Top customers ─────────────────────────────────────────────────────────
  const customerMap: Record<string, CustomerMetric> = {};
  sales.forEach(r => {
    const id = r.customer_name || r.customer_id || "Unknown";
    if (!customerMap[id]) customerMap[id] = { id, name: id, revenue: 0, orders: 0 };
    customerMap[id].revenue += Number(r.revenue);
    customerMap[id].orders += 1;
  });
  const topCustomers = Object.values(customerMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Cost breakdown ────────────────────────────────────────────────────────
  const costMap: Record<string, number> = {};
  costs.forEach(r => {
    const cat = r.category || "Other";
    costMap[cat] = (costMap[cat] || 0) + Number(r.amount);
  });
  const costBreakdown: CostCategory[] = Object.entries(costMap)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: totalCosts > 0 ? (amount / totalCosts) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalRevenue,
    totalCosts,
    grossProfit,
    grossMarginPct,
    momRevenueChange,
    momMarginChange,
    topProducts,
    topCustomers,
    costBreakdown,
    monthlyTrend,
  };
}
