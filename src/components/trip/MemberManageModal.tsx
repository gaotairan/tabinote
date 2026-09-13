import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Mail,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { MemberAvatar } from '../common/MemberAvatar';
import { AvatarPicker } from '../common/AvatarPicker';
import type { Trip, Member } from '../../types/trip';
import { shareService } from '../../services/shareService';
import './MemberManageModal.css';

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#ec4899', // pink
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#6366f1', // indigo
];

interface MemberManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const MemberManageModal: React.FC<MemberManageModalProps> = ({
  isOpen,
  onClose,
  trip,
  onUpdateTrip,
}) => {
  // 新規追加フォームのState
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [avatarColor, setAvatarColor] = useState(COLOR_PRESETS[0]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // 編集中のメンバー
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editColor, setEditColor] = useState(COLOR_PRESETS[0]);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | undefined>(undefined);

  // アラートやメッセージ
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // 共有URL
  const shareUrl = React.useMemo(() => {
    try {
      return shareService.generateShareUrl(trip);
    } catch {
      return window.location.href;
    }
  }, [trip]);

  // メンバー追加処理
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('メンバーのお名前を入力してください');
      return;
    }

    const newMember: Member = {
      id: 'm-' + Date.now(),
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      avatarColor,
      avatarUrl: avatarUrl ? avatarUrl.trim() : undefined,
    };

    const updatedMembers = [...trip.members, newMember];
    onUpdateTrip({
      ...trip,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });

    // フォームリセット
    setName('');
    setRole('');
    setEmail('');
    setAvatarUrl(undefined);
    setAvatarColor(COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]);
    setErrorMsg(null);
  };

  // 編集開始
  const startEdit = (m: Member) => {
    setEditingMemberId(m.id);
    setEditName(m.name);
    setEditRole(m.role || '');
    setEditEmail(m.email || '');
    setEditColor(m.avatarColor);
    setEditAvatarUrl(m.avatarUrl);
    setErrorMsg(null);
  };

  // 編集保存
  const saveEdit = (memberId: string) => {
    if (!editName.trim()) {
      setErrorMsg('名前は必須です');
      return;
    }

    const updatedMembers = trip.members.map((m) => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        name: editName.trim(),
        role: editRole.trim() || undefined,
        email: editEmail.trim() || undefined,
        avatarColor: editColor,
        avatarUrl: editAvatarUrl ? editAvatarUrl.trim() : undefined,
      };
    });

    onUpdateTrip({
      ...trip,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });

    setEditingMemberId(null);
    setErrorMsg(null);
  };

  // メンバー削除処理
  const handleDeleteMember = (memberId: string, memberName: string) => {
    if (trip.members.length <= 1) {
      alert('最低1人のメンバーが必要です');
      return;
    }

    if (!window.confirm(`「${memberName}」を参加メンバーから削除しますか？\n※持ち物や割り勘の担当設定も自動で調整されます。`)) {
      return;
    }

    const nextMembers = trip.members.filter((m) => m.id !== memberId);

    // 持ち物リストで担当者だった場合は 'all' に戻す
    const nextPacking = trip.packingList.map((p) => {
      if (p.assignedMemberId === memberId) {
        return { ...p, assignedMemberId: 'all' };
      }
      return p;
    });

    // 割り勘で payerId だった場合は残った先頭メンバーに交代、targetMemberIds から除外
    const fallbackPayerId = nextMembers[0]?.id || '';
    const nextExpenses = trip.expenses.map((exp) => {
      let newPayer = exp.payerId === memberId ? fallbackPayerId : exp.payerId;
      let newTargets = (exp.targetMemberIds || []).filter((id) => id !== memberId);
      if (newTargets.length === 0 && nextMembers.length > 0) {
        newTargets = nextMembers.map((m) => m.id);
      }
      return {
        ...exp,
        payerId: newPayer,
        targetMemberIds: newTargets,
      };
    });

    onUpdateTrip({
      ...trip,
      members: nextMembers,
      packingList: nextPacking,
      expenses: nextExpenses,
      updatedAt: new Date().toISOString(),
    });

    if (editingMemberId === memberId) {
      setEditingMemberId(null);
    }
  };

  // メール送信用テキスト作成
  const createEmailBody = (memberName?: string) => {
    return (
      `${memberName ? `${memberName} さん\n\n` : ''}` +
      `旅のしおり「${trip.title}」を共有します！\n\n` +
      `日程: ${trip.startDate} 〜 ${trip.endDate}\n` +
      `目的地: ${trip.destination}\n\n` +
      `▼ しおりを開く（スマホで開くと自動保存・オフライン閲覧可能）:\n` +
      `${shareUrl}\n\n` +
      `${trip.password ? `旅の合言葉: ${trip.password}\n` : ''}` +
      `${trip.memo ? `【メモ・連絡先】\n${trip.memo}\n` : ''}` +
      `みんなで最高の旅にしましょう！✨`
    );
  };

  // メールアプリ起動
  const handleOpenMailApp = (targetEmail: string, memberName?: string) => {
    const subject = encodeURIComponent(`【旅のしおり】${trip.title}`);
    const body = encodeURIComponent(createEmailBody(memberName));
    window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
  };

  // Gmail Web起動
  const handleOpenGmail = (targetEmail: string, memberName?: string) => {
    const subject = encodeURIComponent(`【旅のしおり】${trip.title}`);
    const body = encodeURIComponent(createEmailBody(memberName));
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${subject}&body=${body}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // メールアドレスコピー
  const handleCopyEmail = (emailAddress: string) => {
    navigator.clipboard.writeText(emailAddress);
    setCopiedEmail(emailAddress);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="参加メンバーの管理・メール送信"
      maxWidth="620px"
    >
      <div className="member-manage-modal">
        {errorMsg && (
          <div className="manage-alert-banner">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 登録済みメンバーリスト */}
        <div className="member-list-section">
          <div className="section-header-row">
            <h4 className="section-subtitle">
              <Users size={16} />
              <span>参加中のメンバー ({trip.members.length}名)</span>
            </h4>
            <span className="section-hint">追加・削除・編集・メール送信が可能</span>
          </div>

          <div className="member-cards-scroll">
            {trip.members.map((m) => {
              const isEditing = editingMemberId === m.id;

              if (isEditing) {
                return (
                  <div key={m.id} className="member-edit-card slide-down">
                    <div className="edit-card-header">
                      <span className="edit-badge">メンバー情報を編集中</span>
                      <button
                        type="button"
                        className="btn-text-sm"
                        onClick={() => setEditingMemberId(null)}
                      >
                        キャンセル
                      </button>
                    </div>

                    <div className="edit-form-grid">
                      <div className="form-group">
                        <label className="form-label-sm">お名前 *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="名前"
                          autoFocus
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label-sm">役割・係</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          placeholder="例: カメラ係, 会計"
                        />
                      </div>

                      <div className="form-group full-width">
                        <label className="form-label-sm">メールアドレス（しおり送信用）</label>
                        <input
                          type="email"
                          className="form-input"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="member@example.com"
                        />
                      </div>

                      <div className="form-group full-width">
                        <AvatarPicker
                          name={editName || m.name}
                          avatarColor={editColor}
                          avatarUrl={editAvatarUrl}
                          onChangeColor={setEditColor}
                          onChangeAvatarUrl={setEditAvatarUrl}
                          colorPresets={COLOR_PRESETS}
                        />
                      </div>
                    </div>

                    <div className="edit-actions-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => saveEdit(m.id)}
                      >
                        <Check size={14} />
                        <span>保存する</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={m.id} className="member-row-item">
                  <div className="member-avatar-col">
                    <MemberAvatar
                      name={m.name}
                      avatarColor={m.avatarColor}
                      avatarUrl={m.avatarUrl}
                      size="lg"
                    />
                  </div>

                  <div className="member-info-col">
                    <div className="member-name-line">
                      <span className="member-fullname">{m.name}</span>
                      {m.role && <span className="member-role-tag">{m.role}</span>}
                    </div>

                    <div className="member-email-line">
                      {m.email ? (
                        <div className="email-display">
                          <Mail size={12} className="email-icon" />
                          <span className="email-text">{m.email}</span>
                          <button
                            type="button"
                            className="btn-icon-subtle"
                            onClick={() => handleCopyEmail(m.email!)}
                            title="メールアドレスをコピー"
                          >
                            {copiedEmail === m.email ? (
                              <Check size={12} color="#10b981" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="email-empty-tag">メール未設定</span>
                      )}
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="member-actions-col">
                    {/* メール送信クイックメニュー */}
                    {m.email ? (
                      <div className="email-action-group">
                        <button
                          type="button"
                          className="btn-action-primary"
                          onClick={() => handleOpenMailApp(m.email!, m.name)}
                          title="メーラーでしおりURLを送信"
                        >
                          <Mail size={13} />
                          <span>メール送信</span>
                        </button>
                        <button
                          type="button"
                          className="btn-action-secondary"
                          onClick={() => handleOpenGmail(m.email!, m.name)}
                          title="Gmailで新規作成して開く"
                        >
                          <ExternalLink size={12} />
                          <span>Gmail</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-action-outline"
                        onClick={() => startEdit(m)}
                        title="メールアドレスを登録"
                      >
                        <Mail size={13} />
                        <span>メール登録</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={() => startEdit(m)}
                      title="メンバー情報を編集"
                      aria-label="編集"
                    >
                      <Edit2 size={15} />
                    </button>

                    <button
                      type="button"
                      className="btn-icon-action danger"
                      onClick={() => handleDeleteMember(m.id, m.name)}
                      disabled={trip.members.length <= 1}
                      title={
                        trip.members.length <= 1
                          ? '最低1名のメンバーが必要です'
                          : 'メンバーを削除'
                      }
                      aria-label="削除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 新規メンバー追加フォーム */}
        <form onSubmit={handleAddMember} className="add-member-card">
          <div className="add-member-header">
            <div className="badge-icon-title">
              <Plus size={16} />
              <span>新しいメンバーを追加</span>
            </div>
            <span className="add-hint">名前を入れてすぐに追加できます</span>
          </div>

          <div className="add-member-grid">
            <div className="form-group">
              <label className="form-label-sm">お名前 <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="例: はなこ"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label-sm">役割・係</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: カメラ係, 会計"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div className="form-group full-width">
              <label className="form-label-sm">メールアドレス（任意・しおり送信先）</label>
              <input
                type="email"
                className="form-input"
                placeholder="hanako@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group full-width">
              <AvatarPicker
                name={name || '新規'}
                avatarColor={avatarColor}
                avatarUrl={avatarUrl}
                onChangeColor={setAvatarColor}
                onChangeAvatarUrl={setAvatarUrl}
                colorPresets={COLOR_PRESETS}
              />
            </div>
          </div>

          <div className="add-submit-row">
            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              <span>メンバーを追加する</span>
            </button>
          </div>
        </form>

        {/* メール送信の案内ヒント */}
        <div className="email-feature-tip">
          <Sparkles size={15} className="tip-icon" />
          <div className="tip-content">
            <strong>しおりURLのメール送信について</strong>
            <p>
              メールアドレスを登録しておくと、ワンクリックで相手宛ての共有メールを作成できます。相手はメール内のURLをタップするだけで、ログイン不要でしおりを閲覧・保存できます。
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
