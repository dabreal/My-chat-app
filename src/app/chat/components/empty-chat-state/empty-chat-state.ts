import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-empty-chat-state',
  imports: [],
  templateUrl: './empty-chat-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyChatState {}
