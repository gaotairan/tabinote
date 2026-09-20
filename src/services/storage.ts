import type { Trip } from '../types/trip';
import { SAMPLE_TRIP } from '../mock/sampleTrip';

const STORAGE_KEY_TRIPS = 'tabiori_trips_v1';
const STORAGE_KEY_ACTIVE_ID = 'tabiori_active_trip_id_v1';
const STORAGE_KEY_GOOGLE_CLIENT_ID = 'tabiori_google_client_id_v1';
const STORAGE_KEY_DELETED_IDS = 'tabiori_deleted_trip_ids_v1';

export const storageService = {
  getDeletedTripIds(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  markTripAsDeleted(id: string): void {
    try {
      const ids = this.getDeletedTripIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(ids));
      }
    } catch (e) {
      console.error('Failed to record deleted trip id:', e);
    }
  },

  unmarkTripAsDeleted(id: string): void {
    try {
      const ids = this.getDeletedTripIds().filter((dId) => dId !== id);
      localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(ids));
    } catch (e) {
      console.error('Failed to unmark deleted trip id:', e);
    }
  },

  getTrips(): Trip[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_TRIPS);
      if (!data) {
        // 初回ロード時はサンプルしおりをセット
        this.saveTrips([SAMPLE_TRIP]);
        return [SAMPLE_TRIP];
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load trips from storage:', e);
      return [SAMPLE_TRIP];
    }
  },

  saveTrips(trips: Trip[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(trips));
    } catch (e) {
      console.error('Failed to save trips to storage:', e);
    }
  },

  getTripById(id: string): Trip | undefined {
    const trips = this.getTrips();
    return trips.find((t) => t.id === id);
  },

  saveTrip(trip: Trip): void {
    this.unmarkTripAsDeleted(trip.id);
    const trips = this.getTrips();
    const index = trips.findIndex((t) => t.id === trip.id);
    const updatedTrip = {
      ...trip,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      trips[index] = updatedTrip;
    } else {
      trips.unshift(updatedTrip);
    }
    this.saveTrips(trips);
  },

  deleteTrip(id: string): void {
    this.markTripAsDeleted(id);
    const trips = this.getTrips().filter((t) => t.id !== id);
    this.saveTrips(trips);
    if (this.getActiveTripId() === id) {
      this.setActiveTripId(trips.length > 0 ? trips[0].id : null);
    }
  },

  getActiveTripId(): string | null {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  },

  setActiveTripId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
    }
  },

  getGoogleClientId(): string {
    return localStorage.getItem(STORAGE_KEY_GOOGLE_CLIENT_ID) || '';
  },

  setGoogleClientId(clientId: string): void {
    localStorage.setItem(STORAGE_KEY_GOOGLE_CLIENT_ID, clientId);
  },

  exportTripAsJson(trip: Trip): string {
    return JSON.stringify(trip, null, 2);
  },

  importTripFromJson(jsonString: string): Trip {
    const trip = JSON.parse(jsonString) as Trip;
    if (!trip.title || !trip.startDate || !trip.days) {
      throw new Error('有効なしおりデータ形式ではありません');
    }
    // IDが被らないように新規IDを割り振る
    trip.id = 'trip-' + Date.now();
    trip.createdAt = new Date().toISOString();
    trip.updatedAt = new Date().toISOString();
    this.saveTrip(trip);
    return trip;
  },
};
