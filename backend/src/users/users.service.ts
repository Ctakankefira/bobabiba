import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        master: true,
      },
    });

    if (!user) {
      return null;
    }

    const clientRatingAggregate = await this.prisma.booking.aggregate({
      where: {
        clientId: id,
        clientRating: {
          not: null,
        },
      },
      _avg: {
        clientRating: true,
      },
    });

    return {
      ...user,
      clientRatingAverage: clientRatingAggregate._avg.clientRating ?? 0,
    };
  }

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
    displayName?: string;
    age?: number;
    avatarUrl?: string;
    isAdmin?: boolean;
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
      displayName?: string;
      age?: number;
      avatarUrl?: string;
      isAdmin?: boolean;
      role?: 'CLIENT' | 'MASTER';
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateRole(id: string, role: 'CLIENT' | 'MASTER') {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      include: {
        master: true,
      },
    });
  }

  async updateProfile(id: string, data: { displayName?: string; age?: number | null }) {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        master: true,
      },
    });

    const clientRatingAggregate = await this.prisma.booking.aggregate({
      where: {
        clientId: id,
        clientRating: {
          not: null,
        },
      },
      _avg: {
        clientRating: true,
      },
    });

    return {
      ...user,
      clientRatingAverage: clientRatingAggregate._avg.clientRating ?? 0,
    };
  }

  async updateRegistrationProfile(
    id: string,
    data: {
      displayName?: string;
      age?: number | null;
      role?: 'CLIENT' | 'MASTER';
      avatarUrl?: string | null;
      isAdmin?: boolean;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        master: true,
      },
    });
  }

  async setAdmin(id: string, isAdmin: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isAdmin },
      include: {
        master: true,
      },
    });
  }
}
