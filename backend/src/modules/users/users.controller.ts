import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { PaginatedUsersDto, QueryUsersDto, UserItemDto } from './dtos/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile of the currently authenticated caller (Manager or Staff).',
  })
  @ApiResponse({ status: HttpStatus.OK, type: UserItemDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: { id: string }): Promise<UserItemDto> {
    return this.usersService.findById(user.id);
  }

  @ApiOperation({
    summary: 'RBAC verification placeholder: Inventory Manager access only',
    description:
      'Verification endpoint to prove that Warehouse Staff receives HTTP 403 Forbidden while Inventory Manager is permitted.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Access granted to Inventory Manager' })
  @ApiForbiddenResponse({
    description: 'Forbidden: Insufficient permissions (Warehouse Staff blocked)',
  })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('placeholder/manager-only')
  getManagerOnlyPlaceholder(@CurrentUser() user: { email: string; role: Role }) {
    return {
      message: 'Access granted: You hold the INVENTORY_MANAGER role.',
      caller: user,
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'RBAC verification placeholder: Warehouse Staff and Manager access',
    description:
      'Verification endpoint proving that both Warehouse Staff and Inventory Manager are permitted.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Access granted to staff/manager' })
  @Roles(Role.WAREHOUSE_STAFF, Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('placeholder/staff-accessible')
  getStaffAccessiblePlaceholder(@CurrentUser() user: { email: string; role: Role }) {
    return {
      message: 'Access granted: Warehouse operational route accessed successfully.',
      caller: user,
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'List users with pagination and filters (Manager only)',
    description: 'Returns paginated list of user accounts with optional role and search filtering.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedUsersDto })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(@Query() query: QueryUsersDto): Promise<PaginatedUsersDto> {
    return this.usersService.findAll(query);
  }

  @ApiOperation({
    summary: 'Get user details by ID (Manager only)',
    description: 'Retrieves user profile metadata by unique ID.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: UserItemDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findById(@Param('id') id: string): Promise<UserItemDto> {
    return this.usersService.findById(id);
  }

  @ApiOperation({
    summary: 'Create a new user (Manager only)',
    description: 'Admin provisioning of user accounts with designated role and password.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: UserItemDto })
  @ApiForbiddenResponse({ description: 'Requires INVENTORY_MANAGER role' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserItemDto> {
    return this.usersService.create(dto);
  }

  @ApiOperation({
    summary: 'Update user account (Manager only)',
    description:
      'Modifies user properties such as role or active status. Deactivation revokes active sessions.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: UserItemDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserItemDto> {
    return this.usersService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Deactivate user (Manager only)',
    description: 'Deactivates user and immediately revokes all refresh token sessions.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User deactivated' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Roles(Role.INVENTORY_MANAGER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }
}
