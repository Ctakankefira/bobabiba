import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async create(data: { telegramId: string; role?: 'CLIENT' | 'MASTER' }) {
    return this.prisma.user.create({
      data,
    });
  }
}