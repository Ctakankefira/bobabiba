import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';

class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  initData!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async telegramAuth(@Body() body: TelegramAuthDto) {
    return this.authService.validateTelegramInitData(body.initData);
  }
}
