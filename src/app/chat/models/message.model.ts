export type MessageType = 'text' | 'system' | 'location';

export interface Message {
  id?: string;
  type: MessageType;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
  readAt?: number;
  readBy?: string;
  isLocalOnly?: boolean;
}