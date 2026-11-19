import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { User } from '@angular/fire/auth';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { peopleOutline } from 'ionicons/icons';

import { UserConversation } from '../../models/conversation.model';

export interface ConversationWithAvatar extends UserConversation {
  avatarURL?: string | null;
  avatarInitials?: string;
}

@Component({
  selector: 'app-conversation-sidebar',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './conversation-sidebar.html',
  styleUrl: './conversation-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationSidebarComponent {
  @Input({ required: true }) conversations: ConversationWithAvatar[] = [];
  @Input({ required: true }) selectedConversationId = '';
  @Input() currentUser: User | null = null;
  @Input() openConversationMenuId: string | null = null;

  @Input() groupIcon = peopleOutline;
  @Input() menuChevronDownIcon!: string;
  @Input() menuChevronUpIcon!: string;

  @Output() openConversationClicked = new EventEmitter<string>();
  @Output() toggleConversationMenuClicked = new EventEmitter<string>();
  @Output() deleteConversationClicked = new EventEmitter<UserConversation>();
  @Output() goToProfileClicked = new EventEmitter<void>();

  openConversation(conversationId: string): void {
    this.openConversationClicked.emit(conversationId);
  }

  toggleConversationMenu(conversationId: string): void {
    this.toggleConversationMenuClicked.emit(conversationId);
  }

  deleteConversation(conversation: UserConversation): void {
    this.deleteConversationClicked.emit(conversation);
  }

  goToProfile(): void {
    this.goToProfileClicked.emit();
  }

  isSelectedConversation(conversationId: string, selectedConversationId: string): boolean {
    return conversationId === selectedConversationId;
  }

  isConversationMenuOpen(conversationId: string): boolean {
    return this.openConversationMenuId === conversationId;
  }

  getUserInitials(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      return 'U';
    }

    const parts = normalized.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  }

  trackByConversation(index: number, conversation: UserConversation): string {
    return conversation.conversationId ?? String(index);
  }
}