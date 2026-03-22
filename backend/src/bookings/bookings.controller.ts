import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';

class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  masterId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateBookingStatusDto {
  @Transform(({ value }) => String(value))
  @IsIn(['CONFIRMED', 'CANCELLED', 'COMPLETED'])
  status!: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}

class RateClientDto {
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

class CreateReviewDto {
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Request() req, @Body() body: CreateBookingDto) {
    return this.bookingsService.create(req.user.userId, body);
  }

  @Get('me')
  findMine(@Request() req) {
    return this.bookingsService.findMine(req.user.userId);
  }

  @Patch(':id/status')
  updateStatus(@Request() req, @Param('id') id: string, @Body() body: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(req.user.userId, id, body.status);
  }

  @Patch(':id/client-rating')
  rateClient(
    @Request() req,
    @Param('id') id: string,
    @Body() body: RateClientDto,
  ) {
    return this.bookingsService.rateClient(req.user.userId, id, body.rating, body.comment);
  }

  @Post(':id/review')
  reviewBooking(
    @Request() req,
    @Param('id') id: string,
    @Body() body: CreateReviewDto,
  ) {
    return this.bookingsService.createReview(req.user.userId, id, body.rating, body.comment);
  }
}
