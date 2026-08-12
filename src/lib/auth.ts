import { AdminUser, AdminRole } from '../types';
import { hashPassword } from './utils';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

const ADMIN_STORAGE_KEY = 'pks_youth_admins_v1';
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

export async function initializeAdminsStore(): Promise<AdminUser[]> {
  try {
    // Try reading from Firestore first
    const colSnap = await getDocs(collection(db, 'admins'));
    if (!colSnap.empty) {
      const firestoreAdmins: AdminUser[] = colSnap.docs.map(d => d.data() as AdminUser);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(firestoreAdmins));
      return firestoreAdmins;
    }

    // Fallback or Initial Seed
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    let initialList: AdminUser[] = [];
    if (raw) {
      initialList = JSON.parse(raw);
    } else {
      const superHash = await hashPassword(SUPER_ADMIN_DEFAULT.defaultPassword);
      initialList = [
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
    }

    // Seed to Firestore
    for (const a of initialList) {
      await setDoc(doc(db, 'admins', a.id), a).catch(console.error);
    }

    return initialList;
  } catch (err) {
    console.error('Failed to init admins store:', err);
    // Fallback to local
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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

  const admins = await getAdminsList();
  const trimmedUser = newUsername.trim();

  if (!trimmedUser || !newPassword.trim() || !name.trim()) {
    return { success: false, message: 'Semua bidang wajib diisi!' };
  }

  if (admins.some(a => a.username.toLowerCase() === trimmedUser.toLowerCase())) {
    return { success: false, message: 'Username / ID Admin ini sudah digunakan!' };
  }

  const passHash = await hashPassword(newPassword);
  const newAdminObj: AdminUser = {
    id: `admin_${Date.now()}`,
    username: trimmedUser,
    name: name.trim(),
    passwordHash: passHash,
    role,
    createdAt: new Date().toISOString(),
  };

  admins.push(newAdminObj);
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admins));

  // Sync to Firestore
  await setDoc(doc(db, 'admins', newAdminObj.id), newAdminObj).catch(console.error);

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

  let admins = await getAdminsList();
  admins = admins.filter(a => a.id !== adminIdToDelete);
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admins));

  // Sync delete to Firestore
  await deleteDoc(doc(db, 'admins', adminIdToDelete)).catch(console.error);

  return { success: true, message: 'Admin berhasil dihapus.' };
}
