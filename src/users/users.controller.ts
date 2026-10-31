import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true, data: user };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Request() req: any, @Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    const user = await this.usersService.update(id, updateUserDto);
    return { success: true, data: user };
  }

  @Patch('me/role')
  @UseGuards(JwtAuthGuard)
  async updateRole(@Request() req: any, @Body() updateRoleDto: UpdateRoleDto) {
    const userId = req.user.id;
    const user = await this.usersService.updateRole(userId, updateRoleDto.role);
    return { success: true, data: user };
  }

}
