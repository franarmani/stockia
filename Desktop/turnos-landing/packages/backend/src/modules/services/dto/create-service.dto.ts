import { IsString, IsOptional, IsInteger, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInteger()
  @Min(5)
  @Max(480)
  duration_minutes: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ServiceResponseDto {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: Date;
}
