"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Category = {
  id: string;
  code: string;
  name: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  // โหลด categories
  const loadCategories = async () => {
    const { data } = await supabase.from("categories").select("*");
    if (data) setCategories(data);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // บันทึก category (เพิ่ม / แก้ไข)
  const handleSave = async () => {
    if (!code || !name) return;

    if (editing) {
      // แก้ไข
      const { error } = await supabase
        .from("categories")
        .update({ code, name })
        .eq("id", editing.id);
      if (error) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setEditing(null);
    } else {
      // เพิ่มใหม่
      const { error } = await supabase.from("categories").insert([{ code, name }]);
      if (error) {
        setStatus("error");
        return;
      }
      setStatus("success");
    }

    setCode("");
    setName("");
    loadCategories();
    setTimeout(() => setStatus("idle"), 1500);
  };

  // ลบ category
  const handleDelete = async (id: string) => {
    if (!confirm("คุณแน่ใจว่าต้องการลบหรือไม่?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (!error) loadCategories();
  };

  // เริ่มแก้ไข
  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setCode(cat.code);
    setName(cat.name);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">🗂 Categories</h1>
          <Link href="/scan" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            ← กลับไปหน้า Scan
          </Link>
        </div>

        {/* FORM */}
        <div className="bg-white p-5 rounded-2xl shadow-lg mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 p-3 rounded-xl border border-gray-300 outline-none text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-400"
            />
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 p-3 rounded-xl border border-gray-300 outline-none text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition"
            >
              {editing ? "แก้ไข" : "เพิ่ม"}
            </button>
          </div>
          {status === "success" && <p className="text-green-600 mt-2">บันทึกสำเร็จ!</p>}
          {status === "error" && <p className="text-red-600 mt-2">เกิดข้อผิดพลาด</p>}
        </div>

        {/* LIST */}
        <div className="bg-white p-5 rounded-2xl shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-semibold text-gray-700 mb-2">
            <span>Code</span>
            <span>Name</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {categories.map((cat) => (
                <div key={cat.id ?? cat.code} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-800 truncate">{cat.code}</span>
                    <span className="text-gray-800 truncate">{cat.name}</span>
                    <div className="flex justify-end gap-2">
                    <button
                        onClick={() => handleEdit(cat)}
                        className="bg-yellow-400 px-3 py-1 rounded-lg hover:bg-yellow-500 text-white transition"
                    >
                        แก้ไข
                    </button>
                    <button
                        onClick={() => handleDelete(cat.id)}
                        className="bg-red-500 px-3 py-1 rounded-lg hover:bg-red-600 text-white transition"
                    >
                        ลบ
                    </button>
                    </div>
                </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-gray-400 mt-4">ยังไม่มี category</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}