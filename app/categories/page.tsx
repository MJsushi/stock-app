"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Category = {
  id?: string;
  code: string;
  name: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isEditMode, setIsEditMode] = useState(false);
  const [search, setSearch] = useState("");

  // 🔹 โหลดข้อมูล
  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("code", { ascending: true });

    if (data) {
      // เผื่อ code เป็นตัวเลข string
      const sorted = [...data].sort(
        (a, b) => Number(a.code) - Number(b.code)
      );

      setCategories(sorted);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text;

    const regex = new RegExp(`(${keyword})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // 🔹 SAVE (INSERT / UPDATE)
  const handleSave = async () => {
    if (!code || !name) return;

    if (editing) {
      console.log("UPDATE:", editing);

      let query = supabase.from("categories").update({ code, name });

      // ✅ เช็ค id ก่อน
      if (editing.id) {
        query = query.eq("id", editing.id);
      } else {
        console.log("⚠️ ไม่มี id → ใช้ code แทน");
        query = query.eq("code", editing.code);
      }

      const { error } = await query;

      console.log("UPDATE RESULT:", error);

      if (error) return setStatus("error");

      setEditing(null);
    } else {
      console.log("INSERT");

      const { error } = await supabase
        .from("categories")
        .insert([{ code, name }]);

      if (error) {
        console.log("INSERT ERROR:", error);
        return setStatus("error");
      }
    }

    setStatus("success");
    setCode("");
    setName("");

    await loadCategories();
    setTimeout(() => setStatus("idle"), 1200);
  };

  // 🔹 DELETE
  const handleDelete = async (cat: Category) => {
    console.log("DELETE CLICK:", cat);

    if (!confirm("ลบจริงไหม?")) return;

    let query = supabase.from("categories").delete();

    if (cat.id) {
      query = query.eq("id", cat.id);
    } else {
      console.log("⚠️ ไม่มี id → ใช้ code ลบ");
      query = query.eq("code", cat.code);
    }

    const { error } = await query;

    console.log("DELETE RESULT:", error);

    if (error) {
      alert("ลบไม่สำเร็จ ดู console");
      return;
    }

    loadCategories();
  };

  // 🔹 EDIT
  const handleEdit = (cat: Category) => {
    console.log("EDIT CLICK:", cat);
    setEditing(cat);
    setCode(cat.code);
    setName(cat.name);
  };

  return (
    <div className="h-screen flex flex-col bg-linear-to-br from-gray-100 to-gray-200 p-4 text-gray-900">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-3">
          <h1 className="font-bold text-lg">🗂 Categories</h1>

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
              href="/scan"
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              Scan
            </Link>
          </div>
        </div>

        {/* SEARCH */}
<div className="bg-white p-3 rounded-2xl shadow mb-3">
  <input
    type="text"
    placeholder="🔍 ค้นหา code หรือ name..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full p-3 rounded-xl border border-gray-200 text-sm"
  />
</div>

        {/* FORM */}
        <div className="bg-white p-4 rounded-2xl shadow mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 p-3 rounded-xl border border-gray-200"
            />
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 p-3 rounded-xl border border-gray-200"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-3 rounded-xl"
            >
              {editing ? "แก้ไข" : "เพิ่ม"}
            </button>
          </div>

          <div className="h-5 mt-1 text-sm">
            {status === "success" && <span className="text-green-600">✔ สำเร็จ</span>}
            {status === "error" && <span className="text-red-600">✖ error</span>}
          </div>
        </div>

        {/* LIST */}
        <div className="bg-white rounded-2xl shadow flex-1 flex flex-col overflow-hidden">

          {/* HEADER */}
          <div className="grid grid-cols-[60px_120px_1fr_auto] gap-3 p-3 font-semibold border-b border-gray-200 bg-gray-50 text-sm">
            <span>No.</span>
            <span>Code</span>
            <span>Name</span>
            <span className="text-right">{isEditMode ? "Actions" : ""}</span>
          </div>

          {/* BODY */}
          {/* BODY */}
<div className="flex-1 overflow-y-auto p-2 space-y-2">
  <AnimatePresence>
    {categories
      .filter((cat) => {
        const keyword = search.toLowerCase();
        return (
          cat.code.toLowerCase().includes(keyword) ||
          cat.name.toLowerCase().includes(keyword)
        );
      })
      .map((cat, index) => (
        <motion.div
          key={cat.id || `${cat.code}-${index}`} // ✅ กัน key ซ้ำ
          className="grid grid-cols-[60px_120px_1fr_auto] gap-3 items-center p-3 rounded-xl bg-gray-50 hover:shadow"
        >
          {/* NO */}
          <span className="text-gray-400 text-sm">
            {index + 1}
          </span>

          {/* CODE */}
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
            {highlightText(cat.code, search)}
          </span>

          {/* NAME */}
          <span className="truncate">
            {highlightText(cat.name, search)}
          </span>

          {/* ACTION */}
          <div className="flex justify-end gap-2">
            {isEditMode && (
              <>
                <button
                  onClick={() => handleEdit(cat)}
                  className="bg-yellow-400 px-3 py-1 text-white text-xs rounded"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="bg-red-500 px-3 py-1 text-white text-xs rounded"
                >
                  ลบ
                </button>
              </>
            )}
          </div>
        </motion.div>
      ))}
  </AnimatePresence>

  {/* EMPTY STATE (ต้องใช้ filtered ไม่ใช่ categories) */}
  {categories.filter((cat) => {
    const keyword = search.toLowerCase();
    return (
      cat.code.toLowerCase().includes(keyword) ||
      cat.name.toLowerCase().includes(keyword)
    );
  }).length === 0 && (
    <p className="text-center text-gray-400 mt-4">
      ไม่พบข้อมูล
    </p>
  )}
</div>
        </div>
      </div>
    </div>
  );
}