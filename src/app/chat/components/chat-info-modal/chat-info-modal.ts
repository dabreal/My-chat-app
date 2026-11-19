import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonToolbar,
} from '@ionic/angular/standalone';

import { Conversation, ConversationMember, UserConversation } from '../../models/conversation.model';
import { UserProfile } from '../../../users/models/user-profile.model';

@Component({
  selector: 'app-chat-info-modal',
  standalone: true,
  imports: [
    DatePipe,
    IonAvatar,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonChip,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonToolbar,
  ],
  templateUrl: './chat-info-modal.html',
  styleUrl: './chat-info-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInfoModal {
  @Input() conversationSummary: UserConversation | null = null;
  @Input() conversationDetails: Conversation | null = null;
  @Input() otherUser: UserProfile | null = null;
  @Input() members: ConversationMember[] = [];
  @Input() currentUserMember: ConversationMember | null = null;
  @Input() currentUserId = '';

  @Output() close = new EventEmitter<void>();
  @Output() editGroup = new EventEmitter<void>();
  @Output() addMembers = new EventEmitter<void>();
  @Output() deleteGroup = new EventEmitter<void>();
  @Output() toggleAdminRole = new EventEmitter<ConversationMember>();
  @Output() removeMember = new EventEmitter<ConversationMember>();

  get isGroupConversation(): boolean {
    return this.conversationSummary?.type === 'group' || this.conversationDetails?.type === 'group';
  }

  get displayName(): string {
    return (
      this.otherUser?.displayName ||
      this.conversationSummary?.otherUserName ||
      this.conversationSummary?.title ||
      this.conversationDetails?.title ||
      'Chat'
    );
  }

  get avatarUrl(): string {
    return (
      this.otherUser?.photoURL ||
      this.conversationSummary?.otherUserPhotoURL ||
      this.conversationSummary?.photoURL ||
      this.conversationDetails?.photoURL ||
      ''
    );
  }

  get groupMembers(): ConversationMember[] {
    return [...this.members]
      .filter((member) => !member.removedAt)
      .sort((a, b) => {
        const roleWeight = { owner: 0, admin: 1, member: 2 } as const;
        const byRole = roleWeight[a.role] - roleWeight[b.role];

        if (byRole !== 0) {
          return byRole;
        }

        return a.displayName.localeCompare(b.displayName);
      });
  }

  get canManageGroupView(): boolean {
    return (
      this.isGroupConversation &&
      (this.currentUserMember?.role === 'owner' || this.currentUserMember?.role === 'admin')
    );
  }

  get canEditRolesView(): boolean {
    return this.currentUserMember?.role === 'owner';
  }

  getMemberRoleLabel(role: ConversationMember['role']): string {
    switch (role) {
      case 'owner':
        return 'Creador';
      case 'admin':
        return 'Admin';
      default:
        return 'Miembro';
    }
  }

  getMemberRoleColor(role: ConversationMember['role']): string {
    switch (role) {
      case 'owner':
        return 'primary';
      case 'admin':
        return 'tertiary';
      default:
        return 'medium';
    }
  }

  getInitials(value: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return '?';
    }

    return trimmedValue
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
