import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSplitPane,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import type { InfiniteScrollCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  chevronDownOutline,
  chevronUpOutline,
  checkmarkDoneOutline,
  peopleOutline,
  pencilOutline,
  personAddOutline,
  personRemoveOutline,
  locationOutline,
  shieldCheckmarkOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  take,
  tap,
  from,
  Subject,
  Subscription,
  
} from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { UsersService } from '../../../users/services/users.service';
import { UserProfile } from '../../../users/models/user-profile.model';
import { Message } from '../../models/message.model';
import {
  Conversation,
  ConversationMember,
  UserConversation,
} from '../../models/conversation.model';
import { ChatInfoModal } from '../../components/chat-info-modal/chat-info-modal';
import { ConversationsService } from '../../services/conversations.service';
import { MessagesService } from '../../services/messages.service';
import { ConversationSidebarComponent } from "../../components/conversation-sidebar/conversation-sidebar";
import { ChatThreadHeaderComponent } from "../../components/chat-thread-header/chat-thread-header";
import { ChatMessageComposer } from "../../components/message-composer/message-composer";
import {ChatMessageListComponent} from "../../components/message-list/message-list";
import {ChatMessageItem, ChatMessageItemViewModel, ChatMessageStatus} from "../../components/chat-message-item/chat-message-item";
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';


interface MessageViewModel extends Message {
  senderDisplayName: string;
  senderPhotoURL: string | null;
  senderInitials: string;
}

@Component({
  selector: 'app-conversations-page',
  imports: [
    AsyncPipe,
  
    ReactiveFormsModule,
    IonSplitPane,
    IonContent,
    IonText,
    IonCard,
    IonCardContent,
    IonModal,
    IonIcon,
    ChatInfoModal,
    ConversationSidebarComponent,
    ChatThreadHeaderComponent,
    ChatMessageComposer,
    ChatMessageListComponent,
],
  templateUrl: './conversations-page.html',
  styleUrl: './conversations-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationsPage {
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly conversationsService = inject(ConversationsService);
  private readonly messagesService = inject(MessagesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alertController = inject(AlertController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly emptyReadStates = new Map<string, number>();
  private isMarkingConversationAsRead = false;

  private appendLocalSystemMessage(params: {
    createdAt: number;
    senderId: string;
    senderName: string;
    text: string;
  }): void {
    
    this.cdr.markForCheck();

    setTimeout(() => {
      void this.scrollToBottom(true);
    }, 30);
  }


  @ViewChild(IonContent) private ionContent?: IonContent;

  readonly emptyChatIcon = chatbubbleEllipsesOutline;
  readonly menuChevronDownIcon = chevronDownOutline;
  readonly menuChevronUpIcon = chevronUpOutline;
  readonly sentStatusIcon = checkmarkDoneOutline;
  readonly sendingStatusIcon = timeOutline;
  readonly groupIcon = peopleOutline;
  readonly addPersonIcon = personAddOutline;
  readonly removePersonIcon = personRemoveOutline;
  readonly editIcon = pencilOutline;
  readonly locationIcon = locationOutline;
  readonly deleteIcon = trashOutline;
  readonly adminIcon = shieldCheckmarkOutline;

  readonly currentUser$ = this.authService.currentUser$;

  pendingMessageCreatedAt: number | null = null;
  isTabVisible =
    document.visibilityState === 'visible' && document.hasFocus();

  readonly selectedConversationId$ = this.route.paramMap.pipe(
    map((params) => {
      const value = params.get('conversationId') ?? '';
      return value === 'new' ? '' : value;
    }),
  );

  readonly allUsers$ = this.usersService.getUsers();

  readonly conversations$ = this.currentUser$.pipe(
    switchMap((user) => {
      if (!user) {
        return of([]);
      }

      return combineLatest([
        this.conversationsService.getUserConversations(user.uid),
        this.usersService.getUsers(),
      ]).pipe(
        switchMap(([conversations, users]) => {
          const validConversations = conversations.filter(
            (conversation): conversation is UserConversation =>
              !!conversation?.conversationId,
          );

          if (validConversations.length === 0) {
            return of([]);
          }

          const usersById = new Map(
            users.map((profile) => [profile.uid, profile]),
          );

          return combineLatest(
            validConversations.map((conversation) => {
              const otherUserProfile = conversation.otherUserId
                ? usersById.get(conversation.otherUserId)
                : null;

              const fallbackName =
                otherUserProfile?.displayName ||
                otherUserProfile?.username ||
                'Usuario';

              const normalizedTitle =
                conversation.title?.trim() ||
                conversation.otherUserName?.trim() ||
                fallbackName;

              const hasStoredLastMessage =
                !!conversation.lastMessage?.trim() &&
                !!conversation.lastMessageAt;

              if (hasStoredLastMessage) {
                return of({
                  ...conversation,
                  title: normalizedTitle,
                });
              }

              return this.messagesService
                .getLastMessage$(conversation.conversationId)
                .pipe(
                  map((lastMessage) => {
                    if (!lastMessage) {
                      return {
                        ...conversation,
                        title: normalizedTitle,
                      };
                    }

                    return {
                      ...conversation,
                      title: normalizedTitle,
                      lastMessage: lastMessage.text,
                      lastMessageAt: lastMessage.createdAt,
                      updatedAt: Math.max(
                        conversation.updatedAt || 0,
                        lastMessage.createdAt,
                      ),
                    };
                  }),
                );
            }),
          );
        }),
        map((conversations) => {
          return conversations.sort((a, b) => {
            const aTimestamp = a.lastMessageAt || a.updatedAt || 0;
            const bTimestamp = b.lastMessageAt || b.updatedAt || 0;

            return bTimestamp - aTimestamp;
          });
        }),
        catchError(() => of([])),
      );
    }),
  );

  readonly conversationsWithAvatars$ = combineLatest([
    this.conversations$,
    this.allUsers$,
  ]).pipe(
    map(([conversations, users]) => {
      const usersById = new Map(users.map((u) => [u.uid, u]));

      return conversations.map((conversation) => {
        const avatarURL = conversation.isGroup
          ? ((conversation as any).photoURL ?? null)
          : conversation.otherUserId
            ? (usersById.get(conversation.otherUserId)?.photoURL ?? null)
            : null;

        const title =
          conversation.title || conversation.otherUserName || 'Conversación';

        return {
          ...conversation,
          avatarURL,
          avatarInitials: this.getUserInitials(title),
        } as any;
      });
    }),
  );

  readonly selectedConversation$ = combineLatest([
    this.currentUser$,
    this.selectedConversationId$,
  ]).pipe(
    switchMap(([currentUser, conversationId]) => {
      if (!currentUser || !conversationId) {
        return of(null);
      }

      return this.conversationsService.getUserConversation(
        currentUser.uid,
        conversationId,
      );
    }),
  );

  readonly selectedConversationDetails$ = this.selectedConversationId$.pipe(
    distinctUntilChanged(),
    switchMap((conversationId) => {
      if (!conversationId) {
        return of(null);
      }

      return this.conversationsService.getConversation(conversationId);
    }),
    catchError(() => of(null)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly otherUserProfile$ = combineLatest([
    this.selectedConversation$,
    this.selectedConversationDetails$,
  ]).pipe(
    switchMap(([selectedConversation, conversationDetails]) => {
      if (
        conversationDetails?.type === 'group' ||
        !selectedConversation?.otherUserId
      ) {
        return of(null);
      }

      return this.usersService.getUserById$(selectedConversation.otherUserId);
    }),
  );

  readonly selectedConversationMembers$ = this.selectedConversationId$.pipe(
    switchMap((conversationId) => {
      if (!conversationId) {
        return of([]);
      }

      return this.conversationsService.getConversationMembers(conversationId);
    }),
    map((members) =>
      [...members]
        .filter((member) => !member.removedAt)
        .sort((a, b) => {
          const roleWeight = {
            owner: 0,
            admin: 1,
            member: 2,
          } as const;

          const byRole = roleWeight[a.role] - roleWeight[b.role];
          if (byRole !== 0) {
            return byRole;
          }

          return a.displayName.localeCompare(b.displayName);
        }),
    ),
  );

  readonly currentUserMember$ = combineLatest([
    this.currentUser$,
    this.selectedConversationMembers$,
  ]).pipe(
    map(([currentUser, members]) => {
      if (!currentUser) {
        return null;
      }

      return (
        members.find(
          (member) => member.uid === currentUser.uid && !member.removedAt,
        ) ?? null
      );
    }),
  );

  readonly groupMemberReadStates$ = combineLatest([
    this.selectedConversationDetails$,
    this.selectedConversationMembers$,
    this.selectedConversationId$,
  ]).pipe(
    switchMap(([conversationDetails, members, conversationId]) => {
      if (!conversationId || conversationDetails?.type !== 'group') {
        return of(new Map<string, number>());
      }

      const activeMemberIds = members
        .filter((member) => !member.removedAt)
        .map((member) => member.uid);

      if (activeMemberIds.length === 0) {
        return of(new Map<string, number>());
      }

      return combineLatest(
        activeMemberIds.map((memberId) =>
          this.conversationsService
            .getUserConversation(memberId, conversationId)
            .pipe(
              map((memberConversation) => [
                memberId,
                memberConversation?.lastReadAt ?? 0,
              ] as const),
            ),
        ),
      ).pipe(map((entries) => new Map(entries)));
    }),
  );


readonly liveMessages$ = combineLatest([
    this.currentUser$,
    this.selectedConversationId$,
  ]).pipe(
    switchMap(([currentUser, conversationId]) => {
      if (!currentUser || !conversationId) {
        return of<Message[]>([]);
      }

      return this.messagesService.getVisibleMessagesForUser(
        conversationId,
        currentUser.uid,
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly pageSize = 10;
  private readonly paginatedMessagesSubject = new BehaviorSubject<Message[]>([]);
  readonly messages = this.paginatedMessagesSubject.asObservable();

  hasMoreMessages = true;
  isLoadingMessages = false;

  oldestLoadedMessageCreatedAt: number | null = null;
  newestLoadedMessageCreatedAt: number | null = null;
  currentLoadedConversationId: string | null = null;

  private incomingMessagesSubscription?: Subscription;
  private readonly destroyIncoming$ = new Subject<void>();

  readonly messageViewModels = combineLatest([
    this.messages,
    this.allUsers$,
    this.currentUser$,
  ]).pipe(
    map(([messages, users, currentUser]) => {
      const usersById = new Map(users.map((profile) => [profile.uid, profile]));

      if (currentUser?.uid) {
        usersById.set(currentUser.uid, {
          uid: currentUser.uid,
          username: currentUser.email ?? currentUser.uid,
          displayName: currentUser.displayName ?? currentUser.email ?? 'Usuario',
          email: currentUser.email ?? '',
          photoURL: currentUser.photoURL ?? null,
          bio: null,
          createdAt: 0,
          updatedAt: 0,
          isDeleted: false,
          deletedAt: null,
        } satisfies UserProfile);
      }

      return messages.map((message) => {
        const senderProfile = usersById.get(message.senderId);
        const senderDisplayName =
          senderProfile?.displayName?.trim() || message.senderName || 'Usuario';

        return {
          ...message,
          senderDisplayName,
          senderPhotoURL: senderProfile?.photoURL ?? null,
          senderInitials: this.getUserInitials(senderDisplayName),
        } satisfies MessageViewModel;
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly messageInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  isSending = false;
  errorMessage = '';
  openConversationMenuId: string | null = null;
  openMessageMenuId: string | null = null;
  isConversationInfoModalOpen = false;


  constructor() {
  addIcons({
    chatbubbleEllipsesOutline,
    chevronDownOutline,
    chevronUpOutline,
    checkmarkDoneOutline,
    peopleOutline,
    pencilOutline,
    personAddOutline,
    personRemoveOutline,
    shieldCheckmarkOutline,
    locationOutline,
    timeOutline,
    trashOutline,
  });

  combineLatest([this.selectedConversationId$, this.selectedConversation$])
    .pipe(
      map(([conversationId, conversation]) => ({
        conversationId,
        exists: !!conversation,
      })),
      distinctUntilChanged(
        (prev, curr) =>
          prev.conversationId === curr.conversationId &&
          prev.exists === curr.exists,
      ),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(({ conversationId, exists }) => {
      if (!conversationId || exists) {
        return;
      }

      void this.router.navigate(['/chat'], { replaceUrl: true });
    });

  combineLatest([this.currentUser$, this.selectedConversationId$, this.selectedConversation$])
    .pipe(
      distinctUntilChanged((previous, current) => {
        const [prevUser, prevConversationId, prevConversation] =
          previous as [{ uid?: string } | null, string, UserConversation | null];
        const [currUser, currConversationId, currConversation] =
          current as [{ uid?: string } | null, string, UserConversation | null];

        return (
          prevUser?.uid === currUser?.uid &&
          prevConversationId === currConversationId &&
          prevConversation?.lastReadAt === currConversation?.lastReadAt &&
          prevConversation?.isGroup === currConversation?.isGroup
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(([currentUser, conversationId]) => {
      if (!currentUser || !conversationId) {
        return;
      }

      if (!this.isChatActuallyVisible()) {
        void this.handleConversationRead(currentUser.uid, conversationId);
      }
    });

  combineLatest([
    this.currentUser$,
    this.selectedConversationId$,
    this.selectedConversation$,
    this.messages,
  ])
    .pipe(
      map(([currentUser, conversationId, selectedConversation, messages]) => ({
        currentUserId: currentUser?.uid ?? '',
        conversationId,
        conversationType: selectedConversation?.isGroup ? 'group' : ('direct' as 'direct' | 'group'),
        lastReadAt: selectedConversation?.lastReadAt ?? 0,
        messages,
        lastMessageId: messages.length > 0 ? messages[messages.length - 1]?.id ?? '' : '',
      })),
      distinctUntilChanged(
        (prev, curr) =>
          prev.currentUserId === curr.currentUserId &&
          prev.conversationId === curr.conversationId &&
          prev.conversationType === curr.conversationType &&
          prev.lastReadAt === curr.lastReadAt &&
          prev.lastMessageId === curr.lastMessageId,
      ),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(({ currentUserId, conversationId, conversationType, lastReadAt, messages }) => {
      if (!currentUserId || !conversationId || messages.length === 0) {
        return;
      }

      if (!this.isChatActuallyVisible()) {
        return;
      }

      const hasUnreadIncomingMessages = this.messagesService.hasUnreadIncomingMessages({
        messages,
        currentUserId,
        conversationType,
        lastReadAt,
      });

      if (!hasUnreadIncomingMessages) {
        return;
      }

      void this.handleConversationRead(currentUserId, conversationId);
    });

  combineLatest([this.currentUser$, this.selectedConversationId$])
    .pipe(
      distinctUntilChanged(
        ([prevUser, prevConversationId], [currUser, currConversationId]) =>
          prevUser?.uid === currUser?.uid &&
          prevConversationId === currConversationId,
      ),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(([currentUser, conversationId  ]) => {
      if (!currentUser || !conversationId) {
        this.resetPagedMessages();
        return;
      }

      void this.loadInitialMessages(conversationId, currentUser.uid);
    });

    // Sincronización en tiempo real de estados de lectura y nuevos mensajes
    combineLatest([this.liveMessages$, this.currentUser$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([liveMsgs, currentUser]) => {
        if (!currentUser || liveMsgs.length === 0) return;

        const currentMessages = this.paginatedMessagesSubject.getValue();
        const merged = this.mergeMessages(currentMessages, liveMsgs);

        // Detectamos si hay cambios relevantes (lectura o nuevos mensajes)
        const hasNewMessages = merged.length > currentMessages.length;
        const hasStatusChanges = merged.some((m, i) => m.readAt !== currentMessages[i]?.readAt);

        if (hasNewMessages || hasStatusChanges) {
          this.paginatedMessagesSubject.next(merged);
          this.newestLoadedMessageCreatedAt = merged[merged.length - 1]?.createdAt ?? this.newestLoadedMessageCreatedAt;
          this.cdr.markForCheck();

          if (hasNewMessages) {
            void this.shouldAutoScrollOnIncomingMessage().then(should => {
              if (should) setTimeout(() => void this.scrollToBottom(true), 50);
            });
          }
        }
      });
}

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.updateTabVisibilityState();

    if (this.isChatActuallyVisible()) {
      void this.markCurrentConversationAsReadIfNeeded();
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.updateTabVisibilityState();
    void this.markCurrentConversationAsReadIfNeeded();
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.updateTabVisibilityState();
  }

  private updateTabVisibilityState(): void {
    this.isTabVisible =
      document.visibilityState === 'visible' && document.hasFocus();

    this.cdr.markForCheck();
  }

  private isChatActuallyVisible(): boolean {
    return (
      this.isTabVisible &&
      document.visibilityState === 'visible' &&
      document.hasFocus()
    );
  }

  private async markCurrentConversationAsReadIfNeeded(): Promise<void> {
    const currentUser = await firstValueFrom(this.currentUser$);
    const conversationId = await firstValueFrom(this.selectedConversationId$);
    const selectedConversation = await firstValueFrom(this.selectedConversation$);
    const messages = await firstValueFrom(this.liveMessages$);

    if (
      !currentUser ||
      !conversationId ||
      !this.isChatActuallyVisible() ||
      this.isMarkingConversationAsRead
    ) {
      return;
    }

    const hasUnreadIncomingMessages = this.messagesService.hasUnreadIncomingMessages({
      messages,
      currentUserId: currentUser.uid,
      conversationType: selectedConversation?.isGroup ? 'group' : 'direct',
      lastReadAt: selectedConversation?.lastReadAt ?? 0,
    });

    if (!hasUnreadIncomingMessages) {
      return;
    }

    await this.handleConversationRead(currentUser.uid, conversationId);
  }

  private async handleConversationRead(
    currentUserId: string,
    conversationId: string,
  ): Promise<void> {
    if (this.isMarkingConversationAsRead) return;

    this.isMarkingConversationAsRead = true;

    try {
      const messages = this.paginatedMessagesSubject.getValue();
      const newestMessageCreatedAt =
        messages[messages.length - 1]?.createdAt ?? Date.now();

      const currentMap = this.localConversationReadAtSubject.getValue();
      this.localConversationReadAtSubject.next({
        ...currentMap,
        [conversationId]: newestMessageCreatedAt,
      });
      this.cdr.markForCheck();

      await firstValueFrom(
        this.messagesService.markMessagesAsRead({
          conversationId,
          currentUserId: currentUserId,
        }),
      );

      await this.conversationsService.markConversationAsRead(
        currentUserId,
        conversationId,
      );
    } finally {
      this.isMarkingConversationAsRead = false;
    }
  }

  private resetPagedMessages(): void {

    this.paginatedMessagesSubject.next([]);
    this.hasMoreMessages = true;
    this.isLoadingMessages = false;
    this.oldestLoadedMessageCreatedAt = null;
    this.newestLoadedMessageCreatedAt = null;
    this.currentLoadedConversationId = null;

    this.cdr.markForCheck();
  }

  private mergeMessages(...groups: Message[][]): Message[] {
    const map = new Map<string, Message>();

    for (const group of groups) {
      for (const message of group) {
        const key =
          message.id ??
          `${message.senderId}__${message.createdAt}__${message.text}__${message.type}`;

        const existing = map.get(key);

        if (!existing) {
          map.set(key, message);
          continue;
        }

        if (existing.isLocalOnly && !message.isLocalOnly) {
          map.set(key, message);
          continue;
        }

        map.set(key, { ...existing, ...message });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  private async ensureMinimumLoaderTime(startedAt: number, minDurationMs = 700): Promise<void> {
    const elapsed = Date.now() - startedAt;
    const remaining = minDurationMs - elapsed;

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  private async loadInitialMessages(conversationId: string, currentUserId: string): Promise<void> {
    this.isLoadingMessages = true;
    this.hasMoreMessages = true;
    this.oldestLoadedMessageCreatedAt = null;
    this.newestLoadedMessageCreatedAt = null;
    this.currentLoadedConversationId = conversationId;
    this.paginatedMessagesSubject.next([]);
    this.cdr.markForCheck();

    try {
      const messages = await this.messagesService.getLatestVisibleMessagesForUser({
        conversationId,
        currentUserId,
        pageSize: this.pageSize,
      });

      this.paginatedMessagesSubject.next(messages);
      this.oldestLoadedMessageCreatedAt = messages[0]?.createdAt ?? null;
      this.newestLoadedMessageCreatedAt = messages[messages.length - 1]?.createdAt ?? null;
      this.hasMoreMessages = messages.length === this.pageSize;

      this.cdr.markForCheck();

      setTimeout(() => void this.scrollToBottom(false), 50);
    } finally {
      this.isLoadingMessages = false;
      this.cdr.markForCheck();
    }
  }

  private async shouldAutoScrollOnIncomingMessage(): Promise<boolean> {
    const scrollElement = await this.ionContent?.getScrollElement();
    if (!scrollElement) {
      return true;
    }

    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

    return distanceFromBottom < 140;
  }

  async loadOlderMessages(event?: InfiniteScrollCustomEvent): Promise<void> {
    const currentUser = await firstValueFrom(this.currentUser$.pipe(take(1)));
    const conversationId = await firstValueFrom(this.selectedConversationId$.pipe(take(1)));

    if (
      !currentUser ||
      !conversationId ||
      !this.oldestLoadedMessageCreatedAt ||
      !this.hasMoreMessages ||
      this.isLoadingMessages
    ) {
      await event?.target.complete();
      return;
    }

    const startedAt = Date.now();
    this.isLoadingMessages = true;
    this.cdr.markForCheck();

    try {
      const currentMessages = this.paginatedMessagesSubject.getValue();
      const previousOldestId = currentMessages[0]?.id ?? null;

      const olderMessages =
        await this.messagesService.getPreviousVisibleMessagesForUser({
          conversationId,
          currentUserId: currentUser.uid,
          pageSize: this.pageSize,
          beforeCreatedAt: this.oldestLoadedMessageCreatedAt,
        });

      await this.ensureMinimumLoaderTime(startedAt, 700);

      if (olderMessages.length === 0) {
        this.hasMoreMessages = false;
        return;
      }

      const merged = this.mergeMessages(olderMessages, currentMessages);

      this.paginatedMessagesSubject.next(merged);
      this.oldestLoadedMessageCreatedAt = merged[0]?.createdAt ?? null;
      this.newestLoadedMessageCreatedAt =
        merged[merged.length - 1]?.createdAt ?? this.newestLoadedMessageCreatedAt;
      this.hasMoreMessages = olderMessages.length === this.pageSize;

      this.cdr.markForCheck();

      setTimeout(() => {
        if (!previousOldestId) {
          return;
        }

        document.getElementById(`msg-${previousOldestId}`)?.scrollIntoView({
          block: 'start',
        });
      }, 30);
    } catch (error) {
      console.error('Error cargando mensajes antiguos', error);
    } finally {
      this.isLoadingMessages = false;
      await event?.target.complete();
      this.cdr.markForCheck();
    }
  }

  private async scrollToBottom(animated = true): Promise<void> {
    await this.ionContent?.scrollToBottom(animated ? 250 : 0);
  }

  async openConversation(conversationId: string): Promise<void> {
    this.openConversationMenuId = null;
    this.openMessageMenuId = null;

    await this.router.navigate(['/chat', conversationId]);

    if (!this.isChatActuallyVisible()) {
      return;
    }

    const currentUser = await firstValueFrom(this.currentUser$);
    if (currentUser) {
      await this.handleConversationRead(currentUser.uid, conversationId);
    }
  }

  isSelectedConversation(
    conversationId: string,
    selectedConversationId: string,
  ): boolean {
    return conversationId === selectedConversationId;
  }

  isOwnMessage(message: Message, currentUserId: string | undefined): boolean {
    return !!currentUserId && message.senderId === currentUserId;
  }

  isPendingMessage(
    message: Message,
    currentUserId: string | undefined,
  ): boolean {
    return (
      this.isOwnMessage(message, currentUserId) &&
      this.pendingMessageCreatedAt !== null &&
      message.createdAt === this.pendingMessageCreatedAt
    );
  }

  getMessageStatus(
    message: Message,
    currentUserId: string | undefined,
    conversationType?: 'direct' | 'group',
    groupMemberReadStates?: Map<string, number>,
  ): 'sent' | 'read' | null {
    if (!this.isOwnMessage(message, currentUserId)) {
      return null;
    }

    if (conversationType === 'group') {
      const memberReadStates = groupMemberReadStates ?? new Map<string, number>();
      const activeRecipientIds = [...memberReadStates.keys()].filter(
        (memberId) => memberId !== currentUserId,
      );

      if (
        activeRecipientIds.length > 0 &&
        activeRecipientIds.every((memberId) => {
          const lastReadAt = memberReadStates.get(memberId) ?? 0;
          return lastReadAt >= message.createdAt;
        })
      ) {
        return 'read';
      }

      return 'sent';
    }

    if (message.readAt && message.readAt > 0) {
      return 'read';
    }

    return 'sent';
  }

  getUserInitials(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      return 'U';
    }

    const parts = normalized.split(/\s+/).slice(0, 2);

    return parts.map((part: string) => part.charAt(0).toUpperCase()).join('');
  }

  shouldShowMessageAvatar(messages: Message[], index: number): boolean {
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

  isGroupConversation(conversation: UserConversation | null): boolean {
    return !!conversation?.isGroup;
  }

  isLocationMessage(message: Message): boolean {
    return message.type === 'location';
  }

  isSystemMessage(message: Message): boolean {
    return message.type === 'system';
  }

  canManageGroup(
    conversationDetails: Conversation | null,
    currentUserMember: ConversationMember | null,
  ): boolean {
    if (!conversationDetails || conversationDetails.type !== 'group') {
      return false;
    }

    return (
      currentUserMember?.role === 'owner' ||
      currentUserMember?.role === 'admin'
    );
  }

  canEditRoles(currentUserMember: ConversationMember | null): boolean {
    return currentUserMember?.role === 'owner';
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

  toggleConversationMenu(conversationId: string): void {
    this.openConversationMenuId =
      this.openConversationMenuId === conversationId ? null : conversationId;
  }

  isConversationMenuOpen(conversationId: string): boolean {
    return this.openConversationMenuId === conversationId;
  }

  toggleMessageMenu(messageId: string): void {
    this.openMessageMenuId =
      this.openMessageMenuId === messageId ? null : messageId;
  }

  isMessageMenuOpen(messageId: string): boolean {
    return this.openMessageMenuId === messageId;
  }

  openConversationInfoModal(): void {
    this.isConversationInfoModalOpen = true;
  }

  closeConversationInfoModal(): void {
    this.isConversationInfoModalOpen = false;
  }

  async handleEditGroupFromModal(): Promise<void> {
    const [conversationDetails, currentUserMember] = await firstValueFrom(
      combineLatest([this.selectedConversationDetails$, this.currentUserMember$]),
    );

    if (conversationDetails && currentUserMember) {
      await this.editGroupDetails(conversationDetails, currentUserMember);
    }
  }

  async handleAddMembersFromModal(): Promise<void> {
    const [conversationDetails, currentUserMember] = await firstValueFrom(
      combineLatest([this.selectedConversationDetails$, this.currentUserMember$]),
    );

    if (conversationDetails && currentUserMember) {
      await this.addMembersToGroup(conversationDetails, currentUserMember);
    }
  }

  async handleDeleteGroupFromModal(): Promise<void> {
    const [conversationDetails, currentUserMember] = await firstValueFrom(
      combineLatest([this.selectedConversationDetails$, this.currentUserMember$]),
    );

    if (conversationDetails && currentUserMember) {
      await this.deleteSelectedGroup(conversationDetails, currentUserMember);
    }
  }

  async handleToggleAdminRoleFromModal(member: ConversationMember): Promise<void> {
    const [conversationDetails, currentUserMember] = await firstValueFrom(
      combineLatest([this.selectedConversationDetails$, this.currentUserMember$]),
    );

    if (conversationDetails && currentUserMember) {
      await this.toggleAdminRole(member, currentUserMember, conversationDetails);
    }
  }

  async handleRemoveMemberFromModal(member: ConversationMember): Promise<void> {
    const [conversationDetails, currentUserMember] = await firstValueFrom(
      combineLatest([this.selectedConversationDetails$, this.currentUserMember$]),
    );

    if (conversationDetails && currentUserMember) {
      await this.removeMemberFromGroup(
        conversationDetails,
        member,
        currentUserMember,
      );
    }
  }

  async editGroupDetails(
    conversationDetails: Conversation | null,
    currentUserMember: ConversationMember | null,
  ): Promise<void> {
    if (!conversationDetails || !this.canManageGroup(conversationDetails, currentUserMember)) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Editar grupo',
      inputs: [
        {
          name: 'title',
          type: 'text',
          value: conversationDetails.title,
          placeholder: 'Nombre del grupo',
        },
        {
          name: 'description',
          type: 'textarea',
          value: conversationDetails.description,
          placeholder: 'Descripción',
        },
        {
          name: 'photoURL',
          type: 'text',
          value: conversationDetails.photoURL,
          placeholder: 'URL de la foto',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          handler: async (data) => {
            const title = typeof data?.title === 'string' ? data.title.trim() : '';

            if (!title) {
              this.errorMessage = 'El grupo debe tener un nombre.';
              this.cdr.markForCheck();
              return false;
            }

            await this.conversationsService.updateGroupDetails({
              conversationId: conversationDetails.id,
              title,
              description:
                typeof data?.description === 'string'
                  ? data.description.trim()
                  : '',
              photoURL:
                typeof data?.photoURL === 'string'
                  ? data.photoURL.trim()
                  : '',
            });

            this.errorMessage = '';
            this.cdr.markForCheck();
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  async addMembersToGroup(
    conversationDetails: Conversation | null,
    currentUserMember: ConversationMember | null,
  ): Promise<void> {
    if (!conversationDetails || !this.canManageGroup(conversationDetails, currentUserMember)) {
      return;
    }

    const currentUser = await firstValueFrom(this.currentUser$.pipe(take(1)));

    if (!currentUser) {
      return;
    }

    const users = await firstValueFrom(this.allUsers$.pipe(take(1)));
    const existingMemberIds = new Set(Object.keys(conversationDetails.memberIds ?? {}));
    const availableUsers = users.filter((user) => !existingMemberIds.has(user.uid));

    if (availableUsers.length === 0) {
      this.errorMessage = 'No hay más usuarios disponibles para añadir.';
      this.cdr.markForCheck();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Añadir miembros',
      inputs: availableUsers.map((user) => ({
        name: `member-${user.uid}`,
        type: 'checkbox' as const,
        label: user.displayName || user.username || user.email,
        value: user.uid,
      })),
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Añadir',
          handler: async (selectedValues) => {
            const selectedUserIds = Array.isArray(selectedValues)
              ? selectedValues.filter((value): value is string => typeof value === 'string')
              : [];

            if (selectedUserIds.length === 0) {
              return false;
            }

            const currentProfile = await firstValueFrom(
              this.usersService.getUserById$(currentUser.uid).pipe(take(1)),
            );

            if (!currentProfile) {
              return false;
            }

            const actorName =
              currentProfile.displayName ??
              currentUser.displayName ??
              currentUser.email ??
              'Usuario';

            const selectedUsers = availableUsers
              .filter((user) => selectedUserIds.includes(user.uid))
              .map((user) => ({
                uid: user.uid,
                displayName: user.displayName || user.username || 'Usuario',
              }));

            const systemText = `${actorName} ha añadido a ${selectedUsers
              .map((user) => user.displayName)
              .join(', ')} al grupo.`;

            await firstValueFrom(
              this.conversationsService
                .addGroupMembers({
                  conversationId: conversationDetails.id,
                  actorId: currentUser.uid,
                  actorName,
                  members: selectedUsers,
                })
                .pipe(
                  concatMap(() =>
                    this.messagesService.addSystemMessage({
                      conversationId: conversationDetails.id,
                      senderId: currentUser.uid,
                      senderName: actorName,
                      text: systemText,
                      createdAt: Date.now(),
                    }),
                  ),
                  tap((systemMessageAt) => {
                    this.appendLocalSystemMessage({
                      createdAt: systemMessageAt,
                      senderId: currentUser.uid,
                      senderName: actorName,
                      text: systemText,
                    });
                  }),
                  concatMap((systemMessageAt) =>
                    this.conversationsService.refreshConversationSummary({
                      conversationId: conversationDetails.id,
                      lastMessageText: systemText,
                      lastMessageAt: systemMessageAt,
                      lastSenderId: currentUser.uid,
                    }),
                  ),
                  tap(() => {
                    this.errorMessage = '';
                    this.cdr.markForCheck();
                  }),
                  map(() => true),
                  catchError((error) => {
                    console.error('Error al añadir miembros al grupo', error);
                    this.errorMessage = 'No se ha podido añadir a los miembros.';
                    this.cdr.markForCheck();
                    return of(false);
                  }),
                ),
            );

            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  async removeMemberFromGroup(
    conversationDetails: Conversation | null,
    member: ConversationMember,
    currentUserMember: ConversationMember | null,
  ): Promise<void> {
    if (
      !conversationDetails ||
      !this.canManageGroup(conversationDetails, currentUserMember)
    ) {
      return;
    }

    if (member.role === 'owner') {
      this.errorMessage = 'No se puede expulsar al creador del grupo.';
      this.cdr.markForCheck();
      return;
    }

    const currentUser = await firstValueFrom(this.currentUser$.pipe(take(1)));

    if (!currentUser) {
      return;
    }

    const currentProfile = await firstValueFrom(
      this.usersService.getUserById$(currentUser.uid).pipe(take(1)),
    );

    if (!currentProfile) {
      return;
    }

    const actorName =
      currentProfile.displayName ??
      currentUser.displayName ??
      currentUser.email ??
      'Usuario';

    const alert = await this.alertController.create({
      header: 'Quitar miembro',
      message: `¿Quieres eliminar a ${member.displayName} del grupo?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: () => {
            const systemText = `${actorName} ha eliminado a ${member.displayName} del grupo.`;

            return firstValueFrom(
              this.conversationsService
                .removeGroupMember({
                  conversationId: conversationDetails.id,
                  actorId: currentUser.uid,
                  targetUserId: member.uid,
                })
                .pipe(
                  concatMap(() =>
                    this.messagesService.addSystemMessage({
                      conversationId: conversationDetails.id,
                      senderId: currentUser.uid,
                      senderName: actorName,
                      text: systemText,
                      createdAt: Date.now(),
                    }),
                  ),
                  tap((systemMessageAt) => {
                    this.appendLocalSystemMessage({
                      createdAt: systemMessageAt,
                      senderId: currentUser.uid,
                      senderName: actorName,
                      text: systemText,
                    });
                  }),
                  concatMap((systemMessageAt) =>
                    this.conversationsService.refreshConversationSummary({
                      conversationId: conversationDetails.id,
                      lastMessageText: systemText,
                      lastMessageAt: systemMessageAt,
                      lastSenderId: currentUser.uid,
                    }),
                  ),
                  tap(() => {
                    this.errorMessage = '';
                    this.cdr.markForCheck();
                  }),
                  map(() => true),
                  catchError((error) => {
                    console.error('Error al quitar miembro del grupo', error);
                    this.errorMessage = 'No se ha podido quitar al miembro del grupo.';
                    this.cdr.markForCheck();
                    return of(false);
                  }),
                ),
            );
          },
        },
      ],
    });

    await alert.present();
  }

  async toggleAdminRole(
    member: ConversationMember,
    currentUserMember: ConversationMember | null,
    conversationDetails: Conversation | null,
  ): Promise<void> {
    if (!conversationDetails || !this.canEditRoles(currentUserMember)) {
      return;
    }

    if (member.role === 'owner') {
      this.errorMessage = 'No se puede modificar el rol del creador.';
      this.cdr.markForCheck();
      return;
    }

    const nextRole = member.role === 'admin' ? 'member' : 'admin';

    const currentUser = await firstValueFrom(this.currentUser$.pipe(take(1)));

    if (!currentUser) {
      return;
    }

    const currentProfile = await firstValueFrom(
      this.usersService.getUserById$(currentUser.uid).pipe(take(1)),
    );

    if (!currentProfile) {
      return;
    }

    const actorName =
      currentProfile.displayName ??
      currentUser.displayName ??
      currentUser.email ??
      'Usuario';

    const systemText =
      nextRole === 'admin'
        ? `${actorName} ha nombrado admin a ${member.displayName}.`
        : `${actorName} ha quitado el rol admin a ${member.displayName}.`;

      const systemMessageText = systemText;
      const systemSenderName = actorName;

    await firstValueFrom(
      this.conversationsService
        .changeMemberRole({
          conversationId: conversationDetails.id,
          targetUserId: member.uid,
          role: nextRole,
        })
        .pipe(
          concatMap(() =>
            this.messagesService.addSystemMessage({
              conversationId: conversationDetails.id,
              senderId: currentUser.uid,
              senderName: systemSenderName,
              text: systemMessageText,
              createdAt: Date.now(),
            }),
          ),
          tap((systemMessageAt) => {
            this.appendLocalSystemMessage({
              createdAt: systemMessageAt,
              senderId: currentUser.uid,
              senderName: actorName,
              text: systemText,
            });
          }),
          concatMap((systemMessageAt) =>
            this.conversationsService.refreshConversationSummary({
              conversationId: conversationDetails.id,
              lastMessageText: systemMessageText,
              lastMessageAt: systemMessageAt,
              lastSenderId: currentUser.uid,
            }),
          ),
          tap(() => {
            this.errorMessage = '';
            this.cdr.markForCheck();
          }),
          catchError((error) => {
            console.error('Error al cambiar el rol del miembro', error);
            this.errorMessage = 'No se ha podido actualizar el rol del miembro.';
            this.cdr.markForCheck();
            return of(void 0);
          }),
        ),
    );
  }

  async deleteSelectedGroup(
    conversationDetails: Conversation | null,
    currentUserMember: ConversationMember | null,
  ): Promise<void> {
    if (!conversationDetails || conversationDetails.type !== 'group') {
      return;
    }

    if (currentUserMember?.role !== 'owner') {
      this.errorMessage = 'Solo el creador puede eliminar el grupo.';
      this.cdr.markForCheck();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar grupo',
      message: 'Se borrará el grupo y todos sus mensajes. ¿Quieres continuar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.conversationsService.deleteGroupConversation(
              conversationDetails.id,
            );
            await this.router.navigate(['/chat']);
          },
        },
      ],
    });

    await alert.present();
  }

  async sendLocationMessage(): Promise<void> {
    if (this.isSending) return;

    try {
      if (Capacitor.getPlatform() !== 'web') {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
          const result = await Geolocation.requestPermissions();
          if (result.location !== 'granted') {
            this.errorMessage = 'Se necesitan permisos de ubicación para enviar tu posición.';
            this.cdr.markForCheck();
            return;
          }
        }
      }

      this.isSending = true;
      this.errorMessage = '';
      this.cdr.markForCheck();

      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const { latitude, longitude } = position.coords;

      // Reverse geocoding para obtener Ciudad, País usando Nominatim (Gratis)
      let locationLabel = '';
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          { headers: { 'Accept-Language': 'es' } }
        );
        const data = await response.json();
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || '';
        const country = data.address.country || '';
        locationLabel = city && country ? `${city}, ${country}` : country || 'Coordenadas';
      } catch (e) {
        locationLabel = 'Ubicación compartida';
      }

      const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const text = `${googleMapsUrl}\n\n(enviado desde ${locationLabel})`;

      const currentUser = await firstValueFrom(this.currentUser$);
      const conversationId = await firstValueFrom(this.selectedConversationId$);

      if (!currentUser || !conversationId) return;

      const createdAt = Date.now();
      this.pendingMessageCreatedAt = createdAt;
      this.cdr.markForCheck();

      const message: Omit<Message, 'id'> = {
        type: 'location',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Usuario',
        text,
        createdAt,
        readAt: 0,
        readBy: '',
      };

      await firstValueFrom(this.messagesService.addMessage(conversationId, message));
      await this.conversationsService.updateConversationSummary({
        conversationId,
        senderId: currentUser.uid,
        senderName: message.senderName,
        text: '📍 Ubicación compartida',
      });
    } catch (error) {
      console.error('Error al enviar ubicación:', error);
      this.errorMessage = 'No se pudo obtener la ubicación actual.';
    } finally {
      this.isSending = false;
      this.pendingMessageCreatedAt = null;
      this.cdr.markForCheck();
      setTimeout(() => void this.scrollToBottom(true), 50);
    }
  }

  async sendMessage(): Promise<void> {
    if (this.isSending) return;

    const messageText = this.messageInput.getRawValue().trim();
    if (!messageText) {
      this.messageInput.markAsTouched();
      return;
    }

    this.isSending = true;
    this.errorMessage = '';

    try {
      const currentUser = await firstValueFrom(this.currentUser$);
      const selectedConversation = await firstValueFrom(this.selectedConversation$);
      const conversationId = await firstValueFrom(this.selectedConversationId$);

      if (!currentUser || !conversationId || !selectedConversation) {
        throw new Error('No hay una conversación seleccionada.');
      }

      const currentUserProfile = await this.usersService.getUserById(currentUser.uid);
      if (!currentUserProfile) {
        throw new Error('No se encontró el perfil del usuario actual.');
      }

      const createdAt = Date.now();
      this.pendingMessageCreatedAt = createdAt;
      this.cdr.markForCheck();

      const message: Omit<Message, 'id'> = {
        type: 'text',
        senderId: currentUser.uid,
        senderName:
          currentUserProfile.displayName ??
          currentUser.displayName ??
          currentUser.email ??
          'Anónimo',
        text: messageText,
        createdAt,
        readAt: 0,
        readBy: '',
      };

      await firstValueFrom(this.messagesService.addMessage(conversationId, message));

      await this.conversationsService.updateConversationSummary({
        conversationId,
        senderId: currentUser.uid,
        senderName: message.senderName,
        text: messageText,
      });

      this.messageInput.reset();
      setTimeout(() => void this.scrollToBottom(true), 30);
    } catch (error) {
      console.error('Error al enviar mensaje', error);
      this.errorMessage = 'No se ha podido enviar el mensaje.';
    } finally {
      this.isSending = false;
      setTimeout(() => {
        this.pendingMessageCreatedAt = null;
        this.cdr.markForCheck();
      }, 250);
    }
  }

  private readonly localConversationReadAtSubject = new BehaviorSubject<Record<string, number>>({});

  readonly localConversationReadAt$ = this.localConversationReadAtSubject.asObservable();

  readonly selectedConversationWithLocalReadState = combineLatest([
    this.selectedConversation$,
    this.selectedConversationId$,
    this.localConversationReadAt$,
  ]).pipe(
    map(([conversation, conversationId, localReadMap]) => {
      if (!conversation || !conversationId) {
        return conversation;
      }

      const localLastReadAt = localReadMap[conversationId];
      if (!localLastReadAt) {
        return conversation;
      }

      return {
        ...conversation,
        lastReadAt: Math.max(conversation.lastReadAt ?? 0, localLastReadAt),
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async deleteMessage(message: Message): Promise<void> {
    this.openMessageMenuId = null;

    const currentUser = await firstValueFrom(this.currentUser$);
    const conversationId = await firstValueFrom(this.selectedConversationId$);

    if (!currentUser || !conversationId || !message.id) {
      return;
    }

    if (message.senderId !== currentUser.uid || message.type === 'system') {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar mensaje',
      message: '¿Quieres eliminar este mensaje?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
        },
      ],
    });

    await alert.present();

    const { role } = await alert.onDidDismiss();

    if (role !== 'destructive') {
      return;
    }

    await this.messagesService.deleteMessage(conversationId, message.id);

    const lastMessage = await this.messagesService.getLastMessage(conversationId);


    if (lastMessage) {
      await this.conversationsService.refreshConversationSummary({
        conversationId,
        lastMessageText: lastMessage.text,
        lastMessageAt: lastMessage.createdAt,
        lastSenderId: lastMessage.senderId,
      });
    } else {
      await this.conversationsService.clearConversationSummary({
        conversationId,
      });
    }
  }

  async deleteConversation(conversation: UserConversation): Promise<void> {
    this.openConversationMenuId = null;

    const currentUser = await firstValueFrom(this.currentUser$);

    if (!currentUser) {
      return;
    }

    if (conversation.isGroup) {
      this.errorMessage =
        'Los grupos se eliminan desde la cabecera del propio grupo.';
      this.cdr.markForCheck();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar conversación',
      message: 'La conversación desaparecerá de tu lista. ¿Quieres continuar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
        },
      ],
    });

    await alert.present();

    const { role } = await alert.onDidDismiss();

    if (role !== 'destructive') {
      return;
    }

    await this.conversationsService.deleteConversationForUser(
      currentUser.uid,
      conversation.conversationId,
    );

    const selectedConversationId = await firstValueFrom(this.selectedConversationId$);

    if (selectedConversationId === conversation.conversationId) {
      await this.router.navigate(['/chat']);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.messageInput.reset();
      this.errorMessage = '';
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión', error);
      this.errorMessage = 'No se ha podido cerrar sesión.';
    }
  }

  async goToProfile(): Promise<void> {
    await this.router.navigate(['/profile']);
  }

  trackByConversation(index: number, conversation: UserConversation): string {
    return conversation.conversationId ?? String(index);
  }

  trackByMessage(index: number, message: Message): string {
    return message.id ?? String(index);
  }

  trackByMember(index: number, member: ConversationMember): string {
    return member.uid ?? String(index);
  }
}