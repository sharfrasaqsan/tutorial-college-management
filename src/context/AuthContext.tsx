"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

export type UserRole = "admin" | "teacher" | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  updateRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch role from Firestore if not already set by login component
        const sessionCookie = Cookies.get("session");
        if (sessionCookie) {
          try {
            const parsed = JSON.parse(sessionCookie);
            setRole(parsed.role);
          } catch (e) {
            console.error("Failed to parse session cookie");
          }
        } else {
          try {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const userRole = userData.role as UserRole;
              setRole(userRole);
              Cookies.set("session", JSON.stringify({ uid: firebaseUser.uid, role: userRole }), { expires: 7 });
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
          }
        }
      } else {
        setUser(null);
        setRole(null);
        Cookies.remove("session");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    Cookies.remove("session");
    setUser(null);
    setRole(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut, updateRole: setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
