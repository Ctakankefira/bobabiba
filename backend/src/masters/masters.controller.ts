import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { ConfigService } from '@nestjs/config';
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

class CreateMasterServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  price!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  duration!: number;
}

class CreateMasterPhotoDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  alt?: string;
}

class CreateMasterDto {
  @IsString()
  @IsNotEmpty()
  telegramId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : Number(value)))
  @IsNumber()
  priceMin?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : Number(value)))
  @IsNumber()
  priceMax?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMasterServiceDto)
  services?: CreateMasterServiceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMasterPhotoDto)
  photos?: CreateMasterPhotoDto[];
}

@Controller('masters')
export class MastersController {
  constructor(
    private readonly mastersService: MastersService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getMasters(@Query() query: GetMastersQueryDto) {
    return this.mastersService.findAll(query);
  }

  @Post()
  async createMaster(
    @Body() body: CreateMasterDto,
    @Headers('x-admin-secret') adminSecret?: string,
  ) {
    const expectedSecret = this.configService.get<string>('ADMIN_SECRET');
    if (!expectedSecret) {
      throw new InternalServerErrorException('ADMIN_SECRET is not configured');
    }

    if (!adminSecret || adminSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid admin secret');
    }

    try {
      return await this.mastersService.create(body);
    } catch (error) {
      if (error instanceof Error && error.message === 'MASTER_ALREADY_EXISTS') {
        throw new ConflictException('Master already exists for this telegramId');
      }

      throw error;
    }
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
