import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdateRoleDto {
  @IsIn(['CLIENT', 'MASTER'])
  role!: 'CLIENT' | 'MASTER';
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : Number(value)))
  @IsNumber()
  @Min(18)
  @Max(100)
  age?: number | null;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('role')
  async updateRole(@Request() req, @Body() body: UpdateRoleDto) {
    return this.usersService.updateRole(req.user.userId, body.role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, {
      displayName: body.displayName?.trim(),
      age: body.age,
    });
  }
}
