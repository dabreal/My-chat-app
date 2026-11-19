import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/services/users.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const usersService = inject(UsersService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    switchMap((user) => {
      if (!user) {
        return of(router.createUrlTree(['/login']));
      }

      return usersService.getUserById$(user.uid).pipe(
        map((profile) => {
          if (!profile || profile.isDeleted) {
            return router.createUrlTree(['/login']);
          }

          return true;
        }),
      );
    }),
  );
};