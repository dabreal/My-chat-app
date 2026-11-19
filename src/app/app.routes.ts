import { Routes } from '@angular/router';
import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/pages/login-page/login-page').then(
        (m) => m.LoginPage,
      ),
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./chat/pages/conversations-page/conversations-page').then(
        (m) => m.ConversationsPage,
      ),
  },
  {
    path: 'chat/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./chat/pages/new-conversation-page/new-conversation-page').then(
        (m) => m.NewConversationPage,
      ),
  },
  {
    path: 'chat/:conversationId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./chat/pages/conversations-page/conversations-page').then(
        (m) => m.ConversationsPage,
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./users/pages/profile-page/profile-page').then(
        (m) => m.ProfilePage,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
];