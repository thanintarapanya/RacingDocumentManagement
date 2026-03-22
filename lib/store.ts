import { create } from 'zustand';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firebase-utils';

export type Entry = {
  id: number;
  created: string;
  lastUpdate: string;
  nameEn: string;
  nameTh: string;
  seriesRace: string;
  gradeRace: string;
  carNumber: string;
  formData?: any;
  userId?: string;
};

export type DeletedItem = {
  id: string;
  type: string;
  name: string;
  deletedBy: string;
  deletedAt: string;
  expires: string;
  originalData?: any;
  userId?: string;
};

interface AppState {
  entries: Entry[];
  deletedItems: DeletedItem[];
  setEntries: (entries: Entry[]) => void;
  setDeletedItems: (items: DeletedItem[]) => void;
  addEntry: (entry: Omit<Entry, 'id' | 'created' | 'lastUpdate'>) => Promise<void>;
  updateEntry: (id: number, entry: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: number) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  entries: [],
  deletedItems: [],
  setEntries: (entries) => set({ entries }),
  setDeletedItems: (deletedItems) => set({ deletedItems }),
  
  addEntry: async (entryData) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const state = get();
    const newId = state.entries.length > 0 ? Math.max(...state.entries.map(e => e.id)) + 1 : 1;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const newEntry: Entry = {
      ...entryData,
      id: newId,
      created: now,
      lastUpdate: '-',
      userId: user.uid,
    };
    
    try {
      const docRef = doc(db, 'entries', newId.toString());
      await setDoc(docRef, {
        ...newEntry,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formData: JSON.stringify(entryData.formData || {})
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'entries');
    }
  },
  
  updateEntry: async (id, updatedData) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    try {
      const docRef = doc(db, 'entries', id.toString());
      const updatePayload: any = {
        ...updatedData,
        lastUpdate: now,
        updatedAt: new Date().toISOString(),
      };
      if (updatedData.formData) {
        updatePayload.formData = JSON.stringify(updatedData.formData);
      }
      await updateDoc(docRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'entries');
    }
  },
  
  deleteEntry: async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const state = get();
    const entryToDelete = state.entries.find(e => e.id === id);
    if (!entryToDelete) return;
    
    const newDeletedItem: DeletedItem = {
      id: `DEL-ENTRY-${entryToDelete.id}`,
      type: 'Entry Form',
      name: entryToDelete.nameEn || `Entry #${entryToDelete.id}`,
      deletedBy: user.displayName || user.email || 'Admin',
      deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      expires: '7 days',
      originalData: entryToDelete,
      userId: user.uid
    };
    
    try {
      // Add to deletedItems
      const delRef = doc(db, 'deletedItems', newDeletedItem.id);
      await setDoc(delRef, {
        ...newDeletedItem,
        originalData: JSON.stringify(entryToDelete)
      });
      
      // Remove from entries
      const entryRef = doc(db, 'entries', id.toString());
      await deleteDoc(entryRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'entries');
    }
  },
  
  restoreItem: async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const state = get();
    const itemToRestore = state.deletedItems.find(i => i.id === id);
    if (!itemToRestore) return;
    
    try {
      if (itemToRestore.type === 'Entry Form' && itemToRestore.originalData) {
        const entryRef = doc(db, 'entries', itemToRestore.originalData.id.toString());
        await setDoc(entryRef, {
          ...itemToRestore.originalData,
          updatedAt: new Date().toISOString(),
          formData: JSON.stringify(itemToRestore.originalData.formData || {})
        });
      }
      
      const delRef = doc(db, 'deletedItems', id);
      await deleteDoc(delRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deletedItems');
    }
  }
}));
