import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { MastersService } from './masters.service';

class GetMastersQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  priceMax?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  rating?: number;
}

@Controller('masters')
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  @Get()
  getMasters(@Query() query: GetMastersQueryDto) {
    return this.mastersService.findAll(query);
  }

  @Get(':id')
  async getMaster(@Param('id') id: string) {
    const master = await this.mastersService.findOne(id);
    if (!master) {
      throw new NotFoundException('Master not found');
    }

    return master;
  }
}
