'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useAppStore, Entry, DeletedItem } from '@/lib/store';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const setEntries = useAppStore((state) => state.setEntries);
  const setDeletedItems = useAppStore((state) => state.setDeletedItems);
  const setUserRole = useAppStore((state) => state.setUserRole);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          let roleToAssign = 'competitor';
          let isNewUser = !userDoc.exists();
          
          // Use window.location to avoid Next.js SSR issues with useSearchParams in layout
          const searchParams = new URLSearchParams(window.location.search);
          const inviteId = searchParams.get('invite');

          if (isNewUser) {
            if (user.email === 'info@embeddedlinuxgroup.com') {
              roleToAssign = 'admin';
            } else if (inviteId) {
              // Check if invite is valid
              const inviteDoc = await getDoc(doc(db, 'invitations', inviteId));
              if (inviteDoc.exists() && !inviteDoc.data().used) {
                roleToAssign = inviteDoc.data().role;
                await updateDoc(doc(db, 'invitations', inviteId), { used: true });
              }
            }
            
            await setDoc(userDocRef, { 
              email: user.email || '', 
              displayName: user.displayName || '',
              role: roleToAssign, 
              createdAt: new Date().toISOString() 
            });
            setUserRole(roleToAssign);
          } else {
            // User exists, check if they are using a valid invite to upgrade role
            if (inviteId) {
              const inviteDoc = await getDoc(doc(db, 'invitations', inviteId));
              if (inviteDoc.exists() && !inviteDoc.data().used) {
                roleToAssign = inviteDoc.data().role;
                await updateDoc(doc(db, 'invitations', inviteId), { used: true });
                await updateDoc(userDocRef, { role: roleToAssign });
                setUserRole(roleToAssign);
              } else {
                setUserRole(userDoc.data()?.role || 'competitor');
              }
            } else {
              setUserRole(userDoc.data()?.role || 'competitor');
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('competitor'); // Fallback
        }
        setIsAuthReady(true);
        if (pathname === '/login' || pathname === '/signup') {
          router.push('/');
        }
      } else {
        setUserRole(null);
        setIsAuthReady(true);
        if (pathname !== '/login' && pathname !== '/signup') {
          router.push('/login');
        }
      }
    });

    return () => unsubscribeAuth();
  }, [pathname, router, setUserRole]);

  useEffect(() => {
    if (!isAuthReady || !auth.currentUser) return;

    const entriesQuery = query(collection(db, 'entries'), orderBy('createdAt', 'desc'));
    const unsubscribeEntries = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const entriesData = snapshot.docs.map(doc => {
          const data = doc.data();
          let parsedFormData = {};
          try {
            parsedFormData = typeof data.formData === 'string' ? JSON.parse(data.formData) : data.formData;
          } catch (e) {
            console.error('Failed to parse formData', e);
          }
          return {
            ...data,
            id: Number(doc.id),
            formData: parsedFormData
          } as Entry;
        });
        setEntries(entriesData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'entries');
      }
    );

    const deletedItemsQuery = query(collection(db, 'deletedItems'), orderBy('deletedAt', 'desc'));
    const unsubscribeDeletedItems = onSnapshot(
      deletedItemsQuery,
      (snapshot) => {
        const deletedData = snapshot.docs.map(doc => {
          const data = doc.data();
          let parsedOriginalData = {};
          try {
            parsedOriginalData = typeof data.originalData === 'string' ? JSON.parse(data.originalData) : data.originalData;
          } catch (e) {
            console.error('Failed to parse originalData', e);
          }
          return {
            ...data,
            id: doc.id,
            originalData: parsedOriginalData
          } as DeletedItem;
        });
        setDeletedItems(deletedData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'deletedItems');
      }
    );

    return () => {
      unsubscribeEntries();
      unsubscribeDeletedItems();
    };
  }, [isAuthReady, setEntries, setDeletedItems]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
