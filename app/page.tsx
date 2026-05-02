"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  // 🔁 เช็ค session ตอนเข้าเว็บ
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        // ✅ login แล้ว → ไป dashboard
        router.replace("/dashboard");
      } else {
        setLoading(false);
      }
    };

    checkSession();

    // 🔄 เผื่อ login กลับมาแล้ว (important!)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // 🔐 login Microsoft
  const handleLogin = async () => {
    setLoggingIn(true);

    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  // ⏳ loading หน้าแรก
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-2xl shadow w-[320px] text-center space-y-4">
        
        <div className="text-lg font-semibold">
          🔐 เข้าสู่ระบบ
        </div>

        <button
          onClick={handleLogin}
          disabled={loggingIn}
          className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loggingIn ? "กำลังพาไป Microsoft..." : "Login with Microsoft"}
        </button>

        <div className="text-xs text-gray-400">
          ใช้อีเมลบริษัทเท่านั้น
        </div>

      </div>
    </div>
  );
}