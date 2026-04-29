"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Supplier = {
  id: number;
  name: string;
  code: string;
};

type Lot = {
  id: number;
  code: string;
  supplier_id: number | null;
  supplier_name: string;
  weight: number;
  type: string | null;
  created_at: string | null;
  shift_date: string | null;
  batch_no?: number;
};

const TYPES = [
  { code: "01", name: "หมูซาก" },
  { code: "02", name: "หมูซีก" },
  { code: "03", name: "หมูขุน" },
  { code: "04", name: "ชิ้นส่วน" },
];

const getSupplierType = (typeCode: string | null) => {
  if (!typeCode) return "";
  const found = TYPES.find((t) => t.code === typeCode);
  return found ? ` - ${found.name}` : "";
};

// ✅ SHIFT 22:00
const getShiftDate = (date?: string | Date) => {
  const d = date ? new Date(date) : new Date();

  const local = new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );

  if (local.getHours() >= 22) {
    local.setDate(local.getDate() + 1);
  }

  return local.toLocaleDateString("en-CA"); // YYYY-MM-DD
};

export default function InboundPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [type, setType] = useState("01");
  const [weight, setWeight] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [sortKey, setSortKey] = useState<"date" | "supplier" | "created">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 40;//กำหนดแสดงผลต่อหน้า

  const [receiveWeight, setReceiveWeight] = useState("");
  const [editShiftDate, setEditShiftDate] = useState<string | null>(null);
  const [currentShiftReceive, setCurrentShiftReceive] = useState<number | null>(null);

  const [shiftReceive, setShiftReceive] = useState<Record<string, number>>({});

  const triggerHighlight = (id: number) => {
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1500);
  };

  useEffect(() => {
    fetchSuppliers();
    fetchLots();
    fetchShiftSummary();
  }, []);

  useEffect(() => {
    fetchShiftReceive();
  }, [supplierId, type]);

  // =====================
  // FETCH
  // =====================
  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("id");
    if (data) setSuppliers(data);
  };

  const fetchLots = async () => {
    const { data } = await supabase
      .from("receive_lots")
      .select(`id,code,supplier_id,type,total_weight,suppliers(name),created_at,shift_date,batch_no`)
      .order("id", { ascending: false });

    if (data) {
      setLots(
        data.map((l: any) => ({
          id: l.id,
          code: l.code,
          supplier_id: l.supplier_id,
          supplier_name: l.suppliers?.name || "-",
          weight: l.total_weight,
          type: l.type,
          created_at: l.created_at,
          shift_date: l.shift_date,
          batch_no: l.batch_no,
        }))
      );
    }
  };

  // =====================
  // SHIFT SUMMARY
  // =====================
  const fetchShiftSummary = async () => {
    const { data } = await supabase.from("shift_summaries").select("*");

    if (data) {
      const map: Record<string, number> = {};

      data.forEach((d: any) => {
        const key = `${d.shift_date}-${d.supplier_id}-${d.type}`;
        map[key] = Number(d.receive_weight || 0);
      });

      setShiftReceive(map);
    }
  };

  const fetchShiftReceive = async () => {
    if (!supplierId) return;

    const shiftDate = getShiftDate();

    const { data } = await supabase
      .from("shift_summaries")
      .select("receive_weight")
      .eq("shift_date", shiftDate)
      .eq("supplier_id", supplierId)
      .eq("type", type)
      .maybeSingle();

    setCurrentShiftReceive(data?.receive_weight ?? null);
  };

  // ✅ เพิ่ม state
  const [isEditingReceive, setIsEditingReceive] = useState(false);

  // =====================
  // SAVE RECEIVE (FIX: UPSERT + EDIT MODE)
  // =====================
  const saveReceiveWeight = async () => {
    if (!supplierId) return;

    const shiftDate = editShiftDate || getShiftDate();
    const w = parseFloat(receiveWeight);

    if (isNaN(w)) return;

    const { error } = await supabase
      .from("shift_summaries")
      .upsert(
        [
          {
            shift_date: shiftDate,
            supplier_id: supplierId,
            type,
            receive_weight: w,
          },
        ],
        {
          onConflict: "shift_date,supplier_id,type",
        }
      );

    if (error) {
      console.error("save error:", error);
      return;
    }

    const key = `${shiftDate}-${supplierId}-${type}`;

    setShiftReceive((prev) => ({
      ...prev,
      [key]: w,
    }));

    setCurrentShiftReceive(w);
    setReceiveWeight("");
    setEditShiftDate(null);

    // ✅ reset edit mode
    setIsEditingReceive(false);
  };

  // =====================
  // GENERATE CODE
  // =====================
  const generateCode = async (
    supplierCode: string,
    type: string,
    weight: number,
    supplierId: number,
    shiftDate: string
  ) => {
    const now = new Date();

    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);

    const w = Math.round(weight * 1000).toString().padStart(5, "0");

    const { data } = await supabase
      .from("receive_lots")
      .select("code")
      .eq("supplier_id", supplierId)
      .eq("type", type)
      .eq("shift_date", shiftDate)
      .order("id", { ascending: false })
      .limit(1);

    let last = 0;

    if (data?.[0]?.code) {
      const match = data[0].code.match(/(\d{4})$/);
      if (match) last = parseInt(match[1], 10);
    }

    return `${supplierCode}${type}${dd}${mm}${yy}${w}${String(
      last + 1
    ).padStart(4, "0")}`;
  };

  const getNextBatchNo = async (shiftDate: string) => {
    const { data } = await supabase
      .from("receive_lots")
      .select("batch_no")
      .eq("shift_date", shiftDate)
      .order("batch_no", { ascending: false })
      .limit(1);

    return data?.length ? (data[0].batch_no || 0) + 1 : 1;
  };

  // =====================
  // ADD LOT
  // =====================
  const addLot = async () => {
    if (!currentShiftReceive) return;
    if (!supplierId || !weight) return;

    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;

    const w = parseFloat(weight);
    const shiftDate = getShiftDate();

    const code = await generateCode(
      supplier.code,
      type,
      w,
      supplierId,
      shiftDate
    );

    const batchNo = await getNextBatchNo(shiftDate);

    const { data } = await supabase
      .from("receive_lots")
      .insert([
        {
          supplier_id: supplierId,
          total_weight: w,
          type,
          code,
          shift_date: shiftDate,
          batch_no: batchNo,
        },
      ])
      .select();

    if (data?.[0]) triggerHighlight(data[0].id);

    setWeight("");
    fetchLots();
  };

  const handleEdit = (l: Lot) => {
    setEditingId(l.id);
    setSupplierId(l.supplier_id);
    setType(l.type || "01");
    setWeight(String(l.weight));
  };

  const updateLot = async () => {
    if (!editingId) return;

    await supabase
      .from("receive_lots")
      .update({
        supplier_id: supplierId,
        total_weight: parseFloat(weight),
        type,
      })
      .eq("id", editingId);

    triggerHighlight(editingId);

    setEditingId(null);
    setWeight("");
    fetchLots();
  };

  const deleteLot = async (id: number) => {
    await supabase.from("receive_lots").delete().eq("id", id);
    fetchLots();
  };

  // =====================
  // SHIFT LOSS FIX KEY (NO DUP KEY ERROR)
  // =====================
  const filteredLots = lots.filter((l) => {
    const q = search.toLowerCase();

    return (
      (!q ||
        l.code?.toLowerCase().includes(q) ||
        l.supplier_name?.toLowerCase().includes(q)) &&
      (!filterSupplier || String(l.supplier_id) === filterSupplier) &&
      (!filterType || l.type === filterType) &&
      (!filterDate ||
        (l.shift_date || getShiftDate(new Date(l.created_at || ""))) === filterDate)
    );
  });

  const sortedLots = [...filteredLots].sort((a, b) => {
    const dir = sortOrder === "asc" ? 1 : -1;

    const typeOrder = TYPES.map((t) => t.code);

    // 🔹 primary (ตามที่ user กด)
    let primary = 0;

    if (sortKey === "date") {
      primary =
        new Date(a.shift_date || "").getTime() -
        new Date(b.shift_date || "").getTime();
    }

    if (sortKey === "supplier") {
      primary = a.supplier_name.localeCompare(b.supplier_name);
    }

    if (sortKey === "created") {
      primary =
        new Date(a.created_at || "").getTime() -
        new Date(b.created_at || "").getTime();
    }

    if (primary !== 0) return primary * dir;

    // 🔽 fallback multi-level (เหมือนเดิม)
    const d =
      new Date(a.shift_date || "").getTime() -
      new Date(b.shift_date || "").getTime();
    if (d !== 0) return d * dir;

    const s = a.supplier_name.localeCompare(b.supplier_name);
    if (s !== 0) return s * dir;

    const t =
      typeOrder.indexOf(a.type || "") -
      typeOrder.indexOf(b.type || "");
    if (t !== 0) return t * dir;

    return (
      new Date(a.created_at || "").getTime() -
      new Date(b.created_at || "").getTime()
    ) * dir;
  });

  const summary: Record<string, number> = {};

  sortedLots.forEach((l) => {
    const key = `${l.shift_date}-${l.supplier_id}-${l.type}`;
    summary[key] = (summary[key] || 0) + Number(l.weight || 0);
  });

  const shiftLoss = Object.keys(summary).map((key) => {
    const total = summary[key];
    const receive = shiftReceive[key] || 0;

    return {
      key, // ✅ FIX UNIQUE KEY
      receive,
      total,
      diff: receive - total,
      percent: receive ? ((receive - total) / receive) * 100 : 0,
    };
  });
  const [lossPage, setLossPage] = useState(1);
  const LOSS_PER_PAGE = 5;
  const totalLossPages = Math.ceil(shiftLoss.length / LOSS_PER_PAGE);
  const paginatedLoss = shiftLoss.slice(
    (lossPage - 1) * LOSS_PER_PAGE,
    lossPage * LOSS_PER_PAGE
  );



  const totalPages = Math.max(1, Math.ceil(sortedLots.length / ITEMS_PER_PAGE));

  const paginatedLots = sortedLots.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // reset ตอน filter เปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
    setLossPage(1); // 🔥 reset Loss ด้วย
  }, [
    search,
    filterSupplier,
    filterType,
    filterDate,
    sortKey,
    sortOrder,
  ]);

  // สี diff
  const renderValue = (
    n?: number,
    options?: {
      unit?: string;      // " kg" | "%"
      decimals?: number;  // 3 สำหรับ kg, 2 สำหรับ %
    }
  ) => {
    if (typeof n !== "number") return "-";

    const { unit = "", decimals = 3 } = options || {};

    // 🔹 แปลงค่า: บวก(หาย) → แสดงลบ, ลบ(เกิน) → แสดงบวก
    const displayValue = n > 0 ? -n : Math.abs(n);

    const formatted = displayValue.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    // 🔹 สีตามความหมายจริง (ไม่ใช่ค่าที่แสดง)
    const color =
      n > 0 ? "text-red-600" : n < 0 ? "text-green-600" : "text-gray-500";

    return (
      <span className={`font-semibold ${color}`}>
        {formatted}
        {unit}
      </span>
    );
  };
  
  return (
    <div className="min-h-screen bg-linear-to-t from-gray-100 to-gray-200 p-2 sm:p-4 text-gray-900">
      <div className="max-w-4xl mx-auto w-full">
   
        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          <h1 className="font-bold text-lg">📥 Inbound</h1>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSearchOpen(!searchOpen)} className="bg-gray-200 px-3 py-2 rounded-xl text-xs">🔍</button>

            {searchOpen && (
              <>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="border p-2 rounded-xl text-sm w-32 sm:w-48" />

                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="border p-2 rounded-xl text-xs">
                  <option value="">supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border p-2 rounded-xl text-xs">
                  <option value="">type</option>
                  {TYPES.map((t) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>

                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="border p-2 rounded-xl text-xs" />
              </>
            )}

            <Link href="/scan" className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs">📦 Scan</Link>
            <Link href="/dashboard" className="bg-green-600 text-white px-3 py-2 rounded-xl text-xs">📊 Dashboard</Link>
          </div>
        </div>

        {/* FORM */}
        <div className="bg-white p-4 rounded-xl shadow mb-3 space-y-2">
          <select value={supplierId || ""} onChange={(e) => setSupplierId(Number(e.target.value))} className="w-full border p-3 rounded-xl">
            <option value="">เลือก supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </select>

          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border p-3 rounded-xl">
            {TYPES.map((t) => (
              <option key={t.code} value={t.code}>{t.name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className="flex-1 p-3 border rounded-xl" />
            <button onClick={editingId ? updateLot : addLot} className="bg-green-600 text-white px-4 rounded-xl">
              {editingId ? "แก้ไข" : "รับเข้า"}
            </button>
          </div>
        </div>

        {/* กรอกน้ำหนักรับเข้า */}
        {(currentShiftReceive === null || isEditingReceive) && (
          <div className="bg-white p-4 rounded-xl shadow mb-3 space-y-2">
            <div className="text-sm font-semibold">🚚 น้ำหนักรับเข้า (ทั้งคัน)</div>

            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                value={receiveWeight}
                onChange={(e) => setReceiveWeight(e.target.value)}
                className="flex-1 p-3 border rounded-xl"
                placeholder="เช่น 2850.000"
              />

              <button
                onClick={saveReceiveWeight}
                className="bg-blue-600 text-white px-4 rounded-xl"
              >
                บันทึก
              </button>
            </div>
          </div>
        )}

        {/* DASHBOARD (ตาม filter + search ทั้งหมด) */}
        <div className="bg-white p-4 rounded-xl shadow mb-3 flex flex-col sm:flex-row gap-2 sm:justify-between text-xs sm:text-sm text-gray-700">
          {(() => {
            const totalWeight = sortedLots
              .reduce((sum, l) => sum + Number(l.weight || 0), 0)
              .toFixed(3);

            const totalCount = sortedLots.length;

            return (
              <>
                <div>
                  จำนวนทั้งหมด:{" "}
                  <span className="font-semibold">{totalCount}</span> รายการ
                </div>

                <div>
                  น้ำหนักรวม:{" "}
                  <span className="font-semibold">{totalWeight} kg</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* ✅ SHIFT LOSS SUMMARY (ตาม filter/search) */}
        <div className="bg-white p-4 rounded-xl shadow mb-3 text-xs sm:text-sm text-gray-700 space-y-2">
          <div className="font-semibold">📉 Loss ต่อ Shift</div>

          {shiftLoss.length === 0 && (
            <div className="text-gray-400">ไม่มีข้อมูล</div>
          )}

          {paginatedLoss.map((s) => {
            // ✅ ดึง lot ตัวอย่างจาก list (ที่ผ่าน filter แล้ว)
            const sampleLot = sortedLots.find(
              (l) =>
                `${l.shift_date}-${l.supplier_id}-${l.type}` === s.key
            );

            const supplierName = sampleLot?.supplier_name || "-";

            const typeName =
              TYPES.find((t) => t.code === sampleLot?.type)?.name ||
              sampleLot?.type ||
              "-";

            return (
              <div
                key={s.key}
                className="flex flex-col sm:flex-row sm:justify-between border-b pb-1"
              >
                {/* ✅ ใช้จาก list จริง */}
                <div className="font-medium">
                  {supplierName} - {typeName}
                </div>

                {/* ค่า */}
                <div className="flex gap-3">
                  <div
                    className="text-blue-600 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();

                      const parts = s.key.split("-");
                      const shiftDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
                      const sid = Number(parts[3]);
                      const t = parts[4];

                      setSupplierId(sid);
                      setType(t);
                      setReceiveWeight(String(s.receive || ""));

                      setEditShiftDate(shiftDate);

                      // ✅ เพิ่มบรรทัดนี้
                      setIsEditingReceive(true);

                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {s.receive?.toLocaleString("en-US", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    }) ?? "-"}
                  </div>

                  <div>
                    ชั่งรวม:{" "}
                    <span className="font-semibold">
                      {s.total.toLocaleString("en-US", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </span>
                  </div>

                  <div>
                    หาย: {renderValue(s.diff, { unit: " kg", decimals: 3 })}
                  </div>

                  <div>
                    %: {renderValue(s.percent, { unit: "%", decimals: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
          
          {totalLossPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">
                หน้า {lossPage} / {totalLossPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLossPage((p) => Math.max(p - 1, 1))}
                  disabled={lossPage === 1}
                  className="px-2 py-1 text-xs rounded bg-gray-100 disabled:opacity-50"
                >
                  ก่อนหน้า
                </button>
                <button
                  onClick={() =>
                    setLossPage((p) =>
                      Math.min(p + 1, totalLossPages)
                    )
                  }
                  disabled={lossPage === totalLossPages}
                  className="px-2 py-1 text-xs rounded bg-gray-100 disabled:opacity-50"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
          
        </div>
        

        {/* LIST */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="space-y-1 p-2 max-h-fit overflow-y-auto">

            {/* HEADER */}
            <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_120px_140px_140px_20px] p-3 text-sm font-semibold border-b bg-gray-50">
              <span
                onClick={() => {
                  setSortKey("created");
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
                className="cursor-pointer select-none"
              >
                ลำดับที่ {" "}
                {sortKey === "created"
                  ? sortOrder === "asc"
                    ? "🔼"
                    : "🔽"
                  : ""}
              </span>
              <span>Batch</span>
              <span
                onClick={() => {
                  setSortKey("supplier"); // 🔥 บอกว่า sort ตาม supplier
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
                className="cursor-pointer select-none"
              >
                Supplier-type{" "}
                {sortKey === "supplier"
                  ? sortOrder === "asc"
                    ? "🔼"
                    : "🔽"
                  : ""}
              </span>
              <span>น้ำหนัก</span>
              <span
                onClick={() => {
                  setSortKey("date");
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                }}
                className="cursor-pointer select-none"
              >
                Shift Date{" "}
                {sortKey === "date"
                  ? sortOrder === "asc"
                    ? "🔼"
                    : "🔽"
                  : ""}
              </span>
              <span>วันเวลา</span>
              <span></span>
            </div>

            {/* LIST */}
            {paginatedLots.map((l, idx) => (
              <div
                key={l.id}
                onClick={() => handleEdit(l)}
                className={`cursor-pointer flex flex-col sm:grid sm:grid-cols-[80px_1fr_1fr_120px_140px_140px_20px]
                  p-1 rounded-xl border transition
                  hover:bg-gray-100 hover:border-gray-300
                  ${
                    editingId === l.id
                      ? "bg-yellow-100 border-yellow-400"
                      : highlightId === l.id
                      ? "bg-green-100 border-green-400"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-300"
                  }`}
              >
                {/* ลำดับ */}
                <div className="text-sm text-gray-600">
                  {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                </div>

                {/* Batch */}
                <div className="text-sm">{l.code}</div>

                {/* Supplier */}
                <div className="text-sm font-medium">
                  {l.supplier_name}
                  {getSupplierType(l.type)}
                </div>

                {/* Weight */}
                <div className="text-blue-700 font-bold">
                  {Number(l.weight).toFixed(3)} kg
                </div>

                {/* Shift Date (ไทย) */}
                <div className="text-xs text-gray-500">
                  {l.shift_date
                    ? new Date(l.shift_date).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : l.created_at
                    ? new Date(
                        getShiftDate(l.created_at)
                      ).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "-"}
                </div>

                {/* วันเวลา */}
                <div className="text-xs text-gray-500">
                  {l.created_at
                    ? new Date(l.created_at).toLocaleString("th-TH")
                    : "-"}
                </div>

                {/* delete */}
                <div className="flex items-center justify-start">
                  {editingId === l.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLot(l.id);
                      }}
                      className="text-orange-500 hover:text-orange-600 text-sm"
                      title="delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-xs text-gray-500">
              หน้า {currentPage} / {totalPages || 1}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded bg-gray-100 disabled:opacity-50"
              >
                ก่อนหน้า
              </button>

              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(p + 1, totalPages || 1)
                  )
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 text-xs rounded bg-gray-100 disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}