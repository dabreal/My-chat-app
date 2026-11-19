import { inject, Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  user,
  type User,
  type UserCredential,
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

import { UserProfile } from '../../users/models/user-profile.model';
import { UsersService } from '../../users/services/users.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly usersService = inject(UsersService);

  readonly currentUser$: Observable<User | null> = user(this.auth);

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  async loginWithGoogle(): Promise<UserProfile> {
    const userCredential = await signInWithPopup(
      this.auth,
      new GoogleAuthProvider(),
    );

    if (!userCredential.user.email) {
      throw new Error('No se ha podido obtener el email del usuario.');
    }

    const existingProfile = await this.usersService.getUserById(
      userCredential.user.uid,
    );

    if (existingProfile) {
      if (existingProfile.isDeleted) {
        await signOut(this.auth);
        throw new Error(
          'Esta cuenta fue eliminada. Contacta con soporte si necesitas recuperarla.',
        );
      }

      return existingProfile;
    }

    const fallbackUsername = userCredential.user.email.split('@')[0];

    return this.usersService.createUserProfile(
      userCredential.user.uid,
      userCredential.user.email,
      fallbackUsername,
      userCredential.user.displayName ?? fallbackUsername,
      userCredential.user.photoURL,
    );
  }

  async loginWithEmail(
    email: string,
    password: string,
  ): Promise<UserProfile> {
    const userCredential = await signInWithEmailAndPassword(
      this.auth,
      email.trim(),
      password,
    );

    const userProfile = await this.usersService.getUserById(
      userCredential.user.uid,
    );

    if (!userProfile) {
      throw new Error('El perfil del usuario no existe en la base de datos.');
    }

    if (userProfile.isDeleted) {
      await signOut(this.auth);
      throw new Error(
        'Esta cuenta fue eliminada. Contacta con soporte si necesitas recuperarla.',
      );
    }

    return userProfile;
  }

  async registerWithEmail(params: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }): Promise<UserProfile> {
    const userCredential = await createUserWithEmailAndPassword(
      this.auth,
      params.email.trim(),
      params.password,
    );

    await updateProfile(userCredential.user, {
      displayName: params.displayName.trim(),
    });

    return this.usersService.createUserProfile(
      userCredential.user.uid,
      params.email,
      params.username,
      params.displayName,
      userCredential.user.photoURL,
    );
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  async deleteCurrentAuthUser(): Promise<void> {
    if (!this.auth.currentUser) {
      return;
    }

    await deleteUser(this.auth.currentUser);
  }
}