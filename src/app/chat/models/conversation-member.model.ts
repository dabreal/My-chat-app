export interface ConversationMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  role: 'owner' | 'member';
}