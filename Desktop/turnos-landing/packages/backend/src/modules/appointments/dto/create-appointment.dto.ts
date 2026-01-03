import { IsString, IsEmail, IsPhoneNumber, IsUUID, IsOptional, IsDateString, IsDecimal } from 'class-validator';

export class CreateAppointmentPublicDto {
  @IsUUID()
  service_id: string;

  @IsUUID()
  employee_id: string;

  @IsDateString()
  start_time: string; // ISO 8601

  @IsString()
  client_name: string;

  @IsEmail()
  client_email: string;

  @IsPhoneNumber('ZZ') // Any country code
  client_phone: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;
}

export class AppointmentResponseDto {
  id: string;
  company_id: string;
  employee_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  service_name: string;
  service_duration: number;
  service_price: number;
  start_time: Date;
  end_time: Date;
  status: string;
  notes?: string;
  paid: boolean;
  created_at: Date;
}
