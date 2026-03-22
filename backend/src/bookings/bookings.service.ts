import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateBookingInput = {
  masterId: string;
  serviceId: string;
  date: string;
  notes?: string;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateBookingInput) {
    const master = await this.prisma.master.findUnique({
      where: { id: input.masterId },
      include: {
        services: true,
      },
    });

    if (!master) {
      throw new NotFoundException('Master not found');
    }

    const service = master.services.find((item) => item.id === input.serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.prisma.booking.create({
      data: {
        clientId: userId,
        masterId: master.id,
        serviceId: service.id,
        date: new Date(input.date),
        notes: input.notes,
      },
      include: {
        master: true,
        service: true,
        client: true,
      },
    });
  }

  async findMine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { master: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'MASTER' && user.master) {
      return this.prisma.booking.findMany({
        where: {
          masterId: user.master.id,
        },
        include: {
          client: true,
          service: true,
          master: true,
        },
        orderBy: { date: 'desc' },
      });
    }

    return this.prisma.booking.findMany({
      where: {
        clientId: userId,
      },
      include: {
        client: true,
        service: true,
        master: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async updateStatus(
    userId: string,
    bookingId: string,
    status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { master: true },
    });

    if (!user?.master) {
      throw new ForbiddenException('Only masters can update booking statuses');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.masterId !== user.master.id) {
      throw new ForbiddenException('Booking does not belong to this master');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        client: true,
        service: true,
        master: true,
      },
    });
  }

  async rateClient(
    userId: string,
    bookingId: string,
    rating: number,
    comment?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { master: true },
    });

    if (!user?.master) {
      throw new ForbiddenException('Only masters can rate clients');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.masterId !== user.master.id) {
      throw new ForbiddenException('Booking does not belong to this master');
    }

    if (booking.status !== 'COMPLETED') {
      throw new ForbiddenException('Client can be rated only after a completed booking');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        clientRating: rating,
        clientRatingComment: comment,
      },
      include: {
        client: true,
        service: true,
        master: true,
      },
    });
  }
}
