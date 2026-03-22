import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdateRoleDto {
  @IsIn(['CLIENT', 'MASTER'])
  role!: 'CLIENT' | 'MASTER';
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
}
