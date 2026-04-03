"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { parseBarcode } from "@/lib/barcode";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Item = {
  id: string;
  category_code: string;
  weight: number;
  barcode: string;
  created_at: string;
};

type Category = {
  code: string;
  name: string;
};

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const lastScanRef = useRef("");
  const lastTimeRef = useRef(0);
  const editingRef = useRef<HTMLDivElement | null>(null);

  // 🔹 โหลดข้อมูล
  const loadData = async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setItems(data);

    const { data: cat } = await supabase.from("categories").select("*");
    if (cat) setCategories(cat);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 🔹 scroll ไป item ที่ edit
  useEffect(() => {
    if (editingRef.current) {
      editingRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [editing]);

  // 🔹 helper
  const getCategoryName = (code: string) => {
    const f = categories.find((c) => c.code === code);
    return f ? f.name : code;
  };

  const isValidCategory = (code: string) => {
    return categories.some((c) => c.code === code);
  };

  // ✅ validate barcode
  const validateBarcode = (code: string) => {
    if (code.length !== 13) return "❌ barcode ต้อง 13 หลัก";
    if (!/^\d+$/.test(code)) return "❌ barcode ต้องเป็นตัวเลขเท่านั้น";

    try {
      const parsed = parseBarcode(code);

      if (!isValidCategory(parsed.categoryCode)) {
        return "❌ ไม่พบหมวดหมู่";
      }

      if (parsed.weight <= 0) {
        return "❌ น้ำหนักไม่ถูกต้อง";
      }

      return null;
    } catch {
      return "❌ barcode ไม่ถูกต้อง";
    }
  };

  // 🔹 highlight search
  const highlight = (text: string) => {
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 px-1 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // 🔹 กันยิงซ้ำ
  const isDuplicateScan = (code: string) => {
    const now = Date.now();
    if (code === lastScanRef.current && now - lastTimeRef.current < 1500)
      return true;
    lastScanRef.current = code;
    lastTimeRef.current = now;
    return false;
  };

  // 🔹 preview
  let previewCategory = "";
  let previewWeight = 0;

  if (barcode.length >= 6) {
    try {
      const parsed = parseBarcode(barcode);
      previewCategory = parsed.categoryCode;
      previewWeight = parsed.weight;
    } catch {}
  }

  // 🔥 save (แก้แล้ว)
  const handleSave = async () => {
    if (!barcode) return;

    const errorMsg = validateBarcode(barcode);

    if (errorMsg) {
      alert(errorMsg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1200);
      return;
    }

    try {
      const parsed = parseBarcode(barcode);
      const categoryCode = parsed.categoryCode;
      const weight = parsed.weight;

      if (!isValidCategory(categoryCode)) {
        alert("❌ ไม่พบหมวดหมู่");
        return;
      }

      // 🔹 ตรวจสอบซ้ำจากฐานข้อมูล
      const { data: existingItem } = await supabase
        .from("items")
        .select("id")
        .eq("barcode", barcode)
        .single();

      if (existingItem && (!editing || existingItem.id !== editing.id)) {
        alert("❌ Barcode นี้มีอยู่แล้วในระบบ");
        return;
      }

      // 🔹 กันยิงซ้ำ local
      if (!editing && isDuplicateScan(barcode)) return;

      let affectedId = "";

      if (editing) {
        await supabase
          .from("items")
          .update({
            barcode,
            category_code: categoryCode,
            weight,
          })
          .eq("id", editing.id);

        affectedId = editing.id;
        setEditing(null);
      } else {
        const { data } = await supabase
          .from("items")
          .insert({
            barcode,
            category_code: categoryCode,
            weight,
          })
          .select()
          .single();

        affectedId = data?.id || "";
      }

      setBarcode("");
      await loadData();

      // highlight
      setHighlightId(affectedId);
      setTimeout(() => setHighlightId(null), 2000);

      setStatus("success");
      setTimeout(() => setStatus("idle"), 1000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1000);
    }
  };

  // 🔹 delete
  const handleDelete = async (item: Item) => {
    if (!confirm("ลบรายการนี้?")) return;
    await supabase.from("items").delete().eq("id", item.id);
    loadData();
  };

  // 🔹 edit
  const handleEdit = (item: Item) => {
    setEditing(item);
    setBarcode(item.barcode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4 text-gray-900">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex justify-between items-center">
          <h1 className="font-bold text-lg">📦 Stock Scanner</h1>

          <div className="flex gap-2">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-2 rounded-xl text-xs text-white ${
                isEditMode ? "bg-gray-600" : "bg-yellow-500"
              }`}
            >
              {isEditMode ? "ปิด" : "Edit"}
            </button>

            <Link
              href="/categories"
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              🗂 หมวดหมู่
            </Link>
          </div>
        </div>

        {/* INPUT */}
        <div className="bg-white p-4 rounded-xl shadow mb-3">
          <div className="flex gap-1">
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const err = validateBarcode(barcode);
                  if (!err) handleSave();
                  else {
                    alert(err);
                    setStatus("error");
                    setTimeout(() => setStatus("idle"), 1200);
                  }
                }
              }}
              placeholder="scan / manual"
              className="flex-1 p-3 border rounded-xl text-gray-900"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 rounded-xl"
            >
              {editing ? "แก้ไข" : "เพิ่ม"}
            </button>
          </div>

          {/* preview */}
          {barcode.length >= 6 && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">หมวด: </span>
              <span
                className={`font-semibold ${
                  isValidCategory(previewCategory)
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {getCategoryName(previewCategory)}
              </span>

              <span className="ml-3 text-gray-600">
                น้ำหนัก: {previewWeight.toFixed(3)} kg
              </span>

              {!isValidCategory(previewCategory) && (
                <span className="ml-2 text-red-500">❌ ไม่มีหมวด</span>
              )}
            </div>
          )}
        </div>

        {/* SEARCH */}
        <div className="p-4">
          <input
            placeholder="🔍 ค้นหา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 rounded-xl border text-gray-900"
          />
        </div>

        {/* DASHBOARD สรุป */}
        <div className="bg-white p-4 rounded-xl shadow mb-3 flex justify-between text-sm text-gray-700">
          {(() => {
            const filteredItems = items.filter((i) => {
              const k = search.toLowerCase();
              return (
                i.barcode.toLowerCase().includes(k) ||
                getCategoryName(i.category_code).toLowerCase().includes(k)
              );
            });

            const totalWeight = filteredItems.reduce((sum, i) => sum + i.weight, 0).toFixed(3);
            const totalCount = filteredItems.length;

            return (
              <>
                <div>จำนวนทั้งหมด: <span className="font-semibold">{totalCount}</span> รายการ</div>
                <div>น้ำหนักรวม: <span className="font-semibold">{totalWeight} kg</span></div>
              </>
            );
          })()}
        </div>

        {/* LIST */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="grid grid-cols-[50px_1fr_120px_auto] p-3 text-sm font-semibold border-b bg-gray-50">
            <span>No.</span>
            <span>สินค้า</span>
            <span>Weight</span>
            <span className="text-right">
              {isEditMode ? "Actions" : ""}
            </span>
          </div>

          <div className="overflow-y-auto p-0 space-y-1 text-sm" style={{ height: 'calc(100vh - 180px)' }}>
            <AnimatePresence>
              {items
                .filter((i) => {
                  const k = search.toLowerCase();
                  return (
                    i.barcode.toLowerCase().includes(k) ||
                    getCategoryName(i.category_code)
                      .toLowerCase()
                      .includes(k)
                  );
                })
                .map((item, index) => {
                  const isEditing = editing?.id === item.id;
                  const isHighlight = highlightId === item.id;

                  return (
                    <motion.div
                      key={item.id}
                      ref={isEditing ? editingRef : null}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isEditing ? 1.02 : 1,
                      }}
                      className={`grid grid-cols-[50px_1fr_120px_auto] items-center p-3 rounded-xl border
                        ${
                          isEditing
                            ? "bg-yellow-100 border-yellow-400"
                            : isHighlight
                            ? "bg-green-100 border-green-400"
                            : "bg-gray-50 border-transparent"
                        }`}
                    >
                      <span>{index + 1}</span>

                      <div className="flex gap-2 overflow-hidden p-0">
                        <span className="truncate font-medium">
                          {highlight(item.barcode)}
                        </span>
                        <span className="text-gray-500 text-sm">
                          ({highlight(getCategoryName(item.category_code))})
                        </span>
                      </div>

                      <span className="text-blue-700 font-bold">
                        {item.weight.toFixed(3)}
                      </span>

                      <div className="flex justify-end gap-2">
                        {isEditMode && (
                          <>
                            <button
                              onClick={() => handleEdit(item)}
                              className="bg-yellow-400 px-2 py-1 text-xs rounded text-white"
                            >
                              {isEditing ? "กำลังแก้..." : "แก้ไข"}
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="bg-red-500 px-2 py-1 text-xs rounded text-white"
                            >
                              ลบ
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {items.length === 0 && (
              <p className="text-center text-gray-500 mt-4">
                ยังไม่มีข้อมูล
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}