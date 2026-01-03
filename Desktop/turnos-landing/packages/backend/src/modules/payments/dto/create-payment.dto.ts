import { IsString, IsNumber, IsOptional, IsEmail, IsPhoneNumber } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  appointment_id: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string; // 'ARS', 'BRL', 'CLP'

  @IsString()
  @IsEmail()
  payer_email: string;

  @IsString()
  payer_name: string;

  @IsPhoneNumber('ZZ', { message: 'Invalid phone number' })
  payer_phone: string;

  @IsString()
  description: string;

  @IsString()
  payment_method: string; // 'credit_card', 'debit_card', 'bank_transfer'
}

export class PaymentResponseDto {
  id: string;
  appointment_id: string;
  status: string; // 'pending', 'approved', 'rejected', 'refunded'
  amount: number;
  currency: string;
  transaction_id?: string;
  payment_link?: string;
  created_at: Date;
}
