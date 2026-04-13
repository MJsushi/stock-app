"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Category = {
  code: string;
  name: string;
};

type Item = {
  id: string;
  category_code: string;
  weight: number;
  barcode: string;
  created_at: string;
};

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDateTime, setFromDateTime] = useState("");
  const [toDateTime, setToDateTime] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setItems(data);

      const { data: catData } = await supabase
        .from("categories")
        .select("code, name");

      if (catData) setCategories(catData);

      setLoading(false);
    };

    fetchData();
  }, []);

  // =========================
  // 🔥 MAP
  // =========================
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.code, c.name])
  );

  const getCategoryName = (code: string) => {
    return categoryMap[code] || code;
  };

  // =========================
// 🔥 SHIFT DATE (FIX TIMEZONE)
// =========================
const getShiftDate = (date: string) => {
  const thai = new Date(
    new Date(date).toLocaleString("en-US", {
      timeZone: "Asia/Bangkok",
    })
  );

  if (thai.getHours() >= 22) {
    thai.setDate(thai.getDate() + 1);
  }

  // ❌ ห้ามใช้ toISOString
  // ✅ ใช้ local string แทน
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${thai.getFullYear()}-${pad(
    thai.getMonth() + 1
  )}-${pad(thai.getDate())}`;
};

// =========================
// 🔥 DEFAULT SHIFT TODAY
// =========================
useEffect(() => {
  const shiftToday = getShiftDate(new Date().toISOString());

  const start = new Date(`${shiftToday}T22:00`);
  start.setDate(start.getDate() - 1);

  const end = new Date(`${shiftToday}T21:59`);

  // ✅ FIX: format ให้เป็นเวลาไทย
  const formatLocal = (d: Date) => {
    const thai = new Date(
      d.toLocaleString("en-US", {
        timeZone: "Asia/Bangkok",
      })
    );

    const pad = (n: number) => String(n).padStart(2, "0");

    return `${thai.getFullYear()}-${pad(
      thai.getMonth() + 1
    )}-${pad(thai.getDate())}T${pad(thai.getHours())}:${pad(
      thai.getMinutes()
    )}`;
  };

  setFromDateTime(formatLocal(start));
  setToDateTime(formatLocal(end));
}, []);

  // =========================
  // FILTER
  // =========================
  const filteredItems = items.filter((i) => {
    const t = new Date(i.created_at).getTime();

    const from = fromDateTime
      ? new Date(fromDateTime).getTime()
      : null;

    const to = toDateTime
      ? new Date(toDateTime).getTime()
      : null;

    if (from && t < from) return false;
    if (to && t > to) return false;

    return true;
  });

  // =========================
  // KPI
  // =========================
  const totalCount = filteredItems.length;
  const totalWeight = filteredItems.reduce((s, i) => s + i.weight, 0);
  const avgWeight = totalCount > 0 ? totalWeight / totalCount : 0;

  // =========================
  // CATEGORY
  // =========================
  const categorySummary = (() => {
    const map: Record<
      string,
      { count: number; weight: number }
    > = {};

    filteredItems.forEach((i) => {
      const name = getCategoryName(i.category_code);

      if (!map[name]) {
        map[name] = { count: 0, weight: 0 };
      }

      map[name].count++;
      map[name].weight += i.weight;
    });

    return Object.entries(map)
      .map(([name, val]) => ({
        name,
        count: val.count,
        weight: val.weight,
      }))
      .sort((a, b) => b.weight - a.weight);
  })();

  const maxWeight =
    Math.max(...categorySummary.map((c) => c.weight), 1);

  // =========================
  // 🔥 CHART (แก้ตรงนี้)
  // =========================
  const formatShiftDateDisplay = (date: string) => {
  const d = new Date(date);

  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "2-digit",
    year: "numeric",
  });
};
  const chartData = (() => {
    const map: Record<string, number> = {};

    filteredItems.forEach((i) => {
      const d = getShiftDate(i.created_at); // ✅ ใช้ shift

      map[d] = (map[d] || 0) + i.weight;
    });

    return Object.entries(map)
      .map(([date, weight]) => ({
        date,
        weight,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  // =========================
  // 🔥 EXPORT excel
  // =========================
  const exportExcel = () => {
    const data = filteredItems.map((i, index) => {
      // 👉 เวลาไทย
      const thai = new Date(
        new Date(i.created_at).toLocaleString("en-US", {
          timeZone: "Asia/Bangkok",
        })
      );

      // 👉 created_date (วัน+เวลา)
      const createdDate = thai.toLocaleString("th-TH");

      // 👉 shift date logic
      const shift = new Date(thai);
      if (shift.getHours() >= 22) {
        shift.setDate(shift.getDate() + 1);
      }

      // 👉 format 8/04/2024
      const shiftDate = shift.toLocaleDateString("th-TH", {
        day: "numeric",     // 8
        month: "2-digit",   // 04
        year: "numeric",    // 2024
      });

      return {
        ลำดับ: index + 1,
        ประเภท: getCategoryName(i.category_code),
        น้ำหนัก: i.weight,
        barcode: i.barcode,

        // 🔥 เพิ่ม 2 ช่องนี้
        created_date: createdDate,
        shiftdate: shiftDate,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "data");

    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    const fileName = `dashboard_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    saveAs(
      new Blob([excelBuffer], {
        type: "application/octet-stream",
      }),
      fileName
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-100 to-gray-200 p-2 sm:p-4 text-gray-900">
        <div className="max-w-4xl mx-auto w-full">    

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-gray-700">
            📊 Dashboard คลังสินค้า
          </h1>

          <div className="flex gap-2 items-center">
            <Link
              href="/scan"
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              Scan
            </Link>

            <button
              onClick={exportExcel}
              className="bg-green-500 text-white px-3 py-2 rounded-xl text-xs"
            >
              Export
            </button>

            <div className="text-xs text-gray-400">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <input
            type="datetime-local"
            value={fromDateTime}
            onChange={(e) => setFromDateTime(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <input
            type="datetime-local"
            value={toDateTime}
            onChange={(e) => setToDateTime(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <button
            onClick={() => {
              setFromDateTime("");
              setToDateTime("");
            }}
            className="bg-gray-200 px-3 py-1 rounded"
          >
            รีเซ็ต
          </button>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs sm:text-sm">
          <Card title="จำนวนทั้งหมด" value={totalCount} color="text-blue-600" />
          <Card title="น้ำหนักรวม (kg)" value={totalWeight.toFixed(3)} color="text-green-600" />
          <Card title="เฉลี่ย/รายการ" value={avgWeight.toFixed(3)} color="text-purple-600" />
          <Card title="ประเภทสินค้า" value={categorySummary.length} color="text-gray-700" />
        </div>

        {/* GRAPH */}
        <div className="bg-white rounded-2xl shadow p-3 mb-3">
          <div className="text-sm font-semibold mb-2">
            📈 น้ำหนักรายวัน
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShiftDateDisplay}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(label) =>
                    formatShiftDateDisplay(label as string)
                  }
                  formatter={(value: number) => value.toFixed(3)}
                />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MAIN */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

          <div className="xl:col-span-2 bg-white rounded-2xl shadow overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_120px] p-3 bg-gray-50 text-xs sm:text-sm font-semibold border-b">
              <span>สินค้า</span>
              <span>จำนวน</span>
              <span>น้ำหนัก</span>
            </div>

            <div className="divide-y text-xs sm:text-sm">
              {categorySummary.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_120px] p-3">
                  <span>{c.name}</span>
                  <span>{c.count}</span>
                  <span className="font-semibold text-blue-700">
                    {c.weight.toFixed(3)} kg
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-3">
            <div className="text-sm font-semibold mb-2">
              สัดส่วนตามน้ำหนัก
            </div>

            <div className="space-y-2 text-xs sm:text-sm">
            {categorySummary.map((c, i) => {
                const percent = (c.weight / maxWeight) * 100;

                return (
                <div key={i}>
                    <div className="flex justify-between">
                    <span>
                        {c.name} 
                        <span className="text-gray-400 ml-1">
                        ({c.count})
                        </span>
                    </span>

                    <span>
                        {c.weight.toFixed(1)} kg
                    </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percent}%` }}
                    />
                    </div>
                </div>
                );
            })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// CARD
function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: any;
  color: string;
}) {
  return (
    <div className="bg-white p-3 rounded-2xl shadow">
      <div className="text-gray-400">{title}</div>
      <div className={`font-bold text-lg ${color}`}>
        {value}
      </div>
    </div>
  );
}