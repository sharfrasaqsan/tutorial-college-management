import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  const url = request.nextUrl.clone();

  // Redirect to login if accessing protected routes without session
  if (!sessionCookie && (url.pathname.startsWith("/admin") || url.pathname.startsWith("/teacher"))) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role-based protection natively
  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      const role = session.role;

      // Restrict access to admin routes
      if (url.pathname.startsWith("/admin") && role !== "admin") {
        url.pathname = "/teacher/dashboard"; // fallback
        return NextResponse.redirect(url);
      }

      // Restrict access to teacher routes
      if (url.pathname.startsWith("/teacher") && role !== "teacher") {
        url.pathname = "/admin/dashboard"; // fallback
        return NextResponse.redirect(url);
      }

      // Prevent logged-in users from seeing the login page
      if (url.pathname === "/login" || url.pathname === "/") {
        if (role === "admin") {
          url.pathname = "/admin/dashboard";
        } else if (role === "teacher") {
          url.pathname = "/teacher/dashboard";
        }
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error("Invalid session cookie", error);
      request.cookies.delete("session");
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
