import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({ controllers: [RealtimeController], providers: [RealtimeService, RealtimeGateway] })
export class RealtimeModule {}
