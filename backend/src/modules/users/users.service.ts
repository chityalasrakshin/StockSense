import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { PaginatedUsersDto, QueryUsersDto, UserItemDto } from './dtos/user-response.dto';

const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedUsersDto> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.email = {
        contains: query.search.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (query.role) {
      where.role = query.role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT_FIELDS,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users as UserItemDto[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string): Promise<UserItemDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT_FIELDS,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found`);
    }

    return user as UserItemDto;
  }

  async create(dto: CreateUserDto): Promise<UserItemDto> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      select: USER_SELECT_FIELDS,
    });

    return user as UserItemDto;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserItemDto> {
    await this.findById(id);

    const updateData: any = {};

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email address is already in use by another user');
      }
      updateData.email = email;
    }

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.role) {
      updateData.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
      if (!dto.isActive) {
        // Revoke active sessions if user is deactivated
        await this.prisma.refreshToken.updateMany({
          where: { userId: id },
          data: { isRevoked: true },
        });
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT_FIELDS,
    });

    return user as UserItemDto;
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findById(id);

    // Deactivate user and revoke refresh tokens
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { isRevoked: true },
    });

    return { message: `User "${id}" has been deactivated` };
  }
}
