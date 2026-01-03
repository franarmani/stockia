import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { User } from '../../entities/user.entity';
import { Company } from '../../entities/company.entity';
import { RegisterDto, LoginDto, AuthResponseDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new company with admin user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, company_name, company_subdomain, ...userData } =
      registerDto;

    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Este email ya está registrado');
    }

    // Check if subdomain already exists
    const existingCompany = await this.companiesRepository.findOne({
      where: { subdomain: company_subdomain },
    });
    if (existingCompany) {
      throw new BadRequestException('Este subdominio ya está en uso');
    }

    // Create company
    const companyId = uuid();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    const company = this.companiesRepository.create({
      id: companyId,
      name: company_name,
      subdomain: company_subdomain,
      slug: this.createSlug(company_subdomain),
      category: userData.category || 'general',
      subscription_plan: 'free',
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt,
      email: email,
      is_active: true,
    });

    await this.companiesRepository.save(company);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create admin user
    const userId = uuid();
    const user = this.usersRepository.create({
      id: userId,
      company_id: companyId,
      email,
      password_hash: passwordHash,
      first_name: userData.first_name || 'Admin',
      last_name: userData.last_name || '',
      role: 'admin',
      is_active: true,
      email_verified: false, // TODO: Email verification
    });

    await this.usersRepository.save(user);

    // Generate tokens
    const tokens = this.generateTokens(user, company);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      company: {
        id: company.id,
        name: company.name,
        subdomain: company.subdomain,
        subscription_plan: company.subscription_plan,
        subscription_status: company.subscription_status,
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: ['company'],
    });

    if (!user) {
      throw new UnauthorizedException('Email o contraseña inválidos');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email o contraseña inválidos');
    }

    // Check if company is active
    if (!user.company.is_active) {
      throw new UnauthorizedException('Esta empresa no está activa');
    }

    // Update last login
    user.last_login = new Date();
    await this.usersRepository.save(user);

    // Generate tokens
    const tokens = this.generateTokens(user, user.company);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        subdomain: user.company.subdomain,
        subscription_plan: user.company.subscription_plan,
        subscription_status: user.company.subscription_status,
      },
    };
  }

  /**
   * Generate JWT tokens (access + refresh)
   */
  private generateTokens(user: User, company: Company) {
    const payload = {
      sub: user.id,
      company_id: company.id,
      email: user.email,
      role: user.role,
    };

    // Access token: 15 minutes
    const token = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Refresh token: 7 days
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    });

    return { token, refreshToken };
  }

  /**
   * Validate JWT token
   */
  async validateUser(userId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id: userId },
      relations: ['company'],
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });

      const user = await this.usersRepository.findOne({
        where: { id: decoded.sub },
        relations: ['company'],
      });

      if (!user || !user.is_active || !user.company.is_active) {
        throw new UnauthorizedException('Usuario o empresa inactivos');
      }

      const payload = {
        sub: user.id,
        company_id: user.company.id,
        email: user.email,
        role: user.role,
      };

      const token = this.jwtService.sign(payload, {
        expiresIn: '15m',
      });

      return { token };
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  /**
   * Create URL-friendly slug from subdomain
   */
  private createSlug(subdomain: string): string {
    return subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
}
