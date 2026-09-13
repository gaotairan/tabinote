export type ScheduleCategory =
  | 'transport'
  | 'sightseeing'
  | 'food'
  | 'hotel'
  | 'activity'
  | 'other';

export type TransportType = 'train' | 'plane' | 'car' | 'bus' | 'walk' | 'ship';

export interface ScheduleItem {
  id: string;
  time: string; // "09:30"
  endTime?: string; // "11:00"
  title: string;
  category: ScheduleCategory;
  location?: string;
  locationUrl?: string; // Google Maps URL
  memo?: string;
  cost?: number;
  transportType?: TransportType;
}

export interface DaySchedule {
  dayNumber: number; // 1, 2, 3...
  date: string; // "2026-09-20"
  title?: string; // "京都到着〜祇園散策"
  items: ScheduleItem[];
}

export interface Member {
  id: string;
  name: string;
  avatarColor: string;
  role?: string; // "リーダー", "カメラ係", "会計" etc.
}

export type PackingCategory =
  | 'essential'
  | 'clothes'
  | 'electronics'
  | 'toiletries'
  | 'other';

export interface PackingItem {
  id: string;
  name: string;
  category: PackingCategory;
  isChecked: boolean;
  assignedMemberId?: string; // "all" or specific member id
}

export interface SouvenirItem {
  id: string;
  name: string;
  forWhom?: string; // "自分", "家族", "職場" etc.
  place?: string;
  isBought: boolean;
  price?: number;
  memo?: string;
}

export type ExpenseCategory =
  | 'transport'
  | 'food'
  | 'hotel'
  | 'ticket'
  | 'shopping'
  | 'other';

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  payerId: string; // Member ID who paid
  targetMemberIds: string[]; // Member IDs who split the bill
  date: string;
  category: ExpenseCategory;
  memo?: string;
}

export interface Trip {
  id: string;
  title: string;
  subtitle?: string;
  destination: string;
  startDate: string; // "2026-09-20"
  endDate: string; // "2026-09-22"
  coverImage: string; // URL or preset id
  themeColor: string; // HEX color
  members: Member[];
  password?: string;
  memo?: string;
  days: DaySchedule[];
  packingList: PackingItem[];
  souvenirs: SouvenirItem[];
  expenses: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
}

// 割り勘精算の計算結果型
export interface SettlementResult {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}
