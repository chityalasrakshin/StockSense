import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER } from './email.interface';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const providerType = configService.get<string>('EMAIL_PROVIDER', 'console');
        if (providerType === 'smtp') {
          return new SmtpEmailProvider(configService);
        }
        return new ConsoleEmailProvider();
      },
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService, EMAIL_PROVIDER],
})
export class EmailModule {}
