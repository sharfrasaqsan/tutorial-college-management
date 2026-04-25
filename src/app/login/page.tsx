"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { Loader2, Mail, Lock, ShieldCheck } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { loginSchema } from "@/lib/validators";
import { useAuth } from "@/context/AuthContext";

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { updateRole } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      const user = userCredential.user;

      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        throw new Error("User record not found in database.");
      }

      const userData = userDoc.data();
      const role = userData.role;
      
      updateRole(role);
      
      // Store session securely with js-cookie to be read by Next.js middleware
      Cookies.set("session", JSON.stringify({ uid: user.uid, role }), { expires: 7 });

      toast.success("Successfully logged in!");
      
      // Redirect based on role
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        throw new Error("Invalid role assigned to user.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s'}}></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="glass-dark rounded-3xl p-8 shadow-2xl border border-slate-700/50">
          <div className="text-center mb-10">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-primary/30 shadow-inner">
              <ShieldCheck className="text-primary w-8 h-8" />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-400 text-sm">
              Sign in to manage the tutorial college
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  {...register("email")}
                  type="email"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-500 transition-all outline-none"
                  placeholder="admin@tutorial.edu"
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs ml-1 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  {...register("password")}
                  type="password"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-500 transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs ml-1 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-dark to-primary hover:from-primary hover:to-primary-dark text-white rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all outline-none transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
           <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] mb-3">Software Architecture & Design</p>
           <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-black text-slate-300 tracking-tight">AM. Sharfras Aqsan</p>
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                 <span>{`sharfrasaqsan@gmail.com`}</span>
                 <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                 <span>0751230001</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
