import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
  ],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = new FormControl<'login' | 'register'>('login', {
    nonNullable: true,
  });

  readonly emailInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  readonly passwordInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  });

  readonly usernameInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  readonly displayNameInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });

  errorMessage = '';
  isSubmitting = false;

  ngOnInit(): void {
    this.resetForm();
  }

  async submit(): Promise<void> {
    if (this.isSubmitting) return;

    this.errorMessage = '';

    if (!this.emailInput.valid || !this.passwordInput.valid) {
      this.errorMessage = 'Revisa email y contraseña.';
      return;
    }

    if (this.mode.value === 'register') {
      if (!this.usernameInput.valid || !this.displayNameInput.valid) {
        this.errorMessage = 'Revisa username y nombre visible.';
        return;
      }
    }

    this.isSubmitting = true;

    try {
      if (this.mode.value === 'login') {
        await this.authService.loginWithEmail(
          this.emailInput.getRawValue(),
          this.passwordInput.getRawValue(),
        );
      } else {
        await this.authService.registerWithEmail({
          email: this.emailInput.getRawValue(),
          password: this.passwordInput.getRawValue(),
          username: this.usernameInput.getRawValue(),
          displayName: this.displayNameInput.getRawValue(),
        });
      }

      this.resetForm();
      await this.router.navigate(['/chat']);
    } catch (error) {
      console.error('Error en submit:', error);
      this.errorMessage = this.getReadableErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    if (this.isSubmitting) return;

    this.errorMessage = '';
    this.isSubmitting = true;

    try {
      await this.authService.loginWithGoogle();
      this.resetForm();
      await this.router.navigate(['/chat']);
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string };

      if (firebaseError?.code === 'auth/popup-closed-by-user') {
        this.errorMessage = 'Has cancelado el inicio de sesión con Google.';
        this.isSubmitting = false;
        return;
      }

      console.error('Error en login con Google:', error);
      this.errorMessage = this.getReadableErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private getReadableErrorMessage(error: unknown): string {
    const firebaseError = error as { code?: string; message?: string };

    switch (firebaseError?.code) {
      case 'auth/email-already-in-use':
        return 'Ese email ya está registrado.';
      case 'auth/invalid-credential':
        return 'Las credenciales no son correctas.';
      case 'auth/popup-closed-by-user':
        return 'Has cancelado el inicio de sesión con Google.';
      case 'auth/account-exists-with-different-credential':
        return 'Ese email ya existe con otro método de acceso.';
      default:
        if (firebaseError?.message?.includes('nombre de usuario ya está en uso')) {
          return 'Ese nombre de usuario ya está en uso.';
        }

        if (firebaseError?.message?.includes('perfil del usuario no existe')) {
          return 'El usuario ha iniciado sesión, pero su perfil no existe en la base de datos.';
        }

        return firebaseError?.message ?? 'Ha ocurrido un error inesperado.';
    }
  }

  private resetForm(): void {
    this.mode.setValue('login');
    this.emailInput.reset('');
    this.passwordInput.reset('');
    this.usernameInput.reset('');
    this.displayNameInput.reset('');
    this.emailInput.markAsPristine();
    this.passwordInput.markAsPristine();
    this.usernameInput.markAsPristine();
    this.displayNameInput.markAsPristine();
    this.emailInput.markAsUntouched();
    this.passwordInput.markAsUntouched();
    this.usernameInput.markAsUntouched();
    this.displayNameInput.markAsUntouched();
    this.errorMessage = '';
    this.isSubmitting = false;
  }
}