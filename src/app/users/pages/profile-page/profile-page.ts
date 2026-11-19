import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController,
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone'; 
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { UsersService } from '../../services/users.service';



@Component({
  selector: 'app-profile-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
    IonNote,
    IonAvatar,
    IonChip,
    IonCard,
    IonCardContent
],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly usernameInput = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(3),
      Validators.pattern(/^[a-z0-9._-]{3,30}$/),
    ],
  });

  readonly displayNameInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(40)],
  });

  readonly photoURLInput = new FormControl('', {
    nonNullable: true,
  });

  readonly bioInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(180)],
  });

  email = '';
  createdAt = 0;

  errorMessage = '';
  successMessage = '';
  isLoading = true;
  isSubmitting = false;
  isDeleting = false;

  private currentUserId = '';

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async saveProfile(): Promise<void> {
    if (this.isSubmitting || this.isLoading || !this.currentUserId) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.usernameInput.markAsTouched();
    this.displayNameInput.markAsTouched();
    this.bioInput.markAsTouched();

    if (!this.usernameInput.valid || !this.displayNameInput.valid || !this.bioInput.valid) {
      this.errorMessage = 'Revisa los campos del perfil.';
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    try {
      await this.usersService.updateProfile(this.currentUserId, {
        username: this.usernameInput.getRawValue(),
        displayName: this.displayNameInput.getRawValue(),
        photoURL: this.photoURLInput.getRawValue().trim() || null,
        bio: this.bioInput.getRawValue().trim() || null,
      });

      this.successMessage = 'Perfil actualizado correctamente.';
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      const appError = error as { message?: string };
      this.errorMessage = appError.message ?? 'No se ha podido actualizar el perfil.';
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  async confirmDeleteAccount(): Promise<void> {
    if (this.isDeleting || !this.currentUserId) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar cuenta',
      message:
        'Se anonimizarán tus datos y tus mensajes se conservarán como "Usuario eliminado". Esta acción no se puede deshacer.',
      inputs: [
        {
          name: 'confirmation',
          type: 'text',
          placeholder: 'Escribe ELIMINAR para confirmar',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async (data) => {
            const confirmation = String(data?.confirmation ?? '').trim().toUpperCase();

            if (confirmation !== 'ELIMINAR') {
              this.errorMessage = 'Debes escribir ELIMINAR para confirmar.';
              this.cdr.markForCheck();
              return false;
            }

            await this.deleteAccount();
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  private async deleteAccount(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.isDeleting = true;
    this.cdr.markForCheck();

    try {
      await this.usersService.anonymizeUserAccount(this.currentUserId);

      try {
        await this.authService.deleteCurrentAuthUser();
      } catch (error) {
        console.warn('No se pudo eliminar el usuario en Firebase Auth:', error);
      }

      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      const appError = error as { message?: string };
      this.errorMessage = appError.message ?? 'No se ha podido eliminar la cuenta.';
    } finally {
      this.isDeleting = false;
      this.cdr.markForCheck();
    }
  }

  private async loadProfile(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    try {
      const authUser = await firstValueFrom(this.authService.currentUser$);

      if (!authUser) {
        await this.router.navigate(['/login']);
        return;
      }

      this.currentUserId = authUser.uid;

      const profile = await this.usersService.getUserById(authUser.uid);

      if (!profile || profile.isDeleted) {
        await this.authService.logout();
        await this.router.navigate(['/login']);
        return;
      }

      this.email = profile.email;
      this.createdAt = profile.createdAt;
      this.usernameInput.setValue(profile.username ?? '');
      this.displayNameInput.setValue(profile.displayName ?? '');
      this.photoURLInput.setValue(profile.photoURL ?? '');
      this.bioInput.setValue(profile.bio ?? '');

      this.usernameInput.markAsPristine();
      this.displayNameInput.markAsPristine();
      this.photoURLInput.markAsPristine();
      this.bioInput.markAsPristine();
    } catch (error) {
      console.error('Error cargando perfil:', error);
      this.errorMessage = 'No se ha podido cargar el perfil.';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }


async editPhoto(): Promise<void> {
  const alert = await this.alertController.create({
    header: 'Editar foto de perfil',
    inputs: [
      {
        name: 'photoURL',
        type: 'text',
        value: this.photoURLInput.getRawValue(),
        placeholder: 'https://...',
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
          const photoURL =
            typeof data?.photoURL === 'string'
              ? data.photoURL.trim()
              : '';

          this.photoURLInput.setValue(photoURL);
          this.photoURLInput.markAsDirty();
          this.errorMessage = '';
          this.successMessage = '';
          this.cdr.markForCheck();

          return true;
        },
      },
    ],
  });

  await alert.present();
}

getInitials(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      return 'U';
    }

    return normalized
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
