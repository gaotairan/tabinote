import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Trip } from '../types/trip';
import { firebaseService } from './firebase';

const COLLECTION_NAME = 'trips';

/**
 * Firestore保存用にオブジェクトを安全に整形（undefinedを除去）
 */
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export const firestoreSync = {
  /**
   * クラウド同期が現在利用可能か
   */
  isAvailable(): boolean {
    return firebaseService.isConfigured() && firebaseService.getFirestoreDb() !== null;
  },

  /**
   * 指定したしおりをFirestoreに保存・更新
   */
  async saveTripToCloud(trip: Trip): Promise<boolean> {
    const db = firebaseService.getFirestoreDb();
    if (!db || !trip.id) return false;

    try {
      const tripRef = doc(db, COLLECTION_NAME, trip.id);
      const cleanData = sanitizeForFirestore({
        ...trip,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(tripRef, cleanData, { merge: true });
      return true;
    } catch (e) {
      console.error(`Failed to save trip ${trip.id} to Firestore:`, e);
      return false;
    }
  },

  /**
   * 指定したしおりをFirestoreから削除
   */
  async deleteTripFromCloud(tripId: string): Promise<boolean> {
    const db = firebaseService.getFirestoreDb();
    if (!db || !tripId) return false;

    try {
      const tripRef = doc(db, COLLECTION_NAME, tripId);
      await deleteDoc(tripRef);
      return true;
    } catch (e) {
      console.error(`Failed to delete trip ${tripId} from Firestore:`, e);
      return false;
    }
  },

  /**
   * 指定したしおりをFirestoreから1回取得
   */
  async fetchTripFromCloud(tripId: string): Promise<Trip | null> {
    const db = firebaseService.getFirestoreDb();
    if (!db || !tripId) return null;

    try {
      const tripRef = doc(db, COLLECTION_NAME, tripId);
      const snapshot = await getDoc(tripRef);
      if (snapshot.exists()) {
        return snapshot.data() as Trip;
      }
      return null;
    } catch (e) {
      console.error(`Failed to fetch trip ${tripId} from Firestore:`, e);
      return null;
    }
  },

  /**
   * 全てのしおりをFirestoreから取得
   */
  async fetchAllTripsFromCloud(): Promise<Trip[]> {
    const db = firebaseService.getFirestoreDb();
    if (!db) return [];

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(colRef);
      const trips: Trip[] = [];
      snapshot.forEach((d) => {
        if (d.exists()) {
          trips.push(d.data() as Trip);
        }
      });
      return trips;
    } catch (e) {
      console.error('Failed to fetch all trips from Firestore:', e);
      return [];
    }
  },

  /**
   * 特定のしおりのリアルタイム自動同期（onSnapshotリスナー）を開始
   * @param tripId 対象のしおりID
   * @param onUpdate リモートで更新があった際のコールバック
   * @param onError エラー時のコールバック
   * @returns リスナー解除関数（Unsubscribe）
   */
  subscribeTrip(
    tripId: string,
    onUpdate: (trip: Trip) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    const db = firebaseService.getFirestoreDb();
    if (!db || !tripId) {
      return () => {};
    }

    const tripRef = doc(db, COLLECTION_NAME, tripId);
    return onSnapshot(
      tripRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (snapshot.exists()) {
          const tripData = snapshot.data() as Trip;
          onUpdate(tripData);
        }
      },
      (error) => {
        console.error(`Firestore realtime sync error for trip ${tripId}:`, error);
        if (onError) onError(error);
      }
    );
  },
};
