import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonIcon, IonItem, IonText } from '@ionic/angular/standalone';

import { Message } from '../../models/message.model';

export type ChatMessageStatus = 'sent' | 'read' | null;

export interface ChatMessageItemViewModel extends Message {
  senderDisplayName: string;
  senderPhotoURL: string | null;
  senderInitials: string;
}

@Component({
  selector: 'app-chat-message-item',
  standalone: true,
  imports: [
    DatePipe,
    IonButton,
    IonCard,
    IonCardContent,
    IonIcon,
    IonItem,
    IonText,
  ],
  templateUrl: './chat-message-item.html',
  styleUrl: './chat-message-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageItem {
  @Input({ required: true }) message!: ChatMessageItemViewModel;
  @Input() currentUserId = '';
  @Input() showAvatar = false;
  @Input() isOwn = false;
  @Input() isPending = false;
  @Input() status: ChatMessageStatus = null;
  @Input() isSystem = false;
  @Input() isMenuOpen = false;

  @Input() sentStatusIcon: unknown;
  @Input() sendingStatusIcon: unknown;
  @Input() menuChevronUpIcon: unknown;
  @Input() menuChevronDownIcon: unknown;
  @Input() showSenderName = true;

  @Output() toggleMenu = new EventEmitter<string>();
  @Output() deleteMessageClicked = new EventEmitter<Message>();

  onToggleMenu(): void {
    if (!this.message?.id) {
      return;
    }

    this.toggleMenu.emit(this.message.id);
  }

  onDeleteMessage(): void {
    this.deleteMessageClicked.emit(this.message);
  }
}