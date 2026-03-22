import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MastersFilters = {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
};

type CreateMasterInput = {
  username: string;
  name: string;
  description?: string;
  category: string;
  priceMin?: number;
  priceMax?: number;
  services?: Array<{
    name: string;
    description?: string;
    price: number;
    duration: number;
  }>;
  photos?: Array<{
    url: string;
    alt?: string;
  }>;
};

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: MastersFilters) {
    return this.prisma.master.findMany({
      where: {
        ...(filters.category
          ? { category: { equals: filters.category, mode: 'insensitive' } }
          : {}),
        ...(filters.priceMin !== undefined
          ? {
              OR: [
                { priceMin: { gte: filters.priceMin } },
                { priceMax: { gte: filters.priceMin } },
              ],
            }
          : {}),
        ...(filters.priceMax !== undefined
          ? {
              AND: [
                {
                  OR: [
                    { priceMin: null },
                    { priceMin: { lte: filters.priceMax } },
                  ],
                },
              ],
            }
          : {}),
        ...(filters.rating !== undefined ? { rating: { gte: filters.rating } } : {}),
      },
      include: {
        services: {
          orderBy: { createdAt: 'asc' },
        },
        photos: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    return this.prisma.master.findUnique({
      where: { id },
      include: {
        services: {
          orderBy: { createdAt: 'asc' },
        },
        photos: {
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(input: CreateMasterInput) {
    return this.prisma.$transaction(async (tx) => {
      const normalizedUsername = input.username.trim().replace(/^@+/, '').toLowerCase();

      const existingUser = await tx.user.findUnique({
        where: { username: normalizedUsername },
        include: { master: true },
      });

      if (existingUser?.master) {
        throw new Error('MASTER_ALREADY_EXISTS');
      }

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            username: normalizedUsername,
            role: 'MASTER',
          },
        }));

      if (existingUser && existingUser.role !== 'MASTER') {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { role: 'MASTER', username: normalizedUsername },
        });
      }

      return tx.master.create({
        data: {
          userId: user.id,
          name: input.name,
          description: input.description,
          category: input.category,
          priceMin: input.priceMin,
          priceMax: input.priceMax,
          services: input.services?.length
            ? {
                create: input.services.map((service) => ({
                  name: service.name,
                  description: service.description,
                  price: service.price,
                  duration: service.duration,
                })),
              }
            : undefined,
          photos: input.photos?.length
            ? {
                create: input.photos.map((photo) => ({
                  url: photo.url,
                  alt: photo.alt,
                })),
              }
            : undefined,
        },
        include: {
          services: {
            orderBy: { createdAt: 'asc' },
          },
          photos: {
            orderBy: { createdAt: 'asc' },
          },
          user: true,
        },
      });
    });
  }
}
