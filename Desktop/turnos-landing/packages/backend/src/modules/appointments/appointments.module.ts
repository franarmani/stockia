import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../../entities/appointment.entity';
import { Service } from '../../entities/service.entity';
import { CompanySchedule } from '../../entities/company-schedule.entity';
import { Company } from '../../entities/company.entity';
import { User } from '../../entities/user.entity';
import { AppointmentsService } from './appointments.service';
import { PublicAppointmentsController } from './appointments.controller';
import { ProtectedAppointmentsController } from './protected-appointments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Service,
      CompanySchedule,
      Company,
      User,
    ]),
  ],
  controllers: [PublicAppointmentsController, ProtectedAppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
