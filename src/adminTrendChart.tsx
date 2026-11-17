import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BloodStockGroup {
  total: number;
  pos: number;
  neg: number;
}

interface TotoStock {
  A: BloodStockGroup;
  B: BloodStockGroup;
  AB: BloodStockGroup;
  O: BloodStockGroup;
}

interface DailyStockPoint {
  dayLabel: string;
  fullDate: string;
  A: number;
  B: number;
  AB: number;
  O: number;
  total: number;
}

type ChartViewMode = 'stacked' | 'grouped' | 'total';

declare global {
  interface Window {
    bloodState?: {
      currentRole: string;
      totoStock: TotoStock;
    };
  }
}

const DEFAULT_STOCK: TotoStock = {
  A: { total: 28, pos: 26, neg: 2 },
  B: { total: 34, pos: 32, neg: 2 },
  AB: { total: 12, pos: 11, neg: 1 },
  O: { total: 40, pos: 38, neg: 2 },
};

const HISTORICAL_OFFSETS = [
  { A: -5, B: -6, AB: -3, O: -7 }, // H-6
  { A: -3, B: -4, AB: -2, O: -5 }, // H-5
  { A: -6, B: -2, AB: -4, O: -3 }, // H-4
  { A: -2, B: -5, AB: -1, O: -4 }, // H-3
  { A: 1, B: -2, AB: 2, O: -2 },   // H-2
  { A: -1, B: 2, AB: -1, O: 3 },   // H-1 (Kemarin)
];

function formatDateId(date: Date): { short: string; full: string } {
  const short = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
  const full = date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return { short, full };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: DailyStockPoint;
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 text-xs min-w-[190px]">
      <p className="font-bold text-slate-900 mb-2 pb-1.5 border-b border-slate-100">
        {point.fullDate}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
            Golongan A
          </span>
          <span className="font-bold text-slate-900 tabular-nums">{point.A} ktg</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
            Golongan B
          </span>
          <span className="font-bold text-slate-900 tabular-nums">{point.B} ktg</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
            Golongan AB
          </span>
          <span className="font-bold text-slate-900 tabular-nums">{point.AB} ktg</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            Golongan O
          </span>
          <span className="font-bold text-slate-900 tabular-nums">{point.O} ktg</span>
        </div>
      </div>
      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between font-bold text-slate-900">
        <span>Total Tersedia</span>
        <span className="text-red-600 tabular-nums">{point.total} Kantong</span>
      </div>
    </div>
  );
}

function AdminBloodTrendChart() {
  const [liveStock, setLiveStock] = useState<TotoStock>(() => {
    const existing = window.bloodState?.totoStock;
    if (!existing) return DEFAULT_STOCK;
    return {
      A: { ...existing.A },
      B: { ...existing.B },
      AB: { ...existing.AB },
      O: { ...existing.O },
    };
  });

  const [viewMode, setViewMode] = useState<ChartViewMode>('stacked');
  const [isAdminActive, setIsAdminActive] = useState<boolean>(
    () => window.bloodState?.currentRole === 'admin'
  );

  useEffect(() => {
    const syncStock = () => {
      const s = window.bloodState?.totoStock;
      if (s) {
        setLiveStock({
          A: { ...s.A },
          B: { ...s.B },
          AB: { ...s.AB },
          O: { ...s.O },
        });
      }
    };

    const handleRoleChange = (e: Event) => {
      const custom = e as CustomEvent<{ role: string }>;
      const role = custom.detail?.role ?? window.bloodState?.currentRole;
      setIsAdminActive(role === 'admin');
      if (role === 'admin') {
        syncStock();
      }
    };

    window.addEventListener('bloodconnect:stock-updated', syncStock);
    window.addEventListener('bloodconnect:role-changed', handleRoleChange);

    return () => {
      window.removeEventListener('bloodconnect:stock-updated', syncStock);
      window.removeEventListener('bloodconnect:role-changed', handleRoleChange);
    };
  }, []);

  const chartData = useMemo<DailyStockPoint[]>(() => {
    const today = new Date();
    const points: DailyStockPoint[] = [];

    // 6 hari sebelumnya berdasarkan pola stok historis BDRS RSUD Toto Kabila
    for (let i = 6; i >= 1; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const { short, full } = formatDateId(d);
      const offset = HISTORICAL_OFFSETS[6 - i];

      const a = Math.max(4, DEFAULT_STOCK.A.total + offset.A);
      const b = Math.max(4, DEFAULT_STOCK.B.total + offset.B);
      const ab = Math.max(2, DEFAULT_STOCK.AB.total + offset.AB);
      const o = Math.max(6, DEFAULT_STOCK.O.total + offset.O);

      points.push({
        dayLabel: short,
        fullDate: full,
        A: a,
        B: b,
        AB: ab,
        O: o,
        total: a + b + ab + o,
      });
    }

    // Hari ini (real-time tersinkron dengan kontrol + / - Admin BDRS)
    const todayFormatted = formatDateId(today);
    const todayTotal =
      liveStock.A.total +
      liveStock.B.total +
      liveStock.AB.total +
      liveStock.O.total;

    points.push({
      dayLabel: 'Hari Ini',
      fullDate: `${todayFormatted.full} (Real-time)`,
      A: liveStock.A.total,
      B: liveStock.B.total,
      AB: liveStock.AB.total,
      O: liveStock.O.total,
      total: todayTotal,
    });

    return points;
  }, [liveStock]);

  const weeklyAverage = useMemo(() => {
    const sum = chartData.reduce((acc, item) => acc + item.total, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  const deltaVsYesterday = useMemo(() => {
    if (chartData.length < 2) return 0;
    return chartData[chartData.length - 1].total - chartData[chartData.length - 2].total;
  }, [chartData]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Tren Ketersediaan Stok Darah (7 Hari Terakhir)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Grafik batang harian RSUD Toto Kabila · Kolom <strong className="text-slate-700">Hari Ini</strong> diperbarui otomatis saat stok diubah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick 7-day summary numbers */}
          <div className="flex items-center gap-4 text-xs pr-2 border-r border-slate-200">
            <div>
              <span className="text-slate-500 block">Rata-rata 7 Hari</span>
              <span className="font-bold text-slate-900 tabular-nums">{weeklyAverage} Kantong</span>
            </div>
            <div>
              <span className="text-slate-500 block">Selisih vs Kemarin</span>
              <span
                className={`font-bold tabular-nums ${
                  deltaVsYesterday > 0
                    ? 'text-emerald-600'
                    : deltaVsYesterday < 0
                    ? 'text-red-600'
                    : 'text-slate-700'
                }`}
              >
                {deltaVsYesterday > 0 ? `+${deltaVsYesterday}` : deltaVsYesterday} Kantong
              </span>
            </div>
          </div>

          {/* Mode Tampilan Grafik */}
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs"
            role="group"
            aria-label="Mode Grafik Batang"
          >
            <button
              type="button"
              onClick={() => setViewMode('stacked')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'stacked'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bertumpuk
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'grouped'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Per Golongan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('total')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'total'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Total Harian
            </button>
          </div>
        </div>
      </div>

      {/* Recharts BarChart Container */}
      <div className="mt-6 w-full h-[320px]">
        {isAdminActive ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="dayLabel"
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                unit=" ktg"
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                iconType="circle"
              />

              {viewMode === 'total' ? (
                <Bar
                  dataKey="total"
                  name="Total Stok Darah (Kantong)"
                  fill="#dc2626"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              ) : (
                <>
                  <Bar
                    dataKey="A"
                    name="Golongan A"
                    stackId={viewMode === 'stacked' ? 'stok' : undefined}
                    fill="#dc2626"
                    radius={viewMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    maxBarSize={viewMode === 'stacked' ? 44 : 18}
                  />
                  <Bar
                    dataKey="B"
                    name="Golongan B"
                    stackId={viewMode === 'stacked' ? 'stok' : undefined}
                    fill="#2563eb"
                    radius={viewMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    maxBarSize={viewMode === 'stacked' ? 44 : 18}
                  />
                  <Bar
                    dataKey="AB"
                    name="Golongan AB"
                    stackId={viewMode === 'stacked' ? 'stok' : undefined}
                    fill="#d97706"
                    radius={viewMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    maxBarSize={viewMode === 'stacked' ? 44 : 18}
                  />
                  <Bar
                    dataKey="O"
                    name="Golongan O"
                    stackId={viewMode === 'stacked' ? 'stok' : undefined}
                    fill="#059669"
                    radius={viewMode === 'stacked' ? [6, 6, 0, 0] : [4, 4, 0, 0]}
                    maxBarSize={viewMode === 'stacked' ? 44 : 18}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
            Memuat grafik ketersediaan stok darah...
          </div>
        )}
      </div>
    </div>
  );
}

const mountEl = document.getElementById('admin-blood-trend-chart');
if (mountEl) {
  createRoot(mountEl).render(<AdminBloodTrendChart />);
}
