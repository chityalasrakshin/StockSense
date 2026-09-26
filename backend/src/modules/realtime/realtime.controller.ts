import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('events')
  events() {
    return this.realtime.events().pipe(
      map((event): MessageEvent => ({ type: event.type, data: event.data })),
    );
  }
}
