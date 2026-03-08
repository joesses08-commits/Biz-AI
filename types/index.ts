// ─── CSV Row Types ─────────────────────────────────────────────────────────────

export interface SalesRow {
  date: string;
  product_id: string;
  product_name?: string;
  customer_id?: string;
  customer_name?: string;
  revenue: number;
  quantity: number;
  discount?: number;
  category?: string;
  region?: string;
}

export interface CostRow {
  date: string;
  category: string;
  amount: number;
  vendor?: string;
  description?: string;
}

export interface ProductRow {
  product_id: string;
  name: string;
  unit_cost: number;
  unit_price: number;
  category?: string;
  sku?: string;
}

export interface CustomerRow {
  customer_id: string;
  name: string;
  segment?: string;
  region?: string;
  acquisition_date?: string;
}

// ─── Upload Types ──────────────────────────────────────────────────────────────

export type DatasetType = "sales" | "costs" | "products" | "customers";

export interface UploadedDataset {
  type: DatasetType;
  filename: string;
  rowCount: number;
  uploadedAt: string;
  // Raw parsed rows stored in Supabase
}

export interface UploadState {
  sales: UploadedDataset | null;
  costs: UploadedDataset | null;
  products: UploadedDataset | null;
  customers: UploadedDataset | null;
}

// ─── Metrics Types ─────────────────────────────────────────────────────────────

export interface BusinessMetrics {
  // Top-line
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  grossMarginPct: number;

  // Trend (month-over-month)
  momRevenueChange: number | null;   // % change
  momMarginChange: number | null;    // pp change

  // Breakdowns
  topProducts: ProductMetric[];
  topCustomers: CustomerMetric[];
  costBreakdown: CostCategory[];
  monthlyTrend: MonthlyDataPoint[];
}

export interface ProductMetric {
  id: string;
  name: string;
  revenue: number;
  units: number;
  margin?: number;   // % if product cost data available
}

export interface CustomerMetric {
  id: string;
  name: string;
  revenue: number;
  orders: number;
}

export interface CostCategory {
  category: string;
  amount: number;
  pct: number;
}

export interface MonthlyDataPoint {
  month: string;    // "2024-01"
  revenue: number;
  costs: number;
  profit: number;
}

// ─── Chat Types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  structured?: StructuredAnalysis;  // parsed from assistant markdown
}

export interface StructuredAnalysis {
  problem?: string;
  keyDataPoints?: string[];
  likelyCauses?: string[];
  options?: DecisionOption[];
  assumptions?: string[];
}

export interface DecisionOption {
  label: string;
  action: string;
  expectedOutcome: string;
  riskLevel: "Low" | "Medium" | "High";
}

// ─── Supabase DB types (mirrors DB schema) ────────────────────────────────────

export interface DBUpload {
  id: string;
  user_id: string;
  type: DatasetType;
  filename: string;
  row_count: number;
  created_at: string;
}
