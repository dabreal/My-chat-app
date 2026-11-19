import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { Conversation, UserConversation } from '../../models/conversation.model';
import { UserProfile } from '../../../users/models/user-profile.model';

@Component({
  selector: 'app-chat-thread-header',
  standalone: true,
  imports: [
    AsyncPipe,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './chat-thread-header.html',
  styleUrl: './chat-thread-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatThreadHeaderComponent {
  @Input() selectedConversation: UserConversation | null = null;
  @Input() selectedConversationDetails: Conversation | null = null;
  @Input() otherUser: UserProfile | null = null;

  @Output() openConversationInfoModalClicked = new EventEmitter<void>();
  @Output() logoutClicked = new EventEmitter<void>();

  openConversationInfoModal(): void {
    this.openConversationInfoModalClicked.emit();
  }

  logout(): void {
    this.logoutClicked.emit();
  }

  getUserInitials(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      return 'U';
    }

    const parts = normalized.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  }
}