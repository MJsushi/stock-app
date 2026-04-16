"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Supplier = {
  id: number;
  code: number;
  name: string;
  created_at: string | null;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const formatId = (id: number) => {
    return id.toString().padStart(4, "0");
  };

  // =========================
  // FETCH
  // =========================
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .order("id", { ascending: false });

      if (data) setSuppliers(data);
      setLoading(false);
    };

    fetch();
  }, []);

  // =========================
  // ADD
  // =========================
  const addSupplier = async () => {
    if (!newName.trim()) return;

    const { data } = await supabase
      .from("suppliers")
      .insert([{ name: newName }])
      .select()
      .single();

    if (data) {
      setSuppliers((prev) => [data, ...prev]);
      setNewName("");
    }
  };

  // =========================
  // EDIT
  // =========================
  const saveEdit = async (id: number) => {
    if (!editName.trim()) return;

    setSaving(true);

    const { error } = await supabase
      .from("suppliers")
      .update({ name: editName })
      .eq("id", id);

    setSaving(false);

    if (!error) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, name: editName } : s
        )
      );
      setEditingId(null);
    }
  };

  // =========================
  // DELETE
  // =========================
  const deleteSupplier = async (id: number) => {
    if (!confirm("ลบ supplier นี้ใช่ไหม?")) return;

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", id);

    if (!error) {
      setSuppliers((prev) =>
        prev.filter((s) => s.id !== id)
      );
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">กำลังโหลด...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 text-gray-900">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow p-3 mb-3 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-sm sm:text-base font-semibold">
            🏭 Suppliers
          </h1>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/scan"
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              Scan
            </Link>

            <button
              onClick={() => {
                setEditMode((p) => !p);
                setEditingId(null);
              }}
              className={`px-3 py-2 rounded-xl text-xs text-white ${
                editMode ? "bg-red-500" : "bg-gray-600"
              }`}
            >
              {editMode ? "❌ ปิด Edit" : "✏️ Edit"}
            </button>

            <Link
              href="/dashboard"
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* ADD */}
        {editMode && (
          <div className="bg-white p-3 rounded-xl shadow mb-3 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อ supplier"
              className="flex-1 border rounded-xl px-3 py-2 text-sm"
            />
            <button
              onClick={addSupplier}
              className="bg-green-600 text-white px-3 rounded-xl text-sm"
            >
              เพิ่ม
            </button>
          </div>
        )}

        {/* MOBILE CARD */}
        <div className="space-y-2 sm:hidden">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white p-3 rounded-xl shadow text-sm"
            >
              <div className="font-semibold">
                #{formatId(s.id)}
              </div>

              {editingId === s.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border mt-1 px-2 py-1 rounded w-full"
                />
              ) : (
                <div>{s.name}</div>
              )}

              <div className="text-gray-400 text-xs mt-1">
                {s.created_at
                  ? new Date(s.created_at).toLocaleString("th-TH")
                  : "-"}
              </div>

              {editMode && (
                <div className="flex gap-2 mt-2">
                  {editingId === s.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(s.id)}
                        className="bg-green-500 text-white px-2 py-1 rounded text-xs"
                      >
                        💾
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-300 px-2 py-1 rounded text-xs"
                      >
                        ❌
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditName(s.name);
                        }}
                        className="bg-yellow-400 px-2 py-1 rounded text-xs"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteSupplier(s.id)}
                        className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden sm:block bg-white rounded-xl shadow overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_200px_120px] bg-gray-50 p-3 text-sm font-semibold border-b">
            <span>Supplier ID</span>
            <span>ชื่อ</span>
            <span>สร้างเมื่อ</span>
            <span>จัดการ</span>
          </div>

          {suppliers.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[80px_1fr_200px_120px] p-3 text-sm items-center border border-gray-100 rounded-xl my-1"
            >
              <span>{formatId(s.code)}</span>

              <span>
                {editingId === s.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border border-amber-200 px-2 py-1 rounded-xl w-full"
                  />
                ) : (
                  s.name
                )}
              </span>

              <span>
                {s.created_at
                  ? new Date(s.created_at).toLocaleString("th-TH")
                  : "-"}
              </span>

              <div className="flex gap-2">
                {editMode &&
                  (editingId === s.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(s.id)}
                        className="bg-green-500 text-white px-2 py-1 rounded text-xs"
                      >
                        💾
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-300 px-2 py-1 rounded text-xs"
                      >
                        ❌
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditName(s.name);
                        }}
                        className="bg-yellow-400 px-2 py-1 rounded text-xs"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteSupplier(s.id)}
                        className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                      >
                        🗑
                      </button>
                    </>
                  ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}