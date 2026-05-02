"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 INIT AUTH
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();

      // 🧹 ลบ hash (#access_token)
      if (window.location.hash) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }

      if (!mounted) return;

      const user = data.session?.user;

      if (user) {
        const rawEmail =
          user.email ||
          user.user_metadata?.email ||
          user.user_metadata?.preferred_username ||
          "";

        const email = rawEmail.toLowerCase();

        // 🔒 เช็ค domain (client-side guard)
        if (!email.endsWith("@rungrueangs.com")) {
          await supabase.auth.signOut();
          setError("❌ อนุญาตเฉพาะอีเมลบริษัทเท่านั้น");
          setLoading(false);
          return;
        }

        // ✅ ผ่าน → เข้า dashboard
        router.replace("/dashboard");
      } else {
        setLoading(false);
      }
    };

    initAuth();

    // 🔄 listen auth change
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user;

      if (user) {
        const rawEmail =
          user.email ||
          user.user_metadata?.email ||
          user.user_metadata?.preferred_username ||
          "";

        const email = rawEmail.toLowerCase();

        if (!email.endsWith("@rungrueangs.com")) {
          await supabase.auth.signOut();
          setError("❌ อนุญาตเฉพาะอีเมลบริษัทเท่านั้น");
          return;
        }

        router.replace("/dashboard");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // 🛟 fallback กันค้าง
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // 🔐 login Microsoft
  const handleLogin = async () => {
    setLoggingIn(true);
    setError(null);

    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  // ⏳ loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  // 🔓 UI
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-2xl shadow w-[320px] text-center space-y-4">
        
        <div className="text-lg font-semibold">
          🔐 เข้าสู่ระบบ
        </div>

        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loggingIn}
          className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loggingIn ? "กำลังพาไป Microsoft..." : "Login with Microsoft"}
        </button>

        <div className="text-xs text-gray-400">
          ใช้อีเมล @rungrueangs.com เท่านั้น
        </div>

      </div>
    </div>
  );
}