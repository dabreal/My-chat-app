import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import {
  IonButton,
  IonFooter,
  IonInput,
  IonItem,
  IonIcon,
  IonToolbar,
} from '@ionic/angular/standalone';

import { UserConversation } from '../../models/conversation.model';

@Component({
  selector: 'app-chat-message-composer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonFooter,
    IonInput,
    IonIcon,
    IonItem,
    IonToolbar,
  ],
  templateUrl: './message-composer.html',
  styleUrl: './message-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageComposer {
  @Input() selectedConversation: UserConversation | null = null;
  @Input({ required: true }) messageInput!: FormControl<string>;
  @Input() isSending = false;
  @Input() locationIcon: unknown;

  @Output() sendMessageClicked = new EventEmitter<void>();
  @Output() sendLocationClicked = new EventEmitter<void>();

  sendLocation(): void {
    this.sendLocationClicked.emit();
  }

  sendMessage(): void {
    this.sendMessageClicked.emit();
  }
}