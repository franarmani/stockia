import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password debe contener al menos una mayúscula, minúscula y número',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  company_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Subdomain solo puede contener letras minúsculas, números y guiones',
  })
  company_subdomain: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  category: string;

  @IsString()
  @IsOptional()
  first_name: string;

  @IsString()
  @IsOptional()
  last_name: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class AuthResponseDto {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  company: {
    id: string;
    name: string;
    subdomain: string;
    subscription_plan: string;
    subscription_status: string;
  };
}
