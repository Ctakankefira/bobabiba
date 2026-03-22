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

type UpsertOwnMasterInput = {
  name: string;
  avatarUrl?: string;
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

  private withAvatar<
    T extends {
      user?: { avatarUrl?: string | null } | null;
    },
  >(master: T | null) {
    if (!master) {
      return null;
    }

    const { user, ...rest } = master;

    return {
      ...rest,
      avatarUrl: user?.avatarUrl ?? null,
    };
  }

  async findAll(filters: MastersFilters) {
    const masters = await this.prisma.master.findMany({
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
        user: true,
        services: {
          orderBy: { createdAt: 'asc' },
        },
        photos: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    });

    return masters.map((master) => this.withAvatar(master));
  }

  async findOne(id: string) {
    const master = await this.prisma.master.findUnique({
      where: { id },
      include: {
        user: true,
        services: {
          orderBy: { createdAt: 'asc' },
        },
        photos: {
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            client: true,
            booking: {
              include: {
                service: true,
              },
            },
          },
        },
      },
    });

    return this.withAvatar(master);
  }

  async findMine(userId: string) {
    const master = await this.prisma.master.findUnique({
      where: { userId },
      include: {
        user: true,
        services: {
          orderBy: { createdAt: 'asc' },
        },
        photos: {
          orderBy: { createdAt: 'asc' },
        },
        bookings: {
          orderBy: { date: 'desc' },
          include: {
            client: true,
            service: true,
          },
        },
      },
    });

    return this.withAvatar(master);
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

      const master = await tx.master.create({
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

      return this.withAvatar(master);
    });
  }

  async upsertMine(userId: string, input: UpsertOwnMasterInput) {
    return this.prisma.$transaction(async (tx) => {
      const existingMaster = await tx.master.findUnique({
        where: { userId },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          role: 'MASTER',
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
        },
      });

      if (existingMaster) {
        await tx.service.deleteMany({
          where: { masterId: existingMaster.id },
        });

        await tx.photo.deleteMany({
          where: { masterId: existingMaster.id },
        });

        const master = await tx.master.update({
          where: { id: existingMaster.id },
          data: {
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
            bookings: {
              orderBy: { date: 'desc' },
              include: {
                client: true,
                service: true,
              },
            },
          },
        });

        return this.withAvatar(master);
      }

      const master = await tx.master.create({
        data: {
          userId,
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
          bookings: {
            orderBy: { date: 'desc' },
            include: {
              client: true,
              service: true,
            },
          },
        },
      });

      return this.withAvatar(master);
    });
  }
}
