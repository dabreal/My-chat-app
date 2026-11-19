import { inject, Injectable } from '@angular/core';
import {
  Database,
  equalTo,
  get,
  listVal,
  orderByChild,
  query,
  ref,
  set,
  update,
} from '@angular/fire/database';
import { from, map, Observable, shareReplay } from 'rxjs';

import { UserProfile } from '../models/user-profile.model';
import { Message } from '../../chat/models/message.model';

export const DELETED_USER_DISPLAY_NAME = 'Usuario eliminado';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly database = inject(Database);
  private readonly usersRef = ref(this.database, 'users');

  getUsers(): Observable<UserProfile[]> {
    return listVal<UserProfile>(this.usersRef).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  getActiveUsers(): Observable<UserProfile[]> {
    return this.getUsers().pipe(
      map((users) => users.filter((user) => !user.isDeleted)),
    );
  }

  getOtherUsers(currentUserId: string): Observable<UserProfile[]> {
    return this.getUsers().pipe(
      map((users) =>
        users.filter((user) => user.uid !== currentUserId && !user.isDeleted),
      ),
    );
  }

  getUserById$(uid: string): Observable<UserProfile | null> {
    return from(get(ref(this.database, `users/${uid}`))).pipe(
      map((userSnapshot) => {
        if (!userSnapshot.exists()) {
          return null;
        }

        return userSnapshot.val() as UserProfile;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async getUserById(uid: string): Promise<UserProfile | null> {
    return new Promise((resolve, reject) => {
      this.getUserById$(uid).subscribe({
        next: resolve,
        error: reject,
      });
    });
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    const usernameQuery = query(
      this.usersRef,
      orderByChild('username'),
      equalTo(username.toLowerCase()),
    );

    const snapshot = await get(usernameQuery);

    if (!snapshot.exists()) {
      return null;
    }

    const usersRecord = snapshot.val() as Record<string, UserProfile>;
    const firstUser = Object.values(usersRecord)[0];

    return firstUser ?? null;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const existingUser = await this.getUserByUsername(username);

    return !existingUser;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    await set(ref(this.database, `users/${profile.uid}`), profile);
  }

  async createUserProfile(
    uid: string,
    email: string,
    username: string,
    displayName: string,
    photoURL: string | null = null,
  ): Promise<UserProfile> {
    const normalizedUsername = username.trim().toLowerCase();
    const timestamp = Date.now();

    const usernameAvailable = await this.isUsernameAvailable(normalizedUsername);

    if (!usernameAvailable) {
      throw new Error('El nombre de usuario ya está en uso.');
    }

    const profile: UserProfile = {
      uid,
      username: normalizedUsername,
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      photoURL,
      bio: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      isDeleted: false,
      deletedAt: null,
    };

    await this.saveUserProfile(profile);

    return profile;
  }

  async updateProfile(
    uid: string,
    data: Partial<Pick<UserProfile, 'username' | 'displayName' | 'photoURL' | 'bio'>>,
  ): Promise<void> {
    const currentProfile = await this.getUserById(uid);

    if (!currentProfile) {
      throw new Error('No se ha encontrado el perfil del usuario.');
    }

    if (currentProfile.isDeleted) {
      throw new Error('No se puede editar un usuario eliminado.');
    }

    let nextUsername = currentProfile.username;

    if (data.username && data.username.trim().toLowerCase() !== currentProfile.username) {
      nextUsername = data.username.trim().toLowerCase();

      const usernameAvailable = await this.isUsernameAvailable(nextUsername);

      if (!usernameAvailable) {
        throw new Error('El nombre de usuario ya está en uso.');
      }
    }

    const updatedProfile: UserProfile = {
      ...currentProfile,
      username: nextUsername,
      displayName: data.displayName?.trim() ?? currentProfile.displayName,
      photoURL: data.photoURL ?? currentProfile.photoURL,
      bio: data.bio ?? currentProfile.bio,
      updatedAt: Date.now(),
    };

    await this.saveUserProfile(updatedProfile);
  }

  async anonymizeUserAccount(uid: string): Promise<void> {
    const userSnapshot = await get(ref(this.database, `users/${uid}`));

    if (!userSnapshot.exists()) {
      throw new Error('No se ha encontrado el perfil del usuario.');
    }

    const currentProfile = userSnapshot.val() as UserProfile;
    const now = Date.now();
    const updates: Record<string, unknown> = {};

    const deletedProfile: UserProfile = {
      ...currentProfile,
      username: `deleted_${uid.slice(0, 8)}`,
      displayName: DELETED_USER_DISPLAY_NAME,
      email: `deleted+${uid}@deleted.local`,
      photoURL: null,
      bio: null,
      updatedAt: now,
      isDeleted: true,
      deletedAt: now,
    };

    updates[`users/${uid}`] = deletedProfile;

    const userConversationsSnapshot = await get(
      ref(this.database, `userConversations/${uid}`),
    );

    const userConversations = userConversationsSnapshot.exists()
      ? (userConversationsSnapshot.val() as Record<string, unknown>)
      : {};

    const conversationIds = Object.keys(userConversations);

    for (const conversationId of conversationIds) {
      const conversationSnapshot = await get(
        ref(this.database, `conversations/${conversationId}`),
      );

      if (!conversationSnapshot.exists()) {
        continue;
      }

      const conversation = conversationSnapshot.val() as {
        type?: 'direct' | 'group';
        memberIds?: Record<string, boolean>;
      };

      const memberIds = Object.keys(conversation.memberIds ?? {});

      updates[`conversations/${conversationId}/memberNames/${uid}`] =
        DELETED_USER_DISPLAY_NAME;
      updates[`conversationMembers/${conversationId}/${uid}/displayName`] =
        DELETED_USER_DISPLAY_NAME;

      if (conversation.type === 'direct') {
        const otherUserId = memberIds.find((memberId) => memberId !== uid);

        if (otherUserId) {
          updates[`userConversations/${otherUserId}/${conversationId}/title`] =
            DELETED_USER_DISPLAY_NAME;
          updates[
            `userConversations/${otherUserId}/${conversationId}/otherUserName`
          ] = DELETED_USER_DISPLAY_NAME;
          updates[
            `userConversations/${otherUserId}/${conversationId}/otherUserPhotoURL`
          ] = null;
        }
      }

      const messagesSnapshot = await get(
        ref(this.database, `conversationMessages/${conversationId}`),
      );

      if (!messagesSnapshot.exists()) {
        continue;
      }

      const messages = messagesSnapshot.val() as Record<string, Message>;

      for (const [messageId, message] of Object.entries(messages)) {
        if (message.senderId !== uid) {
          continue;
        }

        updates[
          `conversationMessages/${conversationId}/${messageId}/senderName`
        ] = DELETED_USER_DISPLAY_NAME;
      }
    }

    updates[`userConversations/${uid}`] = null;

    await update(ref(this.database), updates);
  }
}
