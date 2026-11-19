import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonList,
  IonText,
} from '@ionic/angular/standalone';
import type { InfiniteScrollCustomEvent } from '@ionic/angular';

import { Message } from '../../models/message.model';
import {
  ChatMessageItem,
  ChatMessageItemViewModel,
  ChatMessageStatus,
} from '../chat-message-item/chat-message-item';

@Component({
  selector: 'app-chat-message-list',
  standalone: true,
  imports: [
    IonCard,
    IonCardContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonText,
    ChatMessageItem,
  ],
  templateUrl: './message-list.html',
  styleUrl: './message-list.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ChatMessageListComponent {
  @Input() messages: ChatMessageItemViewModel[] = [];
  @Input() currentUserId = '';
  @Input() isGroupConversation = false;
  @Input() groupMemberReadStates: Map<string, number> = new Map<string, number>();
  @Input() hasMoreMessages = true;

  @Input() sentStatusIcon: unknown;
  @Input() sendingStatusIcon: unknown;
  @Input() menuChevronUpIcon: unknown;
  @Input() menuChevronDownIcon: unknown;
  @Input() locationIcon: unknown;

  @Input({ required: true }) isOwnMessage!: (message: Message, currentUserId?: string) => boolean;
  @Input({ required: true }) isPendingMessage!: (message: Message, currentUserId?: string) => boolean;
  @Input({ required: true }) getMessageStatus!: (
    message: Message,
    currentUserId?: string,
    conversationType?: 'direct' | 'group',
    groupMemberReadStates?: Map<string, number>,
  ) => ChatMessageStatus;
  @Input({ required: true }) shouldShowMessageAvatar!: (messages: Message[], index: number) => boolean;
  @Input({ required: true }) isSystemMessage!: (message: Message) => boolean;
  @Input({ required: true }) isMessageMenuOpen!: (messageId: string) => boolean;
  @Input({ required: true }) trackByMessage!: (index: number, message: Message) => string;

  @Output() loadOlderMessages = new EventEmitter<InfiniteScrollCustomEvent>();
  @Output() toggleMessageMenu = new EventEmitter<string>();
  @Output() deleteMessage = new EventEmitter<Message>();

  onLoadOlderMessages(event: Event): void {
    this.loadOlderMessages.emit(event as InfiniteScrollCustomEvent);
  }

  onToggleMessageMenu(messageId: string): void {
    this.toggleMessageMenu.emit(messageId);
  }

  onDeleteMessage(message: Message): void {
    this.deleteMessage.emit(message);
  }

  resolveStatus(message: Message): ChatMessageStatus {
    return this.getMessageStatus(
      message,
      this.currentUserId,
      this.isGroupConversation ? 'group' : 'direct',
      this.groupMemberReadStates,
    );
  }

  shouldShowSenderName(messages: Message[], index: number): boolean {
    const currentMessage = messages[index];
    if (!currentMessage || this.isSystemMessage(currentMessage)) {
      return false;
    }

    if (index === 0) {
      return true;
    }

    const previousMessage = messages[index - 1];
    if (!previousMessage || this.isSystemMessage(previousMessage)) {
      return true;
    }

    return previousMessage.senderId !== currentMessage.senderId;
  }
}