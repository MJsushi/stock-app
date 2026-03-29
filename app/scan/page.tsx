"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { parseBarcode } from "@/lib/barcode";
import { motion, AnimatePresence } from "framer-motion";

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
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const lastScanRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);
  const scannedSetRef = useRef<Set<string>>(new Set());

  // 🔹 โหลด items และ categories แบบ async ใน useEffect
  useEffect(() => {
    const fetchData = async () => {
      // โหลด items
      const { data: itemsData } = await supabase.from("items").select("*");
      if (itemsData) {
        setItems(itemsData.reverse());
        itemsData.forEach(d => scannedSetRef.current.add(d.barcode));
      }

      // โหลด categories
      const { data: categoriesData } = await supabase.from("categories").select("*");
      if (categoriesData) setCategories(categoriesData);
    };

    fetchData();

    // Realtime subscribe
    const subscription = supabase
      .channel("public:items")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items" },
        (payload) => {
          const newItem: Item = payload.new;
          if (!scannedSetRef.current.has(newItem.barcode)) {
            setItems((prev) => [newItem, ...prev]);
            scannedSetRef.current.add(newItem.barcode);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  // 🔒 กันยิงเร็ว
  const isDuplicateScan = (barcode: string) => {
    const now = Date.now();
    if (barcode === lastScanRef.current && now - lastTimeRef.current < 1500)
      return true;
    lastScanRef.current = barcode;
    lastTimeRef.current = now;
    return false;
  };

  // ✅ แปลง code → name
  const getCategoryName = (code: string) => {
    const found = categories.find((c) => c.code === code);
    return found ? found.name : code;
  };

  // 🎨 สีแต่ละประเภท
  const getCategoryColor = (code: string) => {
    switch (code) {
      case "000001":
        return "bg-green-100 text-green-700";
      case "000002":
        return "bg-blue-100 text-blue-700";
      case "000003":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // ✅ submit
  const handleSubmit = async () => {
    if (barcode.length !== 13) {
      setStatus("error");
      return;
    }

    if (isDuplicateScan(barcode)) return;

    if (scannedSetRef.current.has(barcode)) {
      setStatus("error");
      setBarcode("");
      return;
    }

    try {
      const { categoryCode, weight } = parseBarcode(barcode);

      const { error } = await supabase.from("items").insert({
        category_code: categoryCode,
        weight,
        barcode,
      });

      if (error) throw error;

      setStatus("success");
      setBarcode("");

      // update local state & memory
      const newItem: Item = {
        id: Date.now().toString(),
        category_code: categoryCode,
        weight,
        barcode,
        created_at: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      scannedSetRef.current.add(barcode);

      setTimeout(() => setStatus("idle"), 1000);
    } catch (err) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
          <h1 className="text-2xl font-bold text-gray-800">📦 Stock Scanner</h1>
          <p className="text-gray-500 text-sm">ยิง barcode เพื่อบันทึกสินค้า</p>
        </div>

        {/* SCAN BOX */}
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
          <input
            autoFocus
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="ยิง barcode..."
            className={`w-full text-lg p-4 rounded-xl border outline-none transition
              text-gray-900 placeholder-gray-500
              ${status === "success" ? "bg-green-100 border-green-500 text-green-900 placeholder-green-700" : ""}
              ${status === "error" ? "bg-red-100 border-red-500 text-red-900 placeholder-red-700" : ""}
            `}
          />
          <div className="mt-2 h-5">
            {status === "success" && <p className="text-green-600 text-sm">✔ บันทึกข้อมูลสำเร็จ</p>}
            {status === "error" && <p className="text-red-600 text-sm">✖ barcode ซ้ำหรือไม่ถูกต้อง</p>}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <p className="text-gray-400 text-sm">จำนวนรายการ</p>
            <p className="text-xl font-bold text-gray-800">{items.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <p className="text-gray-400 text-sm">น้ำหนักรวม (kg)</p>
            <p className="text-xl font-bold text-blue-600">
              {items.reduce((sum, i) => sum + i.weight, 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* LIST */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div
                key={item.id + item.barcode} // unique key
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between p-3 rounded-xl border bg-gray-50 text-sm"
              >
                {/* LEFT */}
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="w-6 text-right font-semibold text-gray-500">{index + 1}.</span>
                  <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${getCategoryColor(item.category_code)}`}>
                    {getCategoryName(item.category_code)}
                  </span>
                  <span className="text-gray-500 truncate">{item.barcode}</span>
                </div>

                {/* RIGHT */}
                <div className="font-bold text-blue-600 whitespace-nowrap">
                  {Number(item.weight).toFixed(3)} kg
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {items.length === 0 && <p className="text-center text-gray-400">ยังไม่มีข้อมูล</p>}
        </div>
      </div>
    </div>
  );
}