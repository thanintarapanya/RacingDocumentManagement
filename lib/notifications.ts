import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export interface CreateNotificationParams {
  userId?: string; // Optional: if targeting a specific user
  targetRole?: string; // Optional: targeting a role (admin, competitor, etc) or 'all'
  targetRoles?: string[]; // Optional: targeting multiple roles
  title: string;
  message: string;
  type: string;
  link?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...params,
      read: false,
      createdAt: new Date().toISOString(), // Use ISO string as we defined in blueprint
    });

    // Mock sending email
    console.log(`[Email Mock] Sending email notification: ${params.title} - ${params.message}`);

  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
