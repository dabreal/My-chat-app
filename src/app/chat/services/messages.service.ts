import { inject, Injectable } from '@angular/core';
import {
  Database,
  endAt,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  startAt,
  update,
} from '@angular/fire/database';
import {
  Observable,
  catchError,
  combineLatest,
  from,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';

import { Message } from '../models/message.model';
import { ConversationsService } from './conversations.service';

@Injectable({
  providedIn: 'root',
})
export class MessagesService {
  private readonly database = inject(Database);
  private readonly conversationsService = inject(ConversationsService);

  getMessages(conversationId: string): Observable<Message[]> {
    const messagesRef = ref(this.database, `conversationMessages/${conversationId}`);
    const orderedMessagesQuery = query(messagesRef, orderByChild('createdAt'));

    return new Observable<Message[]>((subscriber) => {
      const unsubscribe = onValue(
        orderedMessagesQuery,
        (snapshot) => {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }

          const messagesObject = snapshot.val() as Record<string, Message>;
          const messages = Object.entries(messagesObject)
            .map(([id, value]) => ({ id, ...value }))
            .sort((a, b) => a.createdAt - b.createdAt);

          subscriber.next(messages);
        },
        (error) => subscriber.error(error),
      );

      return () => unsubscribe();
    }).pipe(
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getVisibleMessagesForUser(
    conversationId: string,
    currentUserId: string,
  ): Observable<Message[]> {
    return combineLatest([
      this.getMessages(conversationId),
      this.conversationsService.getConversation(conversationId),
    ]).pipe(
      switchMap(([messages, conversation]) => {
        if (!conversation) {
          return of([]);
        }

        return this.conversationsService.getConversationMembers(conversationId).pipe(
          map((members) => {
            const currentMember = members.find(
              (member) => member.uid === currentUserId && !member.removedAt,
            );

            if (!currentMember) {
              return [];
            }

            if (conversation.type === 'direct') {
              return messages;
            }

            const visibleFrom = currentMember.canSeeHistoryFrom ?? 0;

            return messages.filter((message) => message.createdAt >= visibleFrom);
          }),
        );
      }),
    );
  }

  listenForNewVisibleMessages(params: {
    conversationId: string;
    currentUserId: string;
    afterCreatedAt: number;
  }): Observable<Message[]> {
    return combineLatest([
      this.conversationsService.getConversation(params.conversationId),
      this.conversationsService.getConversationMembers(params.conversationId),
    ]).pipe(
      switchMap(([conversation, members]) => {
        if (!conversation) {
          return of([]);
        }

        const currentMember = members.find(
          (member) => member.uid === params.currentUserId && !member.removedAt,
        );

        if (!currentMember) {
          return of([]);
        }

        const visibleFrom =
          conversation.type === 'group'
            ? Math.max(currentMember.canSeeHistoryFrom ?? 0, params.afterCreatedAt + 1)
            : params.afterCreatedAt + 1;

        const messagesRef = ref(
          this.database,
          `conversationMessages/${params.conversationId}`,
        );

        const incomingQuery = query(
          messagesRef,
          orderByChild('createdAt'),
          startAt(visibleFrom),
        );

        return new Observable<Message[]>((subscriber) => {
          const unsubscribe = onValue(
            incomingQuery,
            (snapshot) => {
              if (!snapshot.exists()) {
                subscriber.next([]);
                return;
              }

              const messagesObject = snapshot.val() as Record<string, Message>;
              const messages = Object.entries(messagesObject)
                .map(([id, value]) => ({ id, ...value }))
                .filter((message) => message.createdAt > params.afterCreatedAt)
                .sort((a, b) => a.createdAt - b.createdAt);

              subscriber.next(messages);
            },
            (error) => subscriber.error(error),
          );

          return () => unsubscribe();
        });
      }),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async getLatestVisibleMessagesForUser(params: {
    conversationId: string;
    currentUserId: string;
    pageSize: number;
  }): Promise<Message[]> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      return [];
    }

    const conversation = conversationSnapshot.val() as {
      type?: 'direct' | 'group';
    };

    let visibleFrom = 0;

    if (conversation.type === 'group') {
      const memberSnapshot = await get(
        ref(
          this.database,
          `conversationMembers/${params.conversationId}/${params.currentUserId}`,
        ),
      );

      if (!memberSnapshot.exists()) {
        return [];
      }

      const member = memberSnapshot.val() as {
        canSeeHistoryFrom?: number;
        removedAt?: number | null;
      };

      if (member.removedAt) {
        return [];
      }

      visibleFrom = member.canSeeHistoryFrom ?? 0;
    }

    const messagesRef = ref(
      this.database,
      `conversationMessages/${params.conversationId}`,
    );

    const snapshot = await get(
      query(messagesRef, orderByChild('createdAt'), limitToLast(params.pageSize)),
    );

    if (!snapshot.exists()) {
      return [];
    }

    const messagesObject = snapshot.val() as Record<string, Message>;

    return Object.entries(messagesObject)
      .map(([id, value]) => ({ id, ...value }))
      .filter((message) =>
        conversation.type === 'group' ? message.createdAt >= visibleFrom : true,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async getPreviousVisibleMessagesForUser(params: {
    conversationId: string;
    currentUserId: string;
    pageSize: number;
    beforeCreatedAt: number;
  }): Promise<Message[]> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      return [];
    }

    const conversation = conversationSnapshot.val() as {
      type?: 'direct' | 'group';
    };

    let visibleFrom = 0;

    if (conversation.type === 'group') {
      const memberSnapshot = await get(
        ref(
          this.database,
          `conversationMembers/${params.conversationId}/${params.currentUserId}`,
        ),
      );

      if (!memberSnapshot.exists()) {
        return [];
      }

      const member = memberSnapshot.val() as {
        canSeeHistoryFrom?: number;
        removedAt?: number | null;
      };

      if (member.removedAt) {
        return [];
      }

      visibleFrom = member.canSeeHistoryFrom ?? 0;
    }

    const messagesRef = ref(
      this.database,
      `conversationMessages/${params.conversationId}`,
    );

    const snapshot = await get(
      query(
        messagesRef,
        orderByChild('createdAt'),
        endAt(params.beforeCreatedAt - 1),
        limitToLast(params.pageSize),
      ),
    );

    if (!snapshot.exists()) {
      return [];
    }

    const messagesObject = snapshot.val() as Record<string, Message>;

    return Object.entries(messagesObject)
      .map(([id, value]) => ({ id, ...value }))
      .filter((message) =>
        conversation.type === 'group' ? message.createdAt >= visibleFrom : true,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  addMessage(
    conversationId: string,
    message: Omit<Message, 'id'>,
  ): Observable<void> {
    const messagesRef = ref(
      this.database,
      `conversationMessages/${conversationId}`,
    );

    return from(
      push(messagesRef, {
        ...message,
        readAt: message.readAt ?? 0,
        readBy: message.readBy ?? '',
      }),
    ).pipe(
      map(() => void 0),
    );
  }

  addSystemMessage(params: {
    conversationId: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt?: number;
  }): Observable<number> {
    const createdAt = params.createdAt ?? Date.now();

    return this.addMessage(params.conversationId, {
      type: 'system',
      senderId: params.senderId,
      senderName: params.senderName,
      text: params.text,
      createdAt,
      readAt: 0,
      readBy: '',
    }).pipe(
      map(() => createdAt),
    );
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await remove(
      ref(this.database, `conversationMessages/${conversationId}/${messageId}`),
    );
  }

  getLastMessage$(conversationId: string): Observable<Message | null> {
    return from(
      get(ref(this.database, `conversationMessages/${conversationId}`)),
    ).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }

        const messagesObject = snapshot.val() as Record<string, Message>;
        const messages = Object.entries(messagesObject).map(([id, value]) => ({
          id,
          ...value,
        }));

        if (messages.length === 0) {
          return null;
        }

        messages.sort((a, b) => b.createdAt - a.createdAt);
        return messages[0];
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async getLastMessage(conversationId: string): Promise<Message | null> {
    return new Promise((resolve, reject) => {
      this.getLastMessage$(conversationId).subscribe({
        next: resolve,
        error: reject,
      });
    });
  }

  markMessagesAsRead(params: {
    conversationId: string;
    currentUserId: string;
  }): Observable<void> {
    return from(
      get(ref(this.database, `conversations/${params.conversationId}`)),
    ).pipe(
      switchMap((conversationSnapshot) => {
        if (!conversationSnapshot.exists()) {
          return of(void 0);
        }

        const conversation = conversationSnapshot.val() as {
          type?: 'direct' | 'group';
        };

        if (conversation.type === 'group') {
          return of(void 0);
        }

        return from(
          get(ref(this.database, `conversationMessages/${params.conversationId}`)),
        );
      }),
      map((snapshot) => {
        if (!snapshot || !snapshot.exists()) {
          return null;
        }

        const messagesObject = snapshot.val() as Record<string, Message>;
        const updates: Record<string, unknown> = {};
        const now = Date.now();

        for (const [messageId, message] of Object.entries(messagesObject)) {
          const isIncomingMessage = message.senderId !== params.currentUserId;
          const isUnread = !message.readAt || message.readAt === 0;

          if (isIncomingMessage && isUnread) {
            updates[
              `conversationMessages/${params.conversationId}/${messageId}/readAt`
            ] = now;
            updates[
              `conversationMessages/${params.conversationId}/${messageId}/readBy`
            ] = params.currentUserId;
          }
        }

        return Object.keys(updates).length > 0 ? updates : null;
      }),
      switchMap((updates) => {
        if (!updates) {
          return of(void 0);
        }

        return from(update(ref(this.database), updates));
      }),
    );
  }

  hasUnreadIncomingMessages(params: {
    messages: Message[];
    currentUserId: string;
    conversationType?: 'direct' | 'group';
    lastReadAt?: number;
  }): boolean {
    if (params.conversationType === 'group') {
      const lastReadAt = params.lastReadAt ?? 0;

      return params.messages.some((message) => {
        const isIncomingMessage = message.senderId !== params.currentUserId;
        return isIncomingMessage && message.createdAt > lastReadAt;
      });
    }

    return params.messages.some((message) => {
      const isIncomingMessage = message.senderId !== params.currentUserId;
      const isUnread = !message.readAt || message.readAt === 0;
      return isIncomingMessage && isUnread;
    });
  }

  async wasLastOwnMessageRead(params: {
    conversationId: string;
    currentUserId: string;
  }): Promise<boolean> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      return false;
    }

    const conversation = conversationSnapshot.val() as {
      type?: 'direct' | 'group';
    };

    if (conversation.type === 'group') {
      const lastMessage = await this.getLastMessage(params.conversationId);

      if (!lastMessage || lastMessage.senderId !== params.currentUserId) {
        return false;
      }

      const membersSnapshot = await get(
        ref(this.database, `conversationMembers/${params.conversationId}`),
      );

      if (!membersSnapshot.exists()) {
        return false;
      }

      const membersObject = snapshotToMembers(membersSnapshot.val());

      const activeMemberIds = Object.values(membersObject)
        .filter((member) => !!member.uid && !member.removedAt)
        .map((member) => member.uid as string)
        .filter((uid) => uid !== params.currentUserId);

      const readChecks = await Promise.all(
        activeMemberIds.map(async (memberId) => {
          const memberConversationSnapshot = await get(
            ref(
              this.database,
              `userConversations/${memberId}/${params.conversationId}`,
            ),
          );

          if (!memberConversationSnapshot.exists()) {
            return false;
          }

          const memberConversation = memberConversationSnapshot.val() as {
            lastReadAt?: number;
          };

          return (memberConversation.lastReadAt ?? 0) >= lastMessage.createdAt;
        }),
      );

      return readChecks.every(Boolean);
    }

    const lastMessage = await this.getLastMessage(params.conversationId);

    if (!lastMessage) {
      return false;
    }

    if (lastMessage.senderId !== params.currentUserId) {
      return false;
    }

    return !!lastMessage.readAt && lastMessage.readAt > 0;
  }
}

function snapshotToMembers(value: unknown): Record<string, { uid?: string; removedAt?: number | null }> {
  return (value ?? {}) as Record<string, { uid?: string; removedAt?: number | null }>;
}