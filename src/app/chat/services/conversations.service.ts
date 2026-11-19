import { inject, Injectable } from '@angular/core';
import {
  Database,
  get,
  listVal,
  objectVal,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
} from '@angular/fire/database';
import { catchError, from, map, Observable, of, shareReplay, switchMap } from 'rxjs';

import {
  Conversation,
  ConversationMember,
  ConversationMemberRole,
  UserConversation,
} from '../models/conversation.model';

@Injectable({
  providedIn: 'root',
})
export class ConversationsService {
  private readonly database = inject(Database);

  async createPrivateConversation(params: {
    currentUserId: string;
    currentUserName: string;
    currentUserPhotoURL?: string | null;
    otherUserId: string;
    otherUserName: string;
    otherUserPhotoURL?: string | null;
  }): Promise<string> {
    const memberIds = [params.currentUserId, params.otherUserId].sort();
    const conversationId = memberIds.join('__');
    const now = Date.now();

    const conversationRef = ref(
      this.database,
      `conversations/${conversationId}`,
    );

    const existingConversation = await get(conversationRef);

    if (existingConversation.exists()) {
      await update(conversationRef, {
        updatedAt: now,
      });

      const currentUserConversation: UserConversation = {
        conversationId,
        type: 'direct',
        title: params.otherUserName,
        subtitle: '',
        photoURL: params.otherUserPhotoURL ?? '',
        updatedAt: now,
        lastMessage: '',
        lastMessageAt: 0,
        lastSenderId: '',
        unreadCount: 0,
        lastReadAt: 0,
        otherUserId: params.otherUserId,
        otherUserName: params.otherUserName,
        otherUserPhotoURL: params.otherUserPhotoURL ?? null,
        isGroup: false,
      };

      const otherUserConversation: UserConversation = {
        conversationId,
        type: 'direct',
        title: params.currentUserName,
        subtitle: '',
        photoURL: params.currentUserPhotoURL ?? '',
        updatedAt: now,
        lastMessage: '',
        lastMessageAt: 0,
        lastSenderId: '',
        unreadCount: 0,
        lastReadAt: 0,
        otherUserId: params.currentUserId,
        otherUserName: params.currentUserName,
        otherUserPhotoURL: params.currentUserPhotoURL ?? null,
        isGroup: false,
      };

      await update(ref(this.database), {
        [`userConversations/${params.currentUserId}/${conversationId}`]:
          currentUserConversation,
        [`userConversations/${params.otherUserId}/${conversationId}`]:
          otherUserConversation,
      });

      return conversationId;
    }

    const conversation: Conversation = {
      id: conversationId,
      type: 'direct',
      createdAt: now,
      updatedAt: now,
      createdBy: params.currentUserId,
      title: '',
      description: '',
      photoURL: '',
      memberIds: {
        [params.currentUserId]: true,
        [params.otherUserId]: true,
      },
      memberNames: {
        [params.currentUserId]: params.currentUserName,
        [params.otherUserId]: params.otherUserName,
      },
      membersCount: 2,
    };

    const currentMember: ConversationMember = {
      uid: params.currentUserId,
      displayName: params.currentUserName,
      role: 'owner',
      joinedAt: now,
      addedBy: params.currentUserId,
      canSeeHistoryFrom: 0,
    };

    const otherMember: ConversationMember = {
      uid: params.otherUserId,
      displayName: params.otherUserName,
      role: 'member',
      joinedAt: now,
      addedBy: params.currentUserId,
      canSeeHistoryFrom: 0,
    };

    const currentUserConversation: UserConversation = {
      conversationId,
      type: 'direct',
      title: params.otherUserName,
      subtitle: '',
      photoURL: params.otherUserPhotoURL ?? '',
      updatedAt: now,
      lastMessage: '',
      lastMessageAt: 0,
      lastSenderId: '',
      unreadCount: 0,
      lastReadAt: 0,
      otherUserId: params.otherUserId,
      otherUserName: params.otherUserName,
      otherUserPhotoURL: params.otherUserPhotoURL ?? null,
      isGroup: false,
    };

    const otherUserConversation: UserConversation = {
      conversationId,
      type: 'direct',
      title: params.currentUserName,
      subtitle: '',
      photoURL: params.currentUserPhotoURL ?? '',
      updatedAt: now,
      lastMessage: '',
      lastMessageAt: 0,
      lastSenderId: '',
      unreadCount: 0,
      lastReadAt: 0,
      otherUserId: params.currentUserId,
      otherUserName: params.currentUserName,
      otherUserPhotoURL: params.currentUserPhotoURL ?? null,
      isGroup: false,
    };

    await update(ref(this.database), {
      [`conversations/${conversationId}`]: conversation,
      [`conversationMembers/${conversationId}/${params.currentUserId}`]:
        currentMember,
      [`conversationMembers/${conversationId}/${params.otherUserId}`]:
        otherMember,
      [`userConversations/${params.currentUserId}/${conversationId}`]:
        currentUserConversation,
      [`userConversations/${params.otherUserId}/${conversationId}`]:
        otherUserConversation,
    });

    return conversationId;
  }

  async createGroupConversation(params: {
    currentUserId: string;
    currentUserName: string;
    title: string;
    description?: string;
    photoURL?: string;
    members: Array<{
      uid: string;
      displayName: string;
    }>;
  }): Promise<string> {
    const now = Date.now();
    const groupsRef = ref(this.database, 'conversations');
    const newConversationRef = push(groupsRef);
    const conversationId = newConversationRef.key;

    if (!conversationId) {
      throw new Error('No se ha podido generar el ID del grupo.');
    }

    const uniqueMembers = new Map<string, string>();
    uniqueMembers.set(params.currentUserId, params.currentUserName);

    for (const member of params.members) {
      uniqueMembers.set(member.uid, member.displayName);
    }

    const memberIdsRecord = Object.fromEntries(
      Array.from(uniqueMembers.keys()).map((uid) => [uid, true]),
    );

    const memberNamesRecord = Object.fromEntries(uniqueMembers.entries());

    const conversation: Conversation = {
      id: conversationId,
      type: 'group',
      createdAt: now,
      updatedAt: now,
      createdBy: params.currentUserId,
      title: params.title.trim(),
      description: params.description?.trim() ?? '',
      photoURL: params.photoURL?.trim() ?? '',
      memberIds: memberIdsRecord,
      memberNames: memberNamesRecord,
      membersCount: uniqueMembers.size,
    };

    await set(ref(this.database, `conversations/${conversationId}`), conversation);

    const updatePayload: Record<string, unknown> = {};

    for (const [uid, displayName] of uniqueMembers.entries()) {
      const role: ConversationMemberRole =
        uid === params.currentUserId ? 'owner' : 'member';

      const member: ConversationMember = {
        uid,
        displayName,
        role,
        joinedAt: now,
        addedBy: params.currentUserId,
        canSeeHistoryFrom: uid === params.currentUserId ? 0 : now,
      };

      updatePayload[`conversationMembers/${conversationId}/${uid}`] = member;
      updatePayload[`userConversations/${uid}/${conversationId}`] = {
        conversationId,
        type: 'group',
        title: conversation.title,
        subtitle: conversation.description,
        photoURL: conversation.photoURL,
        updatedAt: now,
        lastMessage: '',
        lastMessageAt: 0,
        lastSenderId: '',
        unreadCount: 0,
        lastReadAt: 0,
        isGroup: true,
      } satisfies UserConversation;
    }

    updatePayload[`conversationMessages/${conversationId}`] = null;

    await update(ref(this.database), updatePayload);

    return conversationId;
  }

  getUserConversations(userId: string): Observable<UserConversation[]> {
    const userConversationsRef = ref(
      this.database,
      `userConversations/${userId}`,
    );

    const orderedQuery = query(userConversationsRef, orderByChild('updatedAt'));

    return listVal<UserConversation>(orderedQuery).pipe(
      map((items) => items ?? []),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getUserConversation(
    userId: string,
    conversationId: string,
  ): Observable<UserConversation | null> {
    const conversationRef = ref(
      this.database,
      `userConversations/${userId}/${conversationId}`,
    );

    return objectVal<UserConversation | null>(conversationRef).pipe(
      map((value) => value ?? null),
      catchError(() => of(null)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getConversation(conversationId: string): Observable<Conversation | null> {
    return objectVal<Conversation | null>(
      ref(this.database, `conversations/${conversationId}`),
    ).pipe(
      map((value) => value ?? null),
      catchError(() => of(null)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getConversationMembers(
    conversationId: string,
  ): Observable<ConversationMember[]> {
    return listVal<ConversationMember>(
      ref(this.database, `conversationMembers/${conversationId}`),
    ).pipe(
      map((members) => members ?? []),
      catchError(() => of([])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async getConversationMember(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMember | null> {
    const snapshot = await get(
      ref(this.database, `conversationMembers/${conversationId}/${userId}`),
    );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val() as ConversationMember;
  }

  markConversationAsRead(
    userId: string,
    conversationId: string,
  ): Observable<void> {
    return from(
      update(
        ref(this.database, `userConversations/${userId}/${conversationId}`),
        {
          unreadCount: 0,
          lastReadAt: Date.now(),
        },
      ),
    );
  }

  async updateConversationSummary(params: {
    conversationId: string;
    senderId: string;
    senderName: string;
    text: string;
  }): Promise<void> {
    const now = Date.now();

    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      throw new Error('La conversación no existe.');
    }

    const conversation = conversationSnapshot.val() as Conversation;
    const memberIds = Object.keys(conversation.memberIds ?? {});

    const updates: Record<string, unknown> = {
      [`conversations/${params.conversationId}/updatedAt`]: now,
    };

    for (const uid of memberIds) {
      const userConversationRef = `userConversations/${uid}/${params.conversationId}`;
      const unreadCountSnapshot = await get(
        ref(this.database, `${userConversationRef}/unreadCount`),
      );
      const currentUnread = unreadCountSnapshot.exists()
        ? Number(unreadCountSnapshot.val())
        : 0;

      updates[`${userConversationRef}/type`] = conversation.type;
      updates[`${userConversationRef}/title`] =
        conversation.type === 'group'
          ? conversation.title
          : uid === params.senderId
            ? ''
            : conversation.memberNames?.[params.senderId] ?? 'Usuario';
      updates[`${userConversationRef}/subtitle`] =
        conversation.type === 'group' ? conversation.description : '';
      updates[`${userConversationRef}/photoURL`] =
        conversation.type === 'group' ? conversation.photoURL : '';
      updates[`${userConversationRef}/updatedAt`] = now;
      updates[`${userConversationRef}/lastMessage`] = params.text;
      updates[`${userConversationRef}/lastMessageAt`] = now;
      updates[`${userConversationRef}/lastSenderId`] = params.senderId;
      updates[`${userConversationRef}/isGroup`] = conversation.type === 'group';

      if (uid === params.senderId) {
        updates[`${userConversationRef}/unreadCount`] = 0;
      } else {
        updates[`${userConversationRef}/unreadCount`] = currentUnread + 1;
      }
    }

    await update(ref(this.database), updates);
  }

  async refreshConversationSummary(params: {
    conversationId: string;
    lastMessageText: string;
    lastMessageAt: number;
    lastSenderId: string;
  }): Promise<void> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      return;
    }

    const conversation = conversationSnapshot.val() as Conversation;
    const memberIds = Object.keys(conversation.memberIds ?? {});
    const updates: Record<string, unknown> = {
      [`conversations/${params.conversationId}/updatedAt`]: params.lastMessageAt,
    };

    for (const uid of memberIds) {
      updates[`userConversations/${uid}/${params.conversationId}/updatedAt`] =
        params.lastMessageAt;
      updates[`userConversations/${uid}/${params.conversationId}/lastMessage`] =
        params.lastMessageText;
      updates[`userConversations/${uid}/${params.conversationId}/lastMessageAt`] =
        params.lastMessageAt;
      updates[`userConversations/${uid}/${params.conversationId}/lastSenderId`] =
        params.lastSenderId;
    }

    await update(ref(this.database), updates);
  }

  async clearConversationSummary(params: {
    conversationId: string;
  }): Promise<void> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      return;
    }

    const conversation = conversationSnapshot.val() as Conversation;
    const memberIds = Object.keys(conversation.memberIds ?? {});
    const now = Date.now();
    const updates: Record<string, unknown> = {};

    for (const uid of memberIds) {
      updates[`userConversations/${uid}/${params.conversationId}/lastMessage`] = '';
      updates[`userConversations/${uid}/${params.conversationId}/lastMessageAt`] = 0;
      updates[`userConversations/${uid}/${params.conversationId}/lastSenderId`] = '';
      updates[`userConversations/${uid}/${params.conversationId}/updatedAt`] = now;
    }

    await update(ref(this.database), updates);
  }

  async updateGroupDetails(params: {
    conversationId: string;
    title: string;
    description: string;
    photoURL: string;
  }): Promise<void> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${params.conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      throw new Error('El grupo no existe.');
    }

    const conversation = conversationSnapshot.val() as Conversation;
    if (conversation.type !== 'group') {
      throw new Error('Solo se pueden editar grupos.');
    }

    const memberIds = Object.keys(conversation.memberIds ?? {});
    const updates: Record<string, unknown> = {
      [`conversations/${params.conversationId}/title`]: params.title.trim(),
      [`conversations/${params.conversationId}/description`]:
        params.description.trim(),
      [`conversations/${params.conversationId}/photoURL`]:
        params.photoURL.trim(),
      [`conversations/${params.conversationId}/updatedAt`]: Date.now(),
    };

    for (const uid of memberIds) {
      updates[`userConversations/${uid}/${params.conversationId}/title`] =
        params.title.trim();
      updates[`userConversations/${uid}/${params.conversationId}/subtitle`] =
        params.description.trim();
      updates[`userConversations/${uid}/${params.conversationId}/photoURL`] =
        params.photoURL.trim();
    }

    await update(ref(this.database), updates);
  }

  addGroupMembers(params: {
    conversationId: string;
    actorId: string;
    actorName: string;
    members: Array<{
      uid: string;
      displayName: string;
    }>;
  }): Observable<void> {
    return from(
      get(ref(this.database, `conversations/${params.conversationId}`)),
    ).pipe(
      switchMap((conversationSnapshot) => {
        if (!conversationSnapshot.exists()) {
          throw new Error('El grupo no existe.');
        }

        const conversation = conversationSnapshot.val() as Conversation;

        if (conversation.type !== 'group') {
          throw new Error('Solo se pueden añadir miembros a grupos.');
        }

        const now = Date.now();
        const updates: Record<string, unknown> = {};
        const memberIds = { ...(conversation.memberIds ?? {}) };
        const memberNames = { ...(conversation.memberNames ?? {}) };

        for (const member of params.members) {
          memberIds[member.uid] = true;
          memberNames[member.uid] = member.displayName;

          const conversationMember: ConversationMember = {
            uid: member.uid,
            displayName: member.displayName,
            role: 'member',
            joinedAt: now,
            addedBy: params.actorId,
            canSeeHistoryFrom: now,
          };

          updates[`conversationMembers/${params.conversationId}/${member.uid}`] =
            conversationMember;

          updates[`userConversations/${member.uid}/${params.conversationId}`] = {
            conversationId: params.conversationId,
            type: 'group',
            title: conversation.title,
            subtitle: conversation.description,
            photoURL: conversation.photoURL,
            updatedAt: now,
            lastMessage: '',
            lastMessageAt: 0,
            lastSenderId: '',
            unreadCount: 0,
            lastReadAt: 0,
            isGroup: true,
          } satisfies UserConversation;
        }

        updates[`conversations/${params.conversationId}/memberIds`] = memberIds;
        updates[`conversations/${params.conversationId}/memberNames`] = memberNames;
        updates[`conversations/${params.conversationId}/membersCount`] =
          Object.keys(memberIds).length;
        updates[`conversations/${params.conversationId}/updatedAt`] = now;

        return from(update(ref(this.database), updates));
      }),
      map(() => void 0),
    );
  }

  removeGroupMember(params: {
    conversationId: string;
    actorId: string;
    targetUserId: string;
  }): Observable<void> {
    return from(
      get(ref(this.database, `conversations/${params.conversationId}`)),
    ).pipe(
      switchMap((conversationSnapshot) => {
        if (!conversationSnapshot.exists()) {
          throw new Error('El grupo no existe.');
        }

        const conversation = conversationSnapshot.val() as Conversation;

        if (conversation.type !== 'group') {
          throw new Error('Solo se pueden quitar miembros de grupos.');
        }

        return from(
          get(
            ref(
              this.database,
              `conversationMembers/${params.conversationId}/${params.targetUserId}`,
            ),
          ),
        ).pipe(
          switchMap((targetMemberSnapshot) => {
            if (!targetMemberSnapshot.exists()) {
              throw new Error('El usuario no pertenece al grupo.');
            }

            const targetMember =
              targetMemberSnapshot.val() as ConversationMember;

            if (targetMember.role === 'owner') {
              throw new Error('No se puede expulsar al creador del grupo.');
            }

            const memberIds = { ...(conversation.memberIds ?? {}) };
            const memberNames = { ...(conversation.memberNames ?? {}) };

            delete memberIds[params.targetUserId];
            delete memberNames[params.targetUserId];

            const now = Date.now();

            return from(
              update(ref(this.database), {
                [`conversations/${params.conversationId}/memberIds`]: memberIds,
                [`conversations/${params.conversationId}/memberNames`]: memberNames,
                [`conversations/${params.conversationId}/membersCount`]:
                  Object.keys(memberIds).length,
                [`conversations/${params.conversationId}/updatedAt`]: now,
                [`conversationMembers/${params.conversationId}/${params.targetUserId}/removedAt`]:
                  now,
                [`conversationMembers/${params.conversationId}/${params.targetUserId}/removedBy`]:
                  params.actorId,
                [`userConversations/${params.targetUserId}/${params.conversationId}`]:
                  null,
              }),
            );
          }),
        );
      }),
      map(() => void 0),
    );
  }

  changeMemberRole(params: {
    conversationId: string;
    targetUserId: string;
    role: ConversationMemberRole;
  }): Observable<void> {
    return from(
      get(
        ref(
          this.database,
          `conversationMembers/${params.conversationId}/${params.targetUserId}`,
        ),
      ),
    ).pipe(
      switchMap((targetMemberSnapshot) => {
        if (!targetMemberSnapshot.exists()) {
          throw new Error('El miembro no existe.');
        }

        const targetMember = targetMemberSnapshot.val() as ConversationMember;

        if (targetMember.role === 'owner') {
          throw new Error('No se puede modificar el rol del creador.');
        }

        return from(
          update(
            ref(
              this.database,
              `conversationMembers/${params.conversationId}/${params.targetUserId}`,
            ),
            {
              role: params.role,
            },
          ),
        );
      }),
      map(() => void 0),
    );
  }

  async deleteGroupConversation(conversationId: string): Promise<void> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      return;
    }

    const conversation = conversationSnapshot.val() as Conversation;
    const memberIds = Object.keys(conversation.memberIds ?? {});
    const updates: Record<string, unknown> = {
      [`conversations/${conversationId}`]: null,
      [`conversationMembers/${conversationId}`]: null,
      [`conversationMessages/${conversationId}`]: null,
    };

    for (const uid of memberIds) {
      updates[`userConversations/${uid}/${conversationId}`] = null;
    }

    await update(ref(this.database), updates);
  }

  async deleteConversationForUser(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversationSnapshot = await get(
      ref(this.database, `conversations/${conversationId}`),
    );

    if (!conversationSnapshot.exists()) {
      await remove(ref(this.database, `userConversations/${userId}/${conversationId}`));
      return;
    }

    const conversation = conversationSnapshot.val() as Conversation;

    if (conversation.type === 'group') {
      throw new Error(
        'Para grupos usa la lógica específica de abandonar o eliminar grupo.',
      );
    }

    await remove(ref(this.database, `userConversations/${userId}/${conversationId}`));

    const allUsersSnapshot = await get(ref(this.database, `userConversations`));

    if (!allUsersSnapshot.exists()) {
      return;
    }

    const userConversations = allUsersSnapshot.val() as Record<
      string,
      Record<string, unknown>
    >;

    const stillReferenced = Object.values(userConversations).some(
      (conversations) => !!conversations?.[conversationId],
    );

    if (!stillReferenced) {
      await Promise.all([
        remove(ref(this.database, `conversations/${conversationId}`)),
        remove(ref(this.database, `conversationMessages/${conversationId}`)),
        remove(ref(this.database, `conversationMembers/${conversationId}`)),
      ]);
    }
  }

  
}
