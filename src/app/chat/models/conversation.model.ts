export type ConversationType = 'direct' | 'group';
export type ConversationMemberRole = 'owner' | 'admin' | 'member';
export type ConversationMessageType = 'text' | 'system' | 'location';

export interface Conversation {
  id: string;
  type: ConversationType;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  title: string;
  description: string;
  photoURL: string;
  memberIds: Record<string, boolean>;
  memberNames: Record<string, string>;
  membersCount: number;
}

export interface ConversationMember {
  uid: string;
  displayName: string;
  role: ConversationMemberRole;
  joinedAt: number;
  addedBy: string;
  canSeeHistoryFrom: number;
  removedAt?: number;
  removedBy?: string;
}

export interface UserConversation {
  conversationId: string;
  type: ConversationType;
  title: string;
  subtitle: string;
  photoURL: string;
  updatedAt: number;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderId: string;
  unreadCount: number;
  lastReadAt?: number;
  otherUserId?: string;
  otherUserName?: string;
  otherUserPhotoURL?: string | null;
  isGroup: boolean;
}

export interface ConversationMessage {
  id?: string;
  type: ConversationMessageType;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}