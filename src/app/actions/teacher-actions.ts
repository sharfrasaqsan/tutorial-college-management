"use server";

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    // Add additional credentials here if necessary for local development
  });
}

const auth = admin.auth();

export async function updateTeacherCredentials(uid: string, data: { email?: string; password?: string }) {
  try {
    const updateParams: any = {};
    if (data.email) updateParams.email = data.email;
    if (data.password) updateParams.password = data.password;

    if (Object.keys(updateParams).length > 0) {
      await auth.updateUser(uid, updateParams);
      return { success: true };
    }
    return { success: false, error: "No update parameters provided" };
  } catch (error: any) {
    console.error("Admin Credential Sync Failed:", error);
    return { success: false, error: error.message };
  }
}
