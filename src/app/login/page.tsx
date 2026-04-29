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
import { Loader2, Mail, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { loginSchema } from "@/lib/validators";
import { useAuth } from "@/context/AuthContext";

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        throw new Error("User record not found. Contact your administrator.");
      }

      const userData = userDoc.data();
      const role = userData.role;
      
      updateRole(role);
      Cookies.set("session", JSON.stringify({ uid: user.uid, role }), { expires: 7 });

      toast.success("Signed in successfully!");
      
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        throw new Error("Invalid role. Contact your administrator.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative bg-slate-950">
      {/* Multi-layer animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary glow — bottom right */}
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[120px] animate-pulse" />
        {/* Secondary glow — top left */}
        <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-primary-dark/10 rounded-full blur-[100px]" style={{ animationDelay: '1.5s' }} />
        {/* Accent glow — center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-600/5 rounded-full blur-[80px]" />
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>
      
      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Card */}
        <div className="glass-dark rounded-3xl p-8 shadow-2xl shadow-black/40 border border-white/8">
          
          {/* Brand Header */}
          <div className="text-center mb-10">
            {/* Logo mark */}
            <div className="relative inline-flex items-center justify-center mb-6">
              {/* Outer glow ring */}
              <div className="absolute w-20 h-20 rounded-3xl bg-primary/20 blur-lg" />
              {/* Pulsing ring */}
              <div className="absolute w-20 h-20 rounded-3xl border-2 border-primary/20 animate-ping-slow" />
              {/* Icon container */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 ring-1 ring-white/10">
                <ShieldCheck className="text-white w-8 h-8" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.25em]">SmartAcademy</p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Welcome Back
              </h1>
              <p className="text-slate-400 text-sm mt-2 font-medium">
                Sign in to access your management portal
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1 flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                Email Address
              </label>
              <div className="relative group">
                <input
                  {...register("email")}
                  type="email"
                  id="email"
                  autoComplete="email"
                  aria-label="Email address"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/80 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/60 text-white placeholder-slate-500 transition-all outline-none text-sm group-hover:border-slate-600"
                  placeholder="admin@smartacademy.edu"
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs ml-1 flex items-center gap-1 mt-1">
                  <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Password
              </label>
              <div className="relative group">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  autoComplete="current-password"
                  aria-label="Password"
                  className="w-full px-4 py-3 pr-12 bg-slate-800/60 border border-slate-700/80 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/60 text-white placeholder-slate-500 transition-all outline-none text-sm group-hover:border-slate-600"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-xs font-bold px-1 no-tap"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs ml-1 flex items-center gap-1 mt-1">
                  <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="sign-in-btn"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-dark via-primary to-accent hover:brightness-110 text-white rounded-xl font-bold text-sm shadow-xl shadow-primary/25 transition-all outline-none active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In Securely</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Attribution footer */}
        <div className="mt-6 text-center animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <div className="h-px flex-1 bg-slate-800" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3">
              SmartAcademy v2.4.0
            </p>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <p className="text-[9px] text-slate-700 mt-2 font-medium">
            Institutional Management Platform • Enterprise Grade Security
          </p>
        </div>
      </div>
    </div>
  );
}
