import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { StudentProfileProvider } from "@/context/StudentProfileContext";
import { TeacherProfileProvider } from "@/context/TeacherProfileContext";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SmartAcademy — Institutional Management",
    template: "%s | SmartAcademy",
  },
  description:
    "SmartAcademy is a professional management platform for tutorial colleges — managing students, teachers, attendance, timetables, fees and payroll in one place.",
  keywords: [
    "tutorial college",
    "school management",
    "student management",
    "teacher payroll",
    "attendance tracking",
  ],
  authors: [{ name: "SmartAcademy" }],
  openGraph: {
    title: "SmartAcademy — Institutional Management",
    description: "Professional management platform for tutorial colleges.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D9E75",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <AuthProvider>
          <StudentProfileProvider>
            <TeacherProfileProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #f1f5f9",
                    borderRadius: "12px",
                    fontSize: "0.8125rem",
                    fontWeight: "600",
                    boxShadow:
                      "0 4px 24px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
                  },
                  success: {
                    iconTheme: {
                      primary: "#1D9E75",
                      secondary: "#ffffff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#ef4444",
                      secondary: "#ffffff",
                    },
                  },
                }}
              />
            </TeacherProfileProvider>
          </StudentProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
