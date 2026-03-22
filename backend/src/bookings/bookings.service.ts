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
        review: true,
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
          review: true,
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
        review: true,
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
      data: {
        status,
        acceptedAt:
          status === 'CONFIRMED' || status === 'COMPLETED'
            ? booking.acceptedAt ?? new Date()
            : booking.acceptedAt,
        completedAt: status === 'COMPLETED' ? new Date() : booking.completedAt,
      },
      include: {
        client: true,
        service: true,
        master: true,
        review: true,
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

    if (booking.clientRating !== null) {
      throw new ForbiddenException('Client rating has already been saved');
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
        review: true,
      },
    });
  }

  async createReview(
    userId: string,
    bookingId: string,
    rating: number,
    comment?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.clientId !== userId) {
      throw new ForbiddenException('Only the client can leave a review');
    }

    if (booking.status !== 'COMPLETED') {
      throw new ForbiddenException('Review is available only after a completed booking');
    }

    if (booking.review) {
      throw new ForbiddenException('Review for this booking already exists');
    }

    await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        clientId: booking.clientId,
        masterId: booking.masterId,
        rating,
        comment,
      },
    });

    const aggregate = await this.prisma.review.aggregate({
      where: {
        masterId: booking.masterId,
      },
      _avg: {
        rating: true,
      },
    });

    await this.prisma.master.update({
      where: {
        id: booking.masterId,
      },
      data: {
        rating: aggregate._avg.rating ?? 0,
      },
    });

    return this.prisma.booking.findUnique({
      where: {
        id: booking.id,
      },
      include: {
        client: true,
        service: true,
        master: true,
        review: true,
      },
    });
  }
}
