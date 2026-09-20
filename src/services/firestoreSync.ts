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

  /**
   * ローカルのしおり群とクラウドのしおり群を双方向同期・マージする
   * - クラウドにあってローカルにないしおり（削除済みIDを除く）を復元
   * - ローカルにあってクラウドにないしおりをクラウドへ自動バックアップ
   * - 双方にあるしおりは updatedAt を比較して最新のものを採用
   * @param localTrips 現在のローカルしおり一覧
   * @param deletedIds 削除済みIDのリスト
   * @returns マージ後の最新しおり一覧、および新しく復元・更新された件数
   */
  async syncAllTripsWithCloud(
    localTrips: Trip[],
    deletedIds: string[] = []
  ): Promise<{ mergedTrips: Trip[]; addedCount: number; updatedCount: number }> {
    if (!this.isAvailable()) {
      return { mergedTrips: localTrips, addedCount: 0, updatedCount: 0 };
    }

    try {
      const cloudTrips = await this.fetchAllTripsFromCloud();
      if (!cloudTrips || cloudTrips.length === 0) {
        // クラウドが空の場合、ローカルのしおりをクラウドへ初期バックアップ
        for (const localTrip of localTrips) {
          if (!deletedIds.includes(localTrip.id)) {
            await this.saveTripToCloud(localTrip);
          }
        }
        return { mergedTrips: localTrips, addedCount: 0, updatedCount: 0 };
      }

      let addedCount = 0;
      let updatedCount = 0;
      const tripMap = new Map<string, Trip>();

      // まずローカルのしおりをマップに登録（削除済みは除外）
      for (const trip of localTrips) {
        if (!deletedIds.includes(trip.id)) {
          tripMap.set(trip.id, trip);
        }
      }

      // クラウドのしおりを検査してマージ
      for (const cloudTrip of cloudTrips) {
        // ユーザーがローカルで意図的に削除したものはスキップ
        if (deletedIds.includes(cloudTrip.id)) {
          continue;
        }

        const existingLocal = tripMap.get(cloudTrip.id);
        if (!existingLocal) {
          // ローカルに存在しないクラウドしおりを発見！取り込む
          tripMap.set(cloudTrip.id, cloudTrip);
          addedCount++;
        } else {
          // 両方に存在する場合、更新日時を比較
          const cloudTime = cloudTrip.updatedAt ? new Date(cloudTrip.updatedAt).getTime() : 0;
          const localTime = existingLocal.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;

          if (cloudTime > localTime) {
            // クラウドの方が新しい
            tripMap.set(cloudTrip.id, cloudTrip);
            updatedCount++;
          } else if (localTime > cloudTime) {
            // ローカルの方が新しい場合はクラウド側を最新化
            this.saveTripToCloud(existingLocal).catch(() => {});
          }
        }
      }

      // ローカルにしか存在しないしおりをクラウドへ自動バックアップ送信
      for (const localTrip of localTrips) {
        if (!deletedIds.includes(localTrip.id)) {
          const inCloud = cloudTrips.some((ct) => ct.id === localTrip.id);
          if (!inCloud) {
            this.saveTripToCloud(localTrip).catch(() => {});
          }
        }
      }

      const mergedTrips = Array.from(tripMap.values());
      // 作成日時/更新日時の新しい順にソート
      mergedTrips.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      return { mergedTrips, addedCount, updatedCount };
    } catch (e) {
      console.error('Failed to sync trips with cloud:', e);
      return { mergedTrips: localTrips, addedCount: 0, updatedCount: 0 };
    }
  },
};
