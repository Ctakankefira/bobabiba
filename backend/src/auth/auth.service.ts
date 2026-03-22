import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateTelegramInitData(initData: string) {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN || '').digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) {
      throw new Error('Invalid initData');
    }
    const userData = JSON.parse(params.get('user') || '{}');
    const telegramId = userData.id.toString();
    let dbUser = await this.usersService.findByTelegramId(telegramId);
    if (!dbUser) {
      dbUser = await this.usersService.create({ telegramId, role: 'CLIENT' });
    }
    const payload = { sub: dbUser.id, telegramId, role: dbUser.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: dbUser,
    };
  }
}