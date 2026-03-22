import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MastersFilters = {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
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
}
