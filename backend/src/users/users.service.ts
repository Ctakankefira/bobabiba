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

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async create(data: {
    telegramId?: string;
    username?: string;
    role?: 'CLIENT' | 'MASTER';
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  async updateIdentity(
    id: string,
    data: {
      telegramId?: string;
      username?: string;
      role?: 'CLIENT' | 'MASTER';
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
