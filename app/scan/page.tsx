"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { parseBarcode } from "@/lib/barcode";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Html5Qrcode } from "html5-qrcode";

type Item = {
  id: string;
  category_code: string;
  weight: number;
  barcode: string;
  created_at: string;
  shift_date: string;
};

type Category = {
  code: string;
  name: string;
};

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [fromDateTime, setFromDateTime] = useState("");
  const [toDateTime, setToDateTime] = useState("");

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  //จำนวนแสดงผลต่อหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // ปรับได้ตามต้องการ
  useEffect(() => {
    setCurrentPage(1);
  }, [search, fromDateTime, toDateTime]);

  const getFileName = (type: "all" | "page") => {
    const now = new Date();

    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const from = fromDateTime ? fromDateTime.slice(0, 10) : "";
    const to = toDateTime ? toDateTime.slice(0, 10) : "";

    const dateRange =
      from && to ? `${from}_to_${to}` : date;

    const keyword = search ? `_${search}` : "";

    const page =
      type === "page" ? `_page${currentPage}` : "_all";

    return `stock${keyword}_${dateRange}${page}.xlsx`;
  };
  

  const lastScanRef = useRef("");
  const lastTimeRef = useRef(0);
  const editingRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
    useEffect(() => {
      inputRef.current?.focus();
    }, []);
  

    useEffect(() => {
      const startScanner = async () => {
        const el = document.getElementById("reader");
        if (!el) return;

        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;

        try {
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 25,

              // 🔥 ปรับให้ "1D สแกนง่ายขึ้น"
              qrbox: { width: 320, height: 120 },

              // 🔥 ลด jitter + เพิ่มความนิ่ง
              aspectRatio: 1.7778,

              // 🔥 สำคัญมาก: ช่วยให้ decode ไวขึ้น
              disableFlip: true,
            },
            async (decodedText) => {
              if (isDuplicateScan(decodedText)) return;

              // 🔥 กัน double fire
              scanner.pause?.(true);

              await handleSaveFromScan(decodedText);

              // 🔥 ยิงเสร็จค่อยกลับมาสแกนต่อ
              setTimeout(() => {
                scanner.resume?.();
              }, 300);
            },
            (errorMessage) => {
              // ignore
            }
          );

          // 🔥 FIX: ล็อกกลาง + ลด shake (บาง browser รองรับ)
          const video = document.querySelector("video");
          if (video) {
            video.style.objectFit = "cover";
            video.style.transform = "scale(1.05)";
          }
        } catch (err) {
          console.error("START ERROR:", err);
        }

        return () => {
          scanner.stop().catch(() => {});
          scanner.clear?.();
        };
      };

      startScanner();
    }, []);





  const formatDateTime = (date: string) => {
    const d = new Date(date);
      return d.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "short",
        timeStyle: "medium",
      });
    };
  
    //กะปัจจุบัน    
    const getCurrentShiftDate = () => {
      const now = new Date();

      const local = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
      );

      if (local.getHours() >= 22) {
        local.setDate(local.getDate() + 1);
      }

      const year = local.getFullYear();
      const month = String(local.getMonth() + 1).padStart(2, "0");
      const day = String(local.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };
    useEffect(() => {
      const shiftDate = getCurrentShiftDate();

      setFromDateTime(shiftDate);
      setToDateTime(shiftDate);
    }, []);
    
    //กะที่ค้นหา
    const getShiftDateKey = (date: string) => {
    const d = new Date(date);

    const local = new Date(
      d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );

    if (local.getHours() >= 22) {
      local.setDate(local.getDate() + 1);
    }

    // ✅ ใช้ local date แทน ISO
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, "0");
    const day = String(local.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

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

  //realtime
  useEffect(() => {
    const channel = supabase
      .channel("realtime-items")
      .on(
        "postgres_changes",
        {
          event: "*", // หรือใช้ "INSERT" ก็ได้
          schema: "public",
          table: "items",
        },
        (payload) => {
          console.log("Realtime:", payload);

          // 🔥 วิธีง่าย: reload ทั้งหมด
          loadData();

          // 🎯 หรือจะ highlight item ใหม่
          if (payload.eventType === "INSERT") {
            setHighlightId(payload.new.id);
            setTimeout(() => setHighlightId(null), 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // 🔥 save
  const handleSave = async () => {
    if (!barcode) return;

    
    const errorMsg = validateBarcode(barcode);

    if (errorMsg) {
      alert(errorMsg);
      setStatus("error");
      setBarcode("");
      inputRef.current?.focus();
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

      // 🔥 shift ปัจจุบัน
      const currentShiftDate = getShiftDateKey(new Date().toISOString());

      // 🔥 query barcode เดียวกันทั้งหมด
      const { data: existingItems, error: fetchError } = await supabase
        .from("items")
        .select("id, created_at")
        .eq("barcode", barcode);

      if (fetchError) throw fetchError;

      // 🔥 เช็คซ้ำในกะเดียวกัน
      const isDuplicateInSameShift = existingItems?.some((item) => {
        return getShiftDateKey(item.created_at) === currentShiftDate;
      });

      // 🔥 เช็คว่าเป็น record เดิมที่กำลัง edit อยู่ไหม
      const isEditingSameItem = editing
        ? existingItems?.some((i) => i.id === editing.id)
        : false;

      // ❌ ซ้ำในกะเดียวกัน และไม่ใช่ตัวเดิม
      if (isDuplicateInSameShift && !isEditingSameItem) {
        alert("❌ Barcode ซ้ำในกะนี้");

        setBarcode("");
        inputRef.current?.focus();

        return;
      }

      // 🔥 กันยิงซ้ำเร็ว
      if (!editing && isDuplicateScan(barcode)) return;

      let affectedId = "";

      // 🔹 UPDATE
      if (editing) {
        const { error: updateError } = await supabase
          .from("items")
          .update({
            barcode,
            category_code: categoryCode,
            weight,
          })
          .eq("id", editing.id);

        if (updateError) throw updateError;

        affectedId = editing.id;
        setEditing(null);
      } 
      // 🔹 INSERT
      else {
        const shiftDate = getCurrentShiftDate(); // 🔥 ต้องมี

        const { data, error: insertError } = await supabase
          .from("items")
          .insert({
            barcode,
            category_code: categoryCode,
            weight,
            shift_date: shiftDate, // ✅ สำคัญมาก
          })
          .select()
          .single();

        if (insertError) throw insertError;

        affectedId = data?.id || "";
      }

      // 🔹 reset input
      setBarcode("");
      inputRef.current?.focus();

      // 🔹 reload data
      await loadData();

      // 🔥 highlight
      setHighlightId(affectedId);
      setTimeout(() => setHighlightId(null), 2000);

      setStatus("success");
      setTimeout(() => setStatus("idle"), 1000);

    } catch (err: any) {
      console.log("ERROR FULL:", err);
      console.log("ERROR KEYS:", Object.keys(err || {}));

      let msg = "❌ เกิดข้อผิดพลาด";

      if (err?.message) msg = err.message;
      else if (err?.error_description) msg = err.error_description;
      else if (typeof err === "string") msg = err;

      alert(msg);

      setStatus("error");
      setTimeout(() => setStatus("idle"), 1000);
    }
  };
  const handleSaveFromScan = async (code: string) => {
    setBarcode(code);
    setTimeout(() => {
      handleSave();
    }, 50);

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

  // รวม filter + pagination
  const filteredItems = items.filter((i) => {
    const k = search.toLowerCase();

    const matchText =
      i.barcode.toLowerCase().includes(k) ||
      getCategoryName(i.category_code).toLowerCase().includes(k);

    const itemShift = getShiftDateKey(i.created_at);

    const from = fromDateTime || null;
    const to = toDateTime || null;

    const matchDate =
      (!from || itemShift >= from) &&
      (!to || itemShift <= to);

    return matchText && matchDate;
  });

  // 🔥 pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 👇 export excel
  const exportToExcel = (type: "all" | "page" = "all") => {
    const dataSource =
      type === "page" ? paginatedItems : filteredItems;

    const data = dataSource.map((item, index) => ({
      No:
        type === "page"
          ? (currentPage - 1) * itemsPerPage + index + 1
          : index + 1,
      Barcode: item.barcode,
      Category: getCategoryName(item.category_code),
      Weight: item.weight,
      ShiftDate: new Date(item.shift_date).toLocaleDateString("th-TH"),
      Date: formatDateTime(item.created_at),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(file, getFileName(type));
  };


  return (
    <div className="min-h-screen bg-linear-to-br from-gray-100 to-gray-200 p-2 sm:p-4 text-gray-900">
      <div className="max-w-4xl mx-auto w-full">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
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
              href="/dashboard"
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/inbound"
              className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              📥 Inbound
            </Link>
            <Link
              href="/categories"
              className="bg-blue-400 text-white px-3 py-2 rounded-xl text-xs"
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
              ref={inputRef}
              placeholder="scan / manual"
              className="flex-1 p-3 border rounded-xl text-gray-900 text-sm sm:text-base"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 rounded-xl text-sm sm:text-base"
            >
              {editing ? "แก้ไข" : "เพิ่ม"}
            </button>
          </div>

          {/* preview */}
          {barcode.length >= 6 && (
            <div className="mt-2 text-xs sm:text-sm flex flex-wrap gap-2">
              <span className="text-gray-600">หมวด:</span>
              <span
                className={`font-semibold ${
                  isValidCategory(previewCategory)
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {getCategoryName(previewCategory)}
              </span>

              <span className="text-gray-600">
                น้ำหนัก: {previewWeight.toFixed(3)} kg
              </span>

              {!isValidCategory(previewCategory) && (
                <span className="text-red-500">❌ ไม่มีหมวด</span>
              )}
            </div>
          )}
        </div>
        {/* 📷 SCANNER */}
        <div className="relative bg-black rounded-xl p-2 overflow-hidden">
          {/* 🔥 LASER GUIDE */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[85%] h-[2px] bg-red-500 opacity-70 animate-pulse" />
          </div>
          {/* 🔥 CENTER FRAME */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[85%] h-[120px] border-2 border-green-400 rounded-lg opacity-70" />
          </div>
          <div id="reader" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden" />
        </div>

        {/* SEARCH */}
        <div className="p-2 sm:p-4">
          <input
            placeholder="🔍 ค้นหา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 rounded-xl border text-gray-900 text-sm sm:text-base"
          />
        </div>

        {/* DATE FILTER */}
        <div className="px-2 sm:px-4 pb-2 flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={fromDateTime}
            onChange={(e) => setFromDateTime(e.target.value)}
            className="p-2 border rounded-xl text-sm"
          />

          <input
            type="date"
            value={toDateTime}
            onChange={(e) => setToDateTime(e.target.value)}
            className="p-2 border rounded-xl text-sm"
          />

          <button
            onClick={() => {
              setFromDateTime("");
              setToDateTime("");
            }}
            className="bg-gray-300 px-3 rounded-xl text-xs"
          >
            ล้าง
          </button>
        </div>

        {/* DASHBOARD */}
        <div className="bg-white p-4 rounded-xl shadow mb-3 flex flex-col sm:flex-row gap-2 sm:justify-between text-xs sm:text-sm text-gray-700">
          {(() => {
            const filteredItems = items.filter((i) => {
              const k = search.toLowerCase();

              const matchText =
                i.barcode.toLowerCase().includes(k) ||
                getCategoryName(i.category_code).toLowerCase().includes(k);

              const itemShift = getShiftDateKey(i.created_at);

              const from = fromDateTime || null;
              const to = toDateTime || null;

              const matchDate =
                (!from || itemShift >= from) &&
                (!to || itemShift <= to);

              return matchText && matchDate;
            });

            const totalWeight = filteredItems
              .reduce((sum, i) => sum + i.weight, 0)
              .toFixed(3);

            const totalCount = filteredItems.length;

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

        <div className="flex gap-2 mb-2 mx-2">
        <button
          onClick={() => exportToExcel("all")}
          className="bg-green-600 text-white px-3 py-1 rounded text-xs"
        >
          Export ทั้งหมด
        </button>

        <button
          onClick={() => exportToExcel("page")}
          className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
        >
          Export หน้านี้
        </button>
      </div>  

        {/* LIST */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">

          {/* HEADER TABLE (desktop only) */}
          <div className="hidden sm:grid grid-cols-[50px_1fr_120px_120px_120px_auto] p-3 text-sm font-semibold border-b bg-gray-50">
            <span>No.</span>
            <span>สินค้า</span>
            <span>Weight</span>
            <span>Shift Date</span> {/* 👈 เพิ่ม */}
            <span>รับเข้า</span>
            <span className="text-right">
              {isEditMode ? "Actions" : ""}
            </span>
          </div>

          {/* LIST BODY */}
          <div className="overflow-y-auto max-h-[70vh] sm:max-h-[calc(100vh-180px)] space-y-1 text-sm">
            <AnimatePresence>
              {paginatedItems.map((item, index) => {
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
                    className={`flex flex-col sm:grid sm:grid-cols-[50px_1fr_120px_120px_120px_auto]
                    gap-1 sm:gap-0 items-start sm:items-center
                    p-2 mx-2 rounded-xl border
                    ${
                      isEditing
                        ? "bg-yellow-100 border-yellow-400"
                        : isHighlight
                        ? "bg-green-100 border-green-400"
                        : "bg-gray-50 border-transparent"
                    }`}
                  >
                    {/* No. (ข้ามหน้าแล้วไม่มั่ว) */}
                    <span className="text-xs text-gray-400 sm:text-base">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </span>

                    {/* Product */}
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 overflow-hidden">
                      <span className="truncate font-medium">
                        {highlight(item.barcode)}
                      </span>
                      <span className="text-gray-500 text-xs sm:text-sm">
                        ({highlight(getCategoryName(item.category_code))})
                      </span>
                    </div>

                    {/* Weight */}
                    <span className="text-blue-700 font-bold text-sm sm:text-base">
                      {item.weight.toFixed(3)}
                    </span>

                    <span className="text-sm">
                      {new Date(item.shift_date).toLocaleDateString("th-TH")}
                    </span>

                    {/* Date */}
                    <span className="text-gray-600 text-xs">
                      {formatDateTime(item.created_at)}
                    </span>

                    {/* Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap justify-start sm:justify-end gap-2 mt-1 sm:mt-0">
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

            {paginatedItems.length === 0 && (
              <p className="text-center text-gray-500 mt-4">
                ยังไม่มีข้อมูล
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-center items-center gap-2 mt-3 text-sm">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="px-3 py-1 bg-gray-200 rounded"
          >
            ◀
          </button>

          <span>
            หน้า {currentPage} / {totalPages || 1}
          </span>

          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(p + 1, totalPages))
            }
            className="px-3 py-1 bg-gray-200 rounded"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}