import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ServicesModule } from './modules/services/services.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ClientsModule } from './modules/clients/clients.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        synchronize: false, // Usar migrations en producción
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    AuthModule,
    CompaniesModule,
    UsersModule,
    AppointmentsModule,
    ServicesModule,
    EmployeesModule,
    ClientsModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
