import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next();
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = req.nextUrl.clone();

  // ❌ ยังไม่ login
  if (!user) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 🔥 FIX ตรงนี้
  const rawEmail =
    user.email ||
    user.user_metadata?.email ||
    user.user_metadata?.preferred_username ||
    "";

  const email = rawEmail.toLowerCase();

  // 🔒 เช็ค domain
  if (!email.endsWith("@rungrueangs.com")) {
    const redirect = NextResponse.redirect(new URL("/", req.url));

    req.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, "", { maxAge: 0 });
    });

    return redirect;
  }

  // 🔁 login แล้วไม่ต้องอยู่หน้า login
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/suppliers", "/dashboard", "/scan", "/inbound"],
};