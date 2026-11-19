import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
  IonCheckbox,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';
import { combineLatest, firstValueFrom, map, filter } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../auth/services/auth.service';
import { UsersService } from '../../../users/services/users.service';
import { UserProfile } from '../../../users/models/user-profile.model';
import { ConversationsService } from '../../services/conversations.service';
import { MessagesService } from '../../services/messages.service';

type CreationMode = 'private' | 'group';

@Component({
  selector: 'app-new-conversation-page',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonRadioGroup,
    IonRadio,
    IonText,
    IonIcon,
    IonInput,
    IonCheckbox,
  ],
  templateUrl: './new-conversation-page.html',
  styleUrl: './new-conversation-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewConversationPage {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly conversationsService = inject(ConversationsService);
  private readonly messagesService = inject(MessagesService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly personIcon = personOutline;
  readonly groupIcon = peopleOutline;
  readonly emptyIcon = chatbubbleEllipsesOutline;

  mode: CreationMode | null = null;
  selectedUserId = '';
  errorMessage = '';
  isCreating = false;

  readonly users$ = combineLatest([
    this.usersService.getActiveUsers(),
    this.authService.currentUser$,
  ]).pipe(
    map(([users, currentUser]) =>
      users.filter((user) => user.uid !== currentUser?.uid),
    ),
  );

  readonly groupForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', [Validators.maxLength(180)]],
  });

  selectedGroupMemberIds: string[] = [];

  constructor() {
    addIcons({
      chatbubbleEllipsesOutline,
      peopleOutline,
      personOutline,
    });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        // Always reset state on navigation
        this.resetState();

        const mode = params.get('mode');

        if (mode === 'private' || mode === 'group') {
          this.setMode(mode);
          return;
        }

        this.mode = null;
      });

    // Also reset when the activated route's URL changes (covers router reuse cases)
    this.route.url.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.resetState();
    });

    // Also reset state when the router navigates to /chat/new (component may be reused)
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        if (ev.urlAfterRedirects?.startsWith('/chat/new') || ev.url?.startsWith('/chat/new')) {
          this.resetState();
        }
      });
  }

  private resetState(): void {
    this.mode = null;
    this.selectedUserId = '';
    this.selectedGroupMemberIds = [];
    this.errorMessage = '';
    this.isCreating = false;
    this.groupForm.reset({
      title: '',
      description: '',
    });
  }

  setMode(mode: CreationMode): void {
    this.mode = mode;
    this.errorMessage = '';
  }

  onPrivateUserChange(event: CustomEvent): void {
    this.selectedUserId = event.detail.value ?? '';
    this.errorMessage = '';
  }

  onGroupMemberChange(event: CustomEvent, userId: string): void {
    const checked = !!event.detail.checked;

    if (checked) {
      if (!this.selectedGroupMemberIds.includes(userId)) {
        this.selectedGroupMemberIds = [...this.selectedGroupMemberIds, userId];
      }
    } else {
      this.selectedGroupMemberIds = this.selectedGroupMemberIds.filter(
        (id) => id !== userId,
      );
    }

    this.errorMessage = '';
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedGroupMemberIds.includes(userId);
  }

  async createConversation(): Promise<void> {
    if (this.isCreating || !this.selectedUserId) return;

    this.errorMessage = '';
    this.isCreating = true;

    try {
      const firebaseUser = await firstValueFrom(this.authService.currentUser$);

      if (!firebaseUser) {
        throw new Error('No hay un usuario autenticado.');
      }

      const currentUserProfile = await this.usersService.getUserById(firebaseUser.uid);

      if (!currentUserProfile) {
        throw new Error('No se ha encontrado el perfil del usuario actual.');
      }

      const otherUserProfile = await this.usersService.getUserById(this.selectedUserId);

      if (!otherUserProfile) {
        throw new Error('No se ha encontrado el usuario seleccionado.');
      }

      const conversationId =
        await this.conversationsService.createPrivateConversation({
          currentUserId: currentUserProfile.uid,
          currentUserName: currentUserProfile.displayName,
          otherUserId: otherUserProfile.uid,
          otherUserName: otherUserProfile.displayName,
        });

      await this.router.navigate(['/chat', conversationId]);
    } catch (error) {
      console.error('Error al crear conversación:', error);
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No se ha podido crear la conversación.';
    } finally {
      this.isCreating = false;
    }
  }

  async createGroup(): Promise<void> {
    if (this.isCreating) return;

    this.groupForm.markAllAsTouched();

    if (this.groupForm.invalid) {
      this.errorMessage = 'Completa el nombre del grupo correctamente.';
      return;
    }

    if (this.selectedGroupMemberIds.length === 0) {
      this.errorMessage = 'Selecciona al menos un miembro para el grupo.';
      return;
    }

    this.errorMessage = '';
    this.isCreating = true;

    try {
      const firebaseUser = await firstValueFrom(this.authService.currentUser$);

      if (!firebaseUser) {
        throw new Error('No hay un usuario autenticado.');
      }

      const currentUserProfile = await this.usersService.getUserById(firebaseUser.uid);

      if (!currentUserProfile) {
        throw new Error('No se ha encontrado el perfil del usuario actual.');
      }

      const allUsers = await firstValueFrom(this.users$);

      const selectedUsers = allUsers
        .filter((user) => this.selectedGroupMemberIds.includes(user.uid))
        .map((user: UserProfile) => ({
          uid: user.uid,
          displayName: user.displayName,
        }));

      if (selectedUsers.length === 0) {
        throw new Error('No se han podido resolver los miembros seleccionados.');
      }

      const conversationId =
        await this.conversationsService.createGroupConversation({
          currentUserId: currentUserProfile.uid,
          currentUserName: currentUserProfile.displayName,
          title: this.groupForm.getRawValue().title.trim(),
          description: this.groupForm.getRawValue().description.trim(),
          members: selectedUsers,
        });

      const systemMessageAt = Date.now();
      await this.messagesService.addSystemMessage({
        conversationId,
        senderId: currentUserProfile.uid,
        senderName: currentUserProfile.displayName,
        text: `${currentUserProfile.displayName} ha creado el grupo.`,
        createdAt: systemMessageAt,
      });

      await this.conversationsService.refreshConversationSummary({
        conversationId,
        lastMessageText: `${currentUserProfile.displayName} ha creado el grupo.`,
        lastMessageAt: systemMessageAt,
        lastSenderId: currentUserProfile.uid,
      });

      this.groupForm.reset({
        title: '',
        description: '',
      });
      this.selectedGroupMemberIds = [];

      await this.router.navigate(['/chat', conversationId]);
    } catch (error) {
      console.error('Error al crear grupo:', error);
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No se ha podido crear el grupo.';
    } finally {
      this.isCreating = false;
    }
  }
}
