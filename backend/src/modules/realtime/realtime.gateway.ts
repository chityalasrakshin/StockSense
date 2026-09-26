import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Subscription } from 'rxjs';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({ namespace: '/dashboard', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private subscription?: Subscription;
  private readonly logger = new Logger(RealtimeGateway.name);
  constructor(private readonly realtime: RealtimeService) {}
  onModuleInit() {
    this.subscription = this.realtime.events().subscribe((event) => this.server?.emit(event.type, event.data));
    this.logger.log('Socket.IO dashboard gateway ready');
  }
  onModuleDestroy() { this.subscription?.unsubscribe(); }
}
