import { Member, EventItem, EventAttendance } from '../types';
import { INITIAL_SEED_MEMBERS, INITIAL_SEED_EVENTS, INITIAL_SEED_ATTENDANCES } from '../data/constants';
import { db, auth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';

const MEMBERS_STORAGE_KEY = 'pks_youth_members_database_v2';
const EVENTS_STORAGE_KEY = 'pks_youth_events_database_v1';
const ATTENDANCE_STORAGE_KEY = 'pks_youth_attendance_database_v1';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Local storage management
export function loadMembersFromLocal(): Member[] {
  try {
    const raw = localStorage.getItem(MEMBERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_MEMBERS));
      return INITIAL_SEED_MEMBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_MEMBERS;
  } catch (err) {
    console.error('Error loading local members:', err);
    return INITIAL_SEED_MEMBERS;
  }
}

export function saveMembersToLocal(members: Member[], notify: boolean = true): void {
  try {
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(members));
    if (notify) {
      window.dispatchEvent(new Event('pks_members_updated'));
    }
  } catch (err) {
    console.error('Error saving members locally:', err);
  }
}

// Realtime Firestore Subscription
export function subscribeMembersFirestore(onUpdate: (members: Member[]) => void): () => void {
  const colRef = collection(db, 'members');

  const unsubscribe = onSnapshot(
    colRef,
    snapshot => {
      if (snapshot.empty) {
        // Seed initial members to Firestore if database is empty
        const initial = loadMembersFromLocal();
        const batch = writeBatch(db);
        initial.forEach(m => {
          const ref = doc(db, 'members', m.id);
          batch.set(ref, m);
        });
        batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'members'));
        onUpdate(initial);
        return;
      }

      const firestoreMembers: Member[] = snapshot.docs.map(docSnap => docSnap.data() as Member);
      // Sort newest created first
      firestoreMembers.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      saveMembersToLocal(firestoreMembers, false);
      onUpdate(firestoreMembers);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'members');
      onUpdate(loadMembersFromLocal());
    }
  );

  return unsubscribe;
}

export function addMemberLocal(
  newMember: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>,
  createdByAdmin: string
): Member {
  const currentList = loadMembersFromLocal();
  const now = new Date().toISOString();
  const id = `pks_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const memberObj: Member = {
    ...newMember,
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: createdByAdmin,
  };

  const updatedList = [memberObj, ...currentList];
  saveMembersToLocal(updatedList);

  // Sync to Firestore
  setDoc(doc(db, 'members', id), memberObj).catch(err =>
    handleFirestoreError(err, OperationType.WRITE, `members/${id}`)
  );

  return memberObj;
}

export function updateMemberLocal(id: string, updatedData: Partial<Member>): Member | null {
  const currentList = loadMembersFromLocal();
  const index = currentList.findIndex(m => m.id === id);
  if (index === -1) return null;

  const updatedMember: Member = {
    ...currentList[index],
    ...updatedData,
    updatedAt: new Date().toISOString(),
  };

  currentList[index] = updatedMember;
  saveMembersToLocal(currentList);

  // Sync to Firestore
  setDoc(doc(db, 'members', id), updatedMember).catch(err =>
    handleFirestoreError(err, OperationType.UPDATE, `members/${id}`)
  );

  return updatedMember;
}

export function deleteMemberLocal(id: string): boolean {
  const currentList = loadMembersFromLocal();
  const filtered = currentList.filter(m => m.id !== id);
  if (filtered.length === currentList.length) return false;

  saveMembersToLocal(filtered);

  // Sync to Firestore
  deleteDoc(doc(db, 'members', id)).catch(err =>
    handleFirestoreError(err, OperationType.DELETE, `members/${id}`)
  );

  return true;
}

export function bulkImportMembersLocal(
  newMembers: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[],
  createdByAdmin: string
): { count: number; items: Member[] } {
  const currentList = loadMembersFromLocal();
  const now = new Date().toISOString();

  const createdItems: Member[] = newMembers.map((m, index) => ({
    ...m,
    id: `pks_imp_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 5)}`,
    createdAt: now,
    updatedAt: now,
    createdBy: createdByAdmin,
  }));

  const merged = [...createdItems, ...currentList];
  saveMembersToLocal(merged);

  // Firestore batch write
  try {
    const batch = writeBatch(db);
    createdItems.forEach(item => {
      const ref = doc(db, 'members', item.id);
      batch.set(ref, item);
    });
    batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'members/bulk'));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'members/bulk');
  }

  return { count: createdItems.length, items: createdItems };
}

// ================= EVENTS STORAGE =================

export function loadEventsFromLocal(): EventItem[] {
  try {
    const raw = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_EVENTS));
      return INITIAL_SEED_EVENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_EVENTS;
  } catch (err) {
    console.error('Error loading local events:', err);
    return INITIAL_SEED_EVENTS;
  }
}

export function saveEventsToLocal(events: EventItem[], notify: boolean = true): void {
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    if (notify) {
      window.dispatchEvent(new Event('pks_events_updated'));
    }
  } catch (err) {
    console.error('Error saving events locally:', err);
  }
}

export function subscribeEventsFirestore(onUpdate: (events: EventItem[]) => void): () => void {
  const colRef = collection(db, 'events');

  const unsubscribe = onSnapshot(
    colRef,
    snapshot => {
      if (snapshot.empty) {
        const initial = loadEventsFromLocal();
        const batch = writeBatch(db);
        initial.forEach(ev => {
          const ref = doc(db, 'events', ev.id);
          batch.set(ref, ev);
        });
        batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'events'));
        onUpdate(initial);
        return;
      }

      const firestoreEvents: EventItem[] = snapshot.docs.map(docSnap => docSnap.data() as EventItem);
      firestoreEvents.sort(
        (a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime()
      );

      saveEventsToLocal(firestoreEvents, false);
      onUpdate(firestoreEvents);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'events');
      onUpdate(loadEventsFromLocal());
    }
  );

  return unsubscribe;
}

export function addEventLocal(
  newEvent: Omit<EventItem, 'id' | 'createdAt'>,
  createdByAdmin: string
): EventItem {
  const currentList = loadEventsFromLocal();
  const now = new Date().toISOString();
  const id = `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const eventObj: EventItem = {
    ...newEvent,
    id,
    createdAt: now,
    createdBy: createdByAdmin,
  };

  const updatedList = [eventObj, ...currentList];
  saveEventsToLocal(updatedList);

  setDoc(doc(db, 'events', id), eventObj).catch(err =>
    handleFirestoreError(err, OperationType.WRITE, `events/${id}`)
  );

  return eventObj;
}

export function deleteEventLocal(id: string): boolean {
  const currentList = loadEventsFromLocal();
  const filtered = currentList.filter(e => e.id !== id);
  if (filtered.length === currentList.length) return false;

  saveEventsToLocal(filtered);

  deleteDoc(doc(db, 'events', id)).catch(err =>
    handleFirestoreError(err, OperationType.DELETE, `events/${id}`)
  );

  return true;
}

// ================= ATTENDANCE STORAGE =================

export function loadAttendancesFromLocal(): EventAttendance[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(INITIAL_SEED_ATTENDANCES));
      return INITIAL_SEED_ATTENDANCES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_ATTENDANCES;
  } catch (err) {
    console.error('Error loading local attendances:', err);
    return INITIAL_SEED_ATTENDANCES;
  }
}

export function saveAttendancesToLocal(attendances: EventAttendance[], notify: boolean = true): void {
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(attendances));
    if (notify) {
      window.dispatchEvent(new Event('pks_attendances_updated'));
    }
  } catch (err) {
    console.error('Error saving attendances locally:', err);
  }
}

export function subscribeAttendancesFirestore(
  onUpdate: (attendances: EventAttendance[]) => void
): () => void {
  const colRef = collection(db, 'event_attendances');

  const unsubscribe = onSnapshot(
    colRef,
    snapshot => {
      if (snapshot.empty) {
        const initial = loadAttendancesFromLocal();
        const batch = writeBatch(db);
        initial.forEach(att => {
          const ref = doc(db, 'event_attendances', att.id);
          batch.set(ref, att);
        });
        batch.commit().catch(err =>
          handleFirestoreError(err, OperationType.WRITE, 'event_attendances')
        );
        onUpdate(initial);
        return;
      }

      const firestoreAttendances: EventAttendance[] = snapshot.docs.map(
        docSnap => docSnap.data() as EventAttendance
      );
      firestoreAttendances.sort(
        (a, b) => new Date(b.waktuPresensi).getTime() - new Date(a.waktuPresensi).getTime()
      );

      saveAttendancesToLocal(firestoreAttendances, false);
      onUpdate(firestoreAttendances);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'event_attendances');
      onUpdate(loadAttendancesFromLocal());
    }
  );

  return unsubscribe;
}

export function addAttendanceLocal(
  newAtt: Omit<EventAttendance, 'id' | 'waktuPresensi'>
): EventAttendance {
  const currentList = loadAttendancesFromLocal();
  const now = new Date().toISOString();
  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const attObj: EventAttendance = {
    ...newAtt,
    id,
    waktuPresensi: now,
  };

  const updatedList = [attObj, ...currentList];
  saveAttendancesToLocal(updatedList);

  setDoc(doc(db, 'event_attendances', id), attObj).catch(err =>
    handleFirestoreError(err, OperationType.WRITE, `event_attendances/${id}`)
  );

  return attObj;
}

export function deleteAttendanceLocal(id: string): boolean {
  const current = loadAttendancesFromLocal();
  const filtered = current.filter(a => a.id !== id);
  saveAttendancesToLocal(filtered);

  deleteDoc(doc(db, 'event_attendances', id)).catch(err =>
    handleFirestoreError(err, OperationType.DELETE, `event_attendances/${id}`)
  );

  return true;
}

// ================= DYNAMIC CUSTOM RECOMMENDATIONS STORAGE =================
const CUSTOM_SKILLS_KEY = 'pks_custom_skills_list_v1';
const CUSTOM_HOBBIES_KEY = 'pks_custom_hobbies_list_v1';

export function subscribeTagsFirestore(
  onUpdate: (tags: { skills: string[]; hobbies: string[] }) => void
): () => void {
  const tagDocRef = doc(db, 'settings', 'tags');

  const unsubscribe = onSnapshot(
    tagDocRef,
    snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const skills: string[] = Array.isArray(data.skills) ? data.skills : [];
        const hobbies: string[] = Array.isArray(data.hobbies) ? data.hobbies : [];

        localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills));
        localStorage.setItem(CUSTOM_HOBBIES_KEY, JSON.stringify(hobbies));

        onUpdate({ skills, hobbies });
      } else {
        // Seed initial empty document in cloud
        setDoc(tagDocRef, { skills: [], hobbies: [] }, { merge: true }).catch(err =>
          handleFirestoreError(err, OperationType.WRITE, 'settings/tags')
        );
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'settings/tags');
    }
  );

  return unsubscribe;
}

export function getCustomSkills(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SKILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSkill(skill: string): void {
  const clean = skill.trim();
  if (!clean) return;
  const existing = getCustomSkills();
  if (!existing.some(s => s.toLowerCase() === clean.toLowerCase())) {
    const updated = [clean, ...existing];
    localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(updated));
  }

  // Cloud Firestore Sync
  const tagDocRef = doc(db, 'settings', 'tags');
  setDoc(tagDocRef, { skills: arrayUnion(clean) }, { merge: true }).catch(err =>
    handleFirestoreError(err, OperationType.WRITE, 'settings/tags')
  );
}

export function getCustomHobbies(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_HOBBIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomHobby(hobby: string): void {
  const clean = hobby.trim();
  if (!clean) return;
  const existing = getCustomHobbies();
  if (!existing.some(h => h.toLowerCase() === clean.toLowerCase())) {
    const updated = [clean, ...existing];
    localStorage.setItem(CUSTOM_HOBBIES_KEY, JSON.stringify(updated));
  }

  // Cloud Firestore Sync
  const tagDocRef = doc(db, 'settings', 'tags');
  setDoc(tagDocRef, { hobbies: arrayUnion(clean) }, { merge: true }).catch(err =>
    handleFirestoreError(err, OperationType.WRITE, 'settings/tags')
  );
}
