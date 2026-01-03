import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { RegisterDto, LoginDto, AuthResponseDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new company and admin user' })
  @ApiResponse({
    status: 201,
    description: 'Company and user created successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Email or subdomain already exists',
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      if (
        error.message.includes('email') ||
        error.message.includes('subdomain')
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('invalid')) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'New access token generated',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refresh(@Body('refreshToken') refreshToken: string): Promise<{ accessToken: string }> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token required');
    }

    const accessToken = await this.authService.refreshToken(refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
  })
  async logout(@Req() req: Request): Promise<{ message: string }> {
    // En una app real, aquí invalidaríamos el token (ej. agregarlo a una blacklist en Redis)
    return { message: 'Logout successful' };
  }
}
