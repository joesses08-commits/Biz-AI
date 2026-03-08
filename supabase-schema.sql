-- ============================================================
-- BizAI Platform — Supabase Database Schema
-- Run this in your Supabase SQL editor (supabase.com/dashboard)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── uploads ──────────────────────────────────────────────────────────────────
-- Tracks every CSV file a user uploads
create table if not exists uploads (
  id          uuid primary key default uuid_generate_v4(),
  user_id     text not null,           -- from auth or session
  type        text not null            -- 'sales' | 'costs' | 'products' | 'customers'
                check (type in ('sales', 'costs', 'products', 'customers')),
  filename    text not null,
  row_count   integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── sales_rows ────────────────────────────────────────────────────────────────
create table if not exists sales_rows (
  id            uuid primary key default uuid_generate_v4(),
  upload_id     uuid references uploads(id) on delete cascade,
  date          date,
  product_id    text,
  product_name  text,
  customer_id   text,
  customer_name text,
  revenue       numeric(12,2) not null default 0,
  quantity      numeric(10,2) not null default 0,
  discount      numeric(5,2),          -- as % e.g. 10.5 means 10.5%
  category      text,
  region        text
);

-- ── cost_rows ─────────────────────────────────────────────────────────────────
create table if not exists cost_rows (
  id          uuid primary key default uuid_generate_v4(),
  upload_id   uuid references uploads(id) on delete cascade,
  date        date,
  category    text not null,
  amount      numeric(12,2) not null default 0,
  vendor      text,
  description text
);

-- ── product_rows ──────────────────────────────────────────────────────────────
create table if not exists product_rows (
  id          uuid primary key default uuid_generate_v4(),
  upload_id   uuid references uploads(id) on delete cascade,
  product_id  text not null,
  name        text not null,
  unit_cost   numeric(10,2) not null default 0,
  unit_price  numeric(10,2) not null default 0,
  category    text,
  sku         text
);

-- ── customer_rows ─────────────────────────────────────────────────────────────
create table if not exists customer_rows (
  id               uuid primary key default uuid_generate_v4(),
  upload_id        uuid references uploads(id) on delete cascade,
  customer_id      text not null,
  name             text not null,
  segment          text,
  region           text,
  acquisition_date date
);

-- ── Indexes for common queries ─────────────────────────────────────────────────
create index if not exists idx_sales_upload_id  on sales_rows(upload_id);
create index if not exists idx_sales_date       on sales_rows(date);
create index if not exists idx_costs_upload_id  on cost_rows(upload_id);
create index if not exists idx_costs_date       on cost_rows(date);

-- ── Row-level security (RLS) ──────────────────────────────────────────────────
-- Disable for prototype (enable + add policies in production)
alter table uploads       disable row level security;
alter table sales_rows    disable row level security;
alter table cost_rows     disable row level security;
alter table product_rows  disable row level security;
alter table customer_rows disable row level security;

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Create a "csv-uploads" bucket in Supabase Dashboard > Storage
-- Set it to private (not public)
-- Reference: https://supabase.com/docs/guides/storage
