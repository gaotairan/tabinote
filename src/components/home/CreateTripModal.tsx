import React, { useState } from 'react';
import {
  Sparkles,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import type { Trip, Member } from '../../types/trip';
import { PRESET_COVERS } from '../../mock/sampleTrip';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { TIMEZONE_PRESETS, inferTimeZone } from '../../utils/timezone';
import { MemberAvatar } from '../common/MemberAvatar';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTrip: (trip: Trip) => void;
  initialTrip?: Trip | null;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  onSaveTrip,
  initialTrip,
}) => {
  const [title, setTitle] = useState(initialTrip?.title || '');
  const [subtitle, setSubtitle] = useState(initialTrip?.subtitle || '');
  const [destination, setDestination] = useState(initialTrip?.destination || '');
  const [timeZoneOffset, setTimeZoneOffset] = useState<number>(
    initialTrip?.timeZoneOffset ?? 0
  );
  const [timeZoneName, setTimeZoneName] = useState<string>(
    initialTrip?.timeZoneName || ''
  );
  const [startDate, setStartDate] = useState(
    initialTrip?.startDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(() => {
    if (initialTrip?.endDate) return initialTrip.endDate;
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return format(d, 'yyyy-MM-dd');
  });
  const [selectedCover, setSelectedCover] = useState(
    initialTrip?.coverImage || PRESET_COVERS[0].url
  );
  const [themeColor, setThemeColor] = useState(initialTrip?.themeColor || '#2563eb');
  const [password, setPassword] = useState(initialTrip?.password || '');
  const [memo, setMemo] = useState(initialTrip?.memo || '');

  const [members, setMembers] = useState<Member[]>(
    initialTrip?.members || [
      { id: 'm1', name: '自分', avatarColor: '#3b82f6', role: 'リーダー' },
    ]
  );
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const [error, setError] = useState<string | null>(null);



  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    const colors = ['#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setMembers([
      ...members,
      {
        id: 'm-' + Date.now(),
        name: newMemberName.trim(),
        avatarColor: randomColor,
        role: newMemberRole.trim() || undefined,
        email: newMemberEmail.trim() || undefined,
      },
    ]);
    setNewMemberName('');
    setNewMemberRole('');
    setNewMemberEmail('');
  };

  const handleRemoveMember = (id: string) => {
    if (members.length <= 1) {
      alert('最低1人のメンバーが必要です');
      return;
    }
    setMembers(members.filter((m) => m.id !== id));
  };

  const handleDestinationChange = (val: string) => {
    setDestination(val);
    if (!initialTrip) {
      const inferred = inferTimeZone(val);
      if (inferred) {
        setTimeZoneOffset(inferred.offset);
        setTimeZoneName(inferred.name);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('旅行タイトルを入力してください');
      return;
    }
    if (!destination.trim()) {
      setError('目的地を入力してください');
      return;
    }
    if (startDate > endDate) {
      setError('終了日は開始日以降の日付を指定してください');
      return;
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysCount = Math.max(1, differenceInCalendarDays(end, start) + 1);

    // 新規作成時は日別スケジュールを生成
    let days = initialTrip?.days || [];
    if (!initialTrip || days.length === 0) {
      days = [];
      for (let i = 0; i < daysCount; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = format(d, 'yyyy-MM-dd');
        days.push({
          dayNumber: i + 1,
          date: dateStr,
          title: `${i + 1}日目`,
          items: [],
        });
      }
    }

    const trip: Trip = {
      id: initialTrip?.id || 'trip-' + Date.now(),
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      destination: destination.trim(),
      startDate,
      endDate,
      coverImage: selectedCover,
      themeColor,
      password: password.trim() || undefined,
      memo: memo.trim() || undefined,
      members,
      days,
      packingList: initialTrip?.packingList || [
        { id: 'p1', name: 'スマートフォン・充電器', category: 'electronics', isChecked: false, assignedMemberId: 'all' },
        { id: 'p2', name: '身分証・保険証', category: 'essential', isChecked: false, assignedMemberId: 'all' },
        { id: 'p3', name: '着替え・下着', category: 'clothes', isChecked: false, assignedMemberId: 'all' },
      ],
      souvenirs: initialTrip?.souvenirs || [],
      expenses: initialTrip?.expenses || [],
      timeZoneOffset,
      timeZoneName: timeZoneName || undefined,
      createdAt: initialTrip?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveTrip(trip);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialTrip ? '旅のしおりを編集' : '新しい旅のしおりを作成'}
      maxWidth="600px"
    >
      <form onSubmit={handleSubmit} className="fade-in">
        {error && <div className="import-error-banner" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="form-group">
          <label>旅行タイトル *</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: バルセロナ満喫 5日間の旅 ✈️"
            required
          />
        </div>

        <div className="form-group">
          <label>サブタイトル・キャッチコピー</label>
          <input
            type="text"
            className="form-input"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="例: サグラダファミリアと美食の旅"
          />
        </div>

        <div className="form-group">
          <label>目的地 *</label>
          <div className="input-with-icon">
            <MapPin size={16} className="input-icon" />
            <input
              type="text"
              className="form-input"
              value={destination}
              onChange={(e) => handleDestinationChange(e.target.value)}
              placeholder="例: スペイン・バルセロナ"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>旅行先の時差（タイムゾーン）</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {timeZoneOffset === 0 ? '時差なし (日本国内)' : `日本との時差: ${timeZoneOffset > 0 ? '+' : ''}${timeZoneOffset}h`}
            </span>
          </label>
          <select
            className="form-input"
            value={timeZoneOffset}
            onChange={(e) => {
              const off = parseFloat(e.target.value);
              setTimeZoneOffset(off);
              const found = TIMEZONE_PRESETS.find((p) => p.offset === off);
              if (found) setTimeZoneName(found.name);
            }}
          >
            {TIMEZONE_PRESETS.map((p) => (
              <option key={p.id} value={p.offset}>
                {p.flag} {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label>開始日 *</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group flex-1">
            <label>終了日 *</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* カバー写真選択 */}
        <div className="form-group">
          <label>カバー写真</label>
          <div className="cover-presets-grid">
            {PRESET_COVERS.map((preset) => (
              <div
                key={preset.id}
                className={`cover-preset-item ${selectedCover === preset.url ? 'active' : ''}`}
                style={{ backgroundImage: `url(${preset.url})` }}
                onClick={() => setSelectedCover(preset.url)}
              >
                <span className="preset-name">{preset.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 参加メンバー */}
        <div className="form-group">
          <label>参加メンバー</label>
          <div className="members-chips-list">
            {members.map((m) => (
              <div key={m.id} className="member-chip">
                <MemberAvatar
                  name={m.name}
                  avatarColor={m.avatarColor}
                  avatarUrl={m.avatarUrl}
                  size="xs"
                />
                <span className="member-name">{m.name}</span>
                {m.role && <span className="member-role">({m.role})</span>}
                {m.email && <span className="member-role" title={m.email}>✉</span>}
                <button
                  type="button"
                  className="chip-remove-btn"
                  onClick={() => handleRemoveMember(m.id)}
                  title="メンバーを削除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="add-member-inputs-stacked">
            <div className="add-member-row-top">
              <input
                type="text"
                className="form-input"
                placeholder="名前（例: はなこ）*"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder="役割（例: カメラ係）"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              />
            </div>
            <div className="add-member-row-bottom">
              <input
                type="email"
                className="form-input flex-1"
                placeholder="メール（例: hanako@example.com）"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddMember}
              >
                <Plus size={16} />
                <span>メンバー追加</span>
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label>旅の合言葉（パスワード）</label>
            <input
              type="text"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="例: kyoto2026"
            />
          </div>
          <div className="form-group flex-1">
            <label>テーマカラー</label>
            <input
              type="color"
              className="form-input"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              style={{ height: '42px', padding: '4px' }}
            />
          </div>
        </div>

        <div className="form-group">
          <label>メモ・緊急連絡先</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="ホテルの電話番号、新幹線の予約番号、注意点など"
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          <Sparkles size={18} />
          <span>{initialTrip ? 'しおりを更新する' : 'しおりを作成する！'}</span>
        </button>
      </form>
    </Modal>
  );
};
