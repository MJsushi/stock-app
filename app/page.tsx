"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  useEffect(() => {
    const test = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*");

      console.log("data:", data);
      console.log("error:", error);
    };

    test();
  }, []);

  return (
    <div className="p-10 text-3xl text-green-500">
      Test Supabase 💚
    </div>
  );
}