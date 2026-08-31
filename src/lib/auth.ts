import { AdminUser, AdminRole } from '../types';
import { hashPassword } from './utils';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { recordActivityLog } from './storage';

const ADMIN_STORAGE_KEY = 'pks_youth_admins_v1';
const DELETED_ADMINS_STORAGE_KEY = 'pks_youth_deleted_admins_v1';
const CURRENT_SESSION_KEY = 'pks_youth_session_v1';

// Default initial Super Admin
export const SUPER_ADMIN_DEFAULT: Omit<AdminUser, 'passwordHash'> & { defaultPassword: string } = {
  id: 'AdminSuper',
  username: 'AdminSuper',
  name: 'Super Admin BPPM',
  defaultPassword: 'M1q17417SuperAdmin',
  role: 'superadmin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function getDeletedAdminIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_ADMINS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeletedAdminId(id: string): void {
  try {
    const set = getDeletedAdminIds();
    set.add(id);
    localStorage.setItem(DELETED_ADMINS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Failed to save deleted admin id:', err);
  }
}

function removeDeletedAdminId(id: string): void {
  try {
    const set = getDeletedAdminIds();
    set.delete(id);
    localStorage.setItem(DELETED_ADMINS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Failed to remove deleted admin id:', err);
  }
}

export function loadAdminsFromLocal(): AdminUser[] {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    const deletedIds = getDeletedAdminIds();

    if (!raw) {
      const superHash = 'c697e00e4751478ec11abf1d6a6200fd4199c0d388654a1d471540a927a4d531';
      const initialList: AdminUser[] = [
        {
          id: SUPER_ADMIN_DEFAULT.id,
          username: SUPER_ADMIN_DEFAULT.username,
          name: SUPER_ADMIN_DEFAULT.name,
          passwordHash: superHash,
          role: 'superadmin',
          createdAt: SUPER_ADMIN_DEFAULT.createdAt,
        },
      ];
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(initialList));
      return initialList;
    }
    const parsed: AdminUser[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(a => a && a.id && !deletedIds.has(a.id));
    }
    return [];
  } catch {
    return [];
  }
}

export function saveAdminsToLocal(admins: AdminUser[], notify: boolean = true): void {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admins));
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pks_admins_updated'));
    }
  } catch (err) {
    console.error('Failed to save admins locally:', err);
  }
}

export async function initializeAdminsStore(): Promise<AdminUser[]> {
  const localList = loadAdminsFromLocal();
  const deletedIds = getDeletedAdminIds();

  try {
    // Try reading from Firestore
    const colSnap = await getDocs(collection(db, 'admins'));
    if (!colSnap.empty) {
      const firestoreAdmins: AdminUser[] = colSnap.docs
        .map(d => d.data() as AdminUser)
        .filter(a => a && a.id && !deletedIds.has(a.id));
      
      // Merge Firestore admins with Local admins (local admins preserved, deleted excluded)
      const adminMap = new Map<string, AdminUser>();
      localList.forEach(a => {
        if (a && a.id && !deletedIds.has(a.id)) adminMap.set(a.id, a);
      });
      firestoreAdmins.forEach(a => {
        if (a && a.id && !deletedIds.has(a.id)) adminMap.set(a.id, a);
      });

      const merged = Array.from(adminMap.values());
      saveAdminsToLocal(merged, false); // save silently to prevent recursive loop
      return merged;
    } else {
      // If firestore is empty, seed existing local admins to firestore
      for (const a of localList) {
        await setDoc(doc(db, 'admins', a.id), a).catch(() => {});
      }
    }

    return localList;
  } catch (err) {
    console.warn('Firestore admins fetch warning (using local store):', err);
    return localList;
  }
}

export async function getAdminsList(): Promise<AdminUser[]> {
  return await initializeAdminsStore();
}

export async function loginAdmin(usernameInput: string, passwordInput: string): Promise<AdminUser | null> {
  const admins = await initializeAdminsStore();
  const inputHash = await hashPassword(passwordInput);

  // Match case-insensitive username or exact ID
  const found = admins.find(
    a =>
      a.username.trim().toLowerCase() === usernameInput.trim().toLowerCase() ||
      a.id.trim().toLowerCase() === usernameInput.trim().toLowerCase()
  );

  if (!found) {
    return null;
  }

  // Check password hash
  if (found.passwordHash === inputHash) {
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(found));
    return found;
  }

  return null;
}

export function getCurrentAdminSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function logoutAdmin(): void {
  localStorage.removeItem(CURRENT_SESSION_KEY);
}

export async function createNewAdmin(
  newUsername: string,
  newPassword: string,
  name: string,
  role: AdminRole = 'admin'
): Promise<{ success: boolean; message: string; admin?: AdminUser }> {
  const current = getCurrentAdminSession();
  if (!current || current.role !== 'superadmin') {
    return { success: false, message: 'Hanya Super Admin yang dapat menambahkan admin baru!' };
  }

  const admins = loadAdminsFromLocal();
  const trimmedUser = newUsername.trim();

  if (!trimmedUser || !newPassword.trim() || !name.trim()) {
    return { success: false, message: 'Semua bidang wajib diisi!' };
  }

  if (admins.some(a => a.username.toLowerCase() === trimmedUser.toLowerCase())) {
    return { success: false, message: 'Username / ID Admin ini sudah digunakan!' };
  }

  const passHash = await hashPassword(newPassword);
  const newAdminObj: AdminUser = {
    id: `admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: trimmedUser,
    name: name.trim(),
    passwordHash: passHash,
    role,
    createdAt: new Date().toISOString(),
  };

  removeDeletedAdminId(newAdminObj.id);

  admins.push(newAdminObj);
  saveAdminsToLocal(admins, true);

  recordActivityLog({
    adminName: current.name,
    adminRole: current.role,
    adminId: current.id,
    category: 'admin',
    actionType: 'create',
    targetTitle: `${newAdminObj.name} (@${newAdminObj.username})`,
    details: `Membuat akun admin baru @${newAdminObj.username} (${newAdminObj.name}) dengan peran "${newAdminObj.role}"`,
  });

  // Sync to Firestore in background (non-blocking)
  setDoc(doc(db, 'admins', newAdminObj.id), newAdminObj).catch(err => {
    console.warn('Firestore setDoc warning for admin:', err);
  });

  return { success: true, message: 'Admin baru berhasil ditambahkan.', admin: newAdminObj };
}

export async function deleteAdminUser(adminIdToDelete: string): Promise<{ success: boolean; message: string }> {
  const current = getCurrentAdminSession();
  if (!current || current.role !== 'superadmin') {
    return { success: false, message: 'Hanya Super Admin yang memiliki hak menghapus admin.' };
  }

  if (adminIdToDelete === SUPER_ADMIN_DEFAULT.id) {
    return { success: false, message: 'Super Admin utama tidak dapat dihapus!' };
  }

  if (current.id === adminIdToDelete) {
    return { success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.' };
  }

  // Record tombstone so this deleted admin won't be resurrected by remote merge
  saveDeletedAdminId(adminIdToDelete);

  let admins = loadAdminsFromLocal();
  const adminToDelete = admins.find(a => a.id === adminIdToDelete);
  admins = admins.filter(a => a.id !== adminIdToDelete);
  saveAdminsToLocal(admins, true);

  recordActivityLog({
    adminName: current.name,
    adminRole: current.role,
    adminId: current.id,
    category: 'admin',
    actionType: 'delete',
    targetTitle: adminToDelete ? `${adminToDelete.name} (@${adminToDelete.username})` : 'Admin',
    details: `Menghapus akun admin @${adminToDelete?.username || '-'} (${adminToDelete?.name || '-'}) dengan peran "${adminToDelete?.role || 'admin'}"`,
  });

  // Sync delete to Firestore
  deleteDoc(doc(db, 'admins', adminIdToDelete)).catch(err => {
    console.warn('Firestore deleteDoc warning for admin:', err);
  });

  return { success: true, message: 'Admin berhasil dihapus.' };
}
