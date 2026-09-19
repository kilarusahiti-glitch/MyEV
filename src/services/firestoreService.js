// Firestore Service Layer with Local Fallback for Demo & Offline Hackathon Mode

import { db, isFirebaseConfigured } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { INITIAL_ORGANIZATION, INITIAL_VEHICLES, INITIAL_CHARGERS } from '../data/seedData';

// In-memory fallback stores
let localOrg = { ...INITIAL_ORGANIZATION };
let localVehicles = [...INITIAL_VEHICLES];
let localChargers = [...INITIAL_CHARGERS];
let localTelemetry = null;
const localProfiles = {};
const localHistory = [];

export const firestoreService = {
  // Check if active backend is Cloud Firestore or Local Fallback
  isCloudConnected() {
    return isFirebaseConfigured && db !== null;
  },

  // Organization
  async getOrganization(orgId = 'org-smartcharge-apt') {
    if (!this.isCloudConnected()) {
      return localOrg;
    }
    try {
      const docRef = doc(db, 'organizations', orgId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      // Seed if doc doesn't exist
      await setDoc(docRef, INITIAL_ORGANIZATION);
      return INITIAL_ORGANIZATION;
    } catch (err) {
      console.warn('Firestore getOrganization fallback:', err);
      return localOrg;
    }
  },

  // Vehicles
  async getVehicles(orgId = 'org-smartcharge-apt') {
    if (!this.isCloudConnected()) {
      return localVehicles;
    }
    try {
      const colRef = collection(db, 'vehicles');
      const q = query(colRef, where('organizationId', '==', orgId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // Seed vehicles
        const seeded = INITIAL_VEHICLES.map(v => ({ ...v, organizationId: orgId }));
        for (const v of seeded) {
          await setDoc(doc(db, 'vehicles', v.id), v);
        }
        return seeded;
      }
      return snapshot.docs.map(doc => doc.data());
    } catch (err) {
      console.warn('Firestore getVehicles fallback:', err);
      return localVehicles;
    }
  },

  async updateVehicle(vehicleId, updates, orgId = 'org-smartcharge-apt') {
    // Update local store
    localVehicles = localVehicles.map(v => v.id === vehicleId ? { ...v, ...updates } : v);
    if (!this.isCloudConnected()) {
      return { success: true, mode: 'local' };
    }
    try {
      const docRef = doc(db, 'vehicles', vehicleId);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
      return { success: true, mode: 'cloud' };
    } catch (err) {
      console.warn('Firestore updateVehicle fallback:', err);
      return { success: true, mode: 'local-fallback' };
    }
  },

  // Chargers
  async getChargers(orgId = 'org-smartcharge-apt') {
    if (!this.isCloudConnected()) {
      return localChargers;
    }
    try {
      const colRef = collection(db, 'chargers');
      const q = query(colRef, where('organizationId', '==', orgId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        const seeded = INITIAL_CHARGERS.map(c => ({ ...c, organizationId: orgId }));
        for (const c of seeded) {
          await setDoc(doc(db, 'chargers', c.id), c);
        }
        return seeded;
      }
      return snapshot.docs.map(doc => doc.data());
    } catch (err) {
      console.warn('Firestore getChargers fallback:', err);
      return localChargers;
    }
  },

  async updateCharger(chargerId, updates, orgId = 'org-smartcharge-apt') {
    localChargers = localChargers.map(c => c.id === chargerId ? { ...c, ...updates } : c);
    if (!this.isCloudConnected()) {
      return { success: true, mode: 'local' };
    }
    try {
      const docRef = doc(db, 'chargers', chargerId);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
      return { success: true, mode: 'cloud' };
    } catch (err) {
      console.warn('Firestore updateCharger fallback:', err);
      return { success: true, mode: 'local-fallback' };
    }
  },

  async getProfile(userId) {
    if (!userId) return null;
    if (!this.isCloudConnected()) return localProfiles[userId] || null;
    try {
      const snapshot = await getDoc(doc(db, 'users', userId));
      return snapshot.exists() ? snapshot.data() : (localProfiles[userId] || null);
    } catch (err) {
      console.warn('Firestore getProfile fallback:', err);
      return localProfiles[userId] || null;
    }
  },

  async updateProfile(userId, profile) {
    if (!userId) return { success: false, mode: 'unavailable' };
    const value = { ...profile, userId, updatedAt: new Date().toISOString() };
    localProfiles[userId] = value;
    if (!this.isCloudConnected()) return { success: true, mode: 'local' };
    try {
      await setDoc(doc(db, 'users', userId), value, { merge: true });
      return { success: true, mode: 'cloud' };
    } catch (err) {
      console.warn('Firestore updateProfile fallback:', err);
      return { success: true, mode: 'local-fallback' };
    }
  },

  async saveAuthoritativeSnapshot(snapshot) {
    localTelemetry = snapshot;
    if (!this.isCloudConnected()) return { success: true, mode: 'local' };
    try {
      await setDoc(doc(db, 'system_snapshots', 'current'), { ...snapshot, updatedAt: new Date().toISOString() }, { merge: true });
      return { success: true, mode: 'cloud' };
    } catch (err) {
      console.warn('Firestore snapshot fallback:', err);
      return { success: true, mode: 'local-fallback' };
    }
  },

  async saveHistoryRecord(record) {
    localHistory.push(record);
    if (!this.isCloudConnected()) return { success: true, mode: 'local' };
    try {
      await setDoc(doc(db, 'history', String(record.id || record.session_id || Date.now())), { ...record, updatedAt: new Date().toISOString() }, { merge: true });
      return { success: true, mode: 'cloud' };
    } catch (err) {
      console.warn('Firestore history fallback:', err);
      return { success: true, mode: 'local-fallback' };
    }
  },

  // Telemetry periodic persistence (throttled)
  async saveTelemetrySnapshot(telemetryData, orgId = 'org-smartcharge-apt') {
    localTelemetry = telemetryData;
    if (!this.isCloudConnected()) return;

    try {
      const docRef = doc(db, 'telemetry', `current_${orgId}`);
      await setDoc(docRef, {
        ...telemetryData,
        organizationId: orgId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      // Non-blocking catch
      console.debug('Throttled telemetry sync:', err.message);
    }
  }
};
