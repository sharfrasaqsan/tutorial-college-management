import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  serverTimestamp,
  writeBatch,
  getDocs
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  status: "unread" | "read";
  link?: string;
  createdAt: any;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      
      setNotifications(data);
      setUnreadCount(data.filter((n) => n.status === "unread").length);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), {
        status: "read",
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const unreadDocs = notifications.filter(n => n.status === 'unread');
      unreadDocs.forEach(n => {
        batch.update(doc(db, "notifications", n.id), { status: 'read' });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}

export const createNotification = async (notif: Omit<Notification, "id" | "createdAt" | "status">) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notif,
      status: "unread",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

export const notifyAdmins = async (notif: Omit<Notification, "id" | "createdAt" | "status" | "userId">) => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "admin"));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    
    snap.docs.forEach(adminDoc => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        ...notif,
        userId: adminDoc.id,
        status: "unread",
        createdAt: serverTimestamp(),
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};
