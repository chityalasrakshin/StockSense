import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { CategoryItemDto, CategoryTreeNodeDto } from './dtos/category-response.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<CategoryItemDto> {
    const existing = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Category with name "${dto.name}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category with ID "${dto.parentId}" not found`);
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
      },
      include: {
        parent: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    this.logger.log(`Category created: ${category.name} (${category.id})`);
    return category;
  }

  async findAll(): Promise<CategoryItemDto[]> {
    return this.prisma.category.findMany({
      include: {
        parent: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTree(): Promise<CategoryTreeNodeDto[]> {
    const allCategories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const categoryMap = new Map<string, CategoryTreeNodeDto>();
    for (const cat of allCategories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        parentId: cat.parentId,
        productCount: cat._count.products,
        children: [],
      });
    }

    const tree: CategoryTreeNodeDto[] = [];
    for (const cat of allCategories) {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children.push(node);
      } else {
        tree.push(node);
      }
    }

    return tree;
  }

  async findOne(id: string): Promise<CategoryItemDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryItemDto> {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      const existing = await this.prisma.category.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category with name "${dto.name}" already exists`);
      }
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }

      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category with ID "${dto.parentId}" not found`);
      }

      // Check circular reference by traversing parent hierarchy
      let currentParentId: string | null = parent.parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          throw new ConflictException(
            'Circular category hierarchy detected: category cannot have a descendant as its parent',
          );
        }
        const ancestor = await this.prisma.category.findUnique({
          where: { id: currentParentId },
        });
        currentParentId = ancestor?.parentId ?? null;
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  /**
   * Safe removal of categories.
   * INVARIANT: Category deletion is strictly BLOCKED if any products reference it
   * or if any child categories exist, preserving master-data referential integrity.
   */
  async remove(id: string): Promise<{ message: string; id: string }> {
    const category = await this.findOne(id);

    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category "${category.name}": it is referenced by ${productCount} product(s). Please reassign or delete the products first.`,
      );
    }

    const childrenCount = await this.prisma.category.count({
      where: { parentId: id },
    });

    if (childrenCount > 0) {
      throw new ConflictException(
        `Cannot delete category "${category.name}": it has ${childrenCount} sub-category(ies). Please reassign or delete sub-categories first.`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category deleted: ${category.name} (${id})`);
    return {
      message: `Category "${category.name}" successfully deleted`,
      id,
    };
  }
}
