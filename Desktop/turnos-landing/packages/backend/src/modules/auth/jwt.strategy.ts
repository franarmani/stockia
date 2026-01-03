import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-key',
    });
  }

  async validate(payload: any) {
    // payload contiene: { sub, company_id, email, role, iat, exp }
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      return null;
    }

    // Retornar el usuario con company_id para multi-tenancy
    return {
      id: user.id,
      email: user.email,
      company_id: user.company_id,
      role: user.role,
      user: user,
    };
  }
}
