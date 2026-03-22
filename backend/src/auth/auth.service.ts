import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateTelegramInitData(initData: string) {
    if (!initData) {
      throw new BadRequestException('initData is required');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('Telegram hash is missing');
    }

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const botToken = this.configService.get<string>('BOT_TOKEN');
    if (!botToken) {
      throw new InternalServerErrorException('BOT_TOKEN is not configured');
    }

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new UnauthorizedException('Invalid Telegram initData');
    }

    const authDate = Number(params.get('auth_date'));
    const maxAgeSeconds = 60 * 60 * 24;
    if (!authDate || Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) {
      throw new UnauthorizedException('Telegram initData is expired');
    }

    const rawUser = params.get('user');
    if (!rawUser) {
      throw new BadRequestException('Telegram user payload is missing');
    }

    let userData: { id?: number; first_name?: string; last_name?: string; username?: string };
    try {
      userData = JSON.parse(rawUser);
    } catch {
      throw new BadRequestException('Telegram user payload is invalid');
    }

    if (!userData.id) {
      throw new BadRequestException('Telegram user id is missing');
    }

    const telegramId = String(userData.id);
    let dbUser = await this.usersService.findByTelegramId(telegramId);
    if (!dbUser) {
      dbUser = await this.usersService.create({ telegramId, role: 'CLIENT' });
    }
    const payload = { sub: dbUser.id, telegramId, role: dbUser.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...dbUser,
        firstName: userData.first_name || null,
        lastName: userData.last_name || null,
        username: userData.username || null,
      },
    };
  }
}
