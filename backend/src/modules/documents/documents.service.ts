import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { IdempotencyService } from './services/idempotency.service';
import { EventPublisherService } from './services/event-publisher.service';
import { CreateDocumentDto } from './dtos/create-document.dto';
import { UpdateDocumentDto } from './dtos/update-document.dto';
import { QueryDocumentsDto } from './dtos/query-documents.dto';
import { DocumentItemDto, PaginatedDocumentsDto } from './dtos/document-response.dto';
import { DocumentStatus, DocumentType, Prisma, Role } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly idempotencyService: IdempotencyService,
    private readonly eventPublisherService: EventPublisherService,
  ) {}

  /**
   * Creates a draft document with line items.
   * RBAC: Warehouse Staff can create RECEIPT, DELIVERY, TRANSFER;
   * Only INVENTORY_MANAGER can create ADJUSTMENT.
   */
  async create(
    dto: CreateDocumentDto,
    currentUser: { id: string; role: Role },
  ): Promise<DocumentItemDto> {
    // 1. RBAC Check: Only INVENTORY_MANAGER can create ADJUSTMENT
    if (dto.type === DocumentType.ADJUSTMENT && currentUser.role !== Role.INVENTORY_MANAGER) {
      throw new ForbiddenException(
        'Forbidden resource: Only INVENTORY_MANAGER can create ADJUSTMENT documents',
      );
    }

    // 2. Validate locations according to document type
    let sourceLocId = dto.sourceLocationId;
    let destLocId = dto.destLocationId;

    if (dto.type === DocumentType.RECEIPT) {
      if (!destLocId) {
        throw new BadRequestException('Destination location (destLocationId) is required for RECEIPT');
      }
      const destLoc = await this.prisma.location.findUnique({ where: { id: destLocId } });
      if (!destLoc) {
        throw new NotFoundException(`Destination location with ID "${destLocId}" not found`);
      }
    } else if (dto.type === DocumentType.DELIVERY) {
      if (!sourceLocId) {
        throw new BadRequestException('Source location (sourceLocationId) is required for DELIVERY');
      }
      const sourceLoc = await this.prisma.location.findUnique({ where: { id: sourceLocId } });
      if (!sourceLoc) {
        throw new NotFoundException(`Source location with ID "${sourceLocId}" not found`);
      }
    } else if (dto.type === DocumentType.TRANSFER) {
      if (!sourceLocId || !destLocId) {
        throw new BadRequestException(
          'Both sourceLocationId and destLocationId are required for internal TRANSFER',
        );
      }
      if (sourceLocId === destLocId) {
        throw new BadRequestException(
          'Source and destination locations cannot be identical for an internal transfer',
        );
      }
      const [src, dst] = await Promise.all([
        this.prisma.location.findUnique({ where: { id: sourceLocId } }),
        this.prisma.location.findUnique({ where: { id: destLocId } }),
      ]);
      if (!src) throw new NotFoundException(`Source location with ID "${sourceLocId}" not found`);
      if (!dst) throw new NotFoundException(`Destination location with ID "${destLocId}" not found`);
    } else if (dto.type === DocumentType.ADJUSTMENT) {
      const locId = dto.locationId || sourceLocId || destLocId;
      if (!locId) {
        throw new BadRequestException('Location (locationId) is required for an inventory ADJUSTMENT');
      }
      const loc = await this.prisma.location.findUnique({ where: { id: locId } });
      if (!loc) throw new NotFoundException(`Location with ID "${locId}" not found`);
      sourceLocId = locId;
      destLocId = undefined;
    }

    // 3. Validate line products exist
    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) {
        throw new NotFoundException(`Product with ID "${line.productId}" not found`);
      }
    }

    // 4. Generate or validate unique document reference
    let reference = dto.reference?.trim();
    if (reference) {
      const existingRef = await this.prisma.document.findUnique({ where: { reference } });
      if (existingRef) {
        throw new ConflictException(`Document with reference "${reference}" already exists`);
      }
    } else {
      reference = await this.generateReference(dto.type, sourceLocId, destLocId);
    }

    const document = await this.prisma.document.create({
      data: {
        reference,
        type: dto.type,
        status: DocumentStatus.DRAFT,
        sourceLocationId: sourceLocId ?? null,
        destLocationId: destLocId ?? null,
        contact: dto.contact?.trim() ?? null,
        partnerRef: dto.partnerRef?.trim() ?? null,
        scheduleDate: dto.scheduleDate ? new Date(dto.scheduleDate) : null,
        createdById: currentUser.id,
        responsibleUserId: dto.responsibleUserId ?? currentUser.id,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            expectedQty: l.expectedQty,
            actualQty: l.actualQty !== undefined ? l.actualQty : null,
          })),
        },
      },
      include: {
        lines: { include: { product: true } },
        sourceLocation: true,
        destLocation: true,
        createdBy: true,
        responsibleUser: true,
        validatedBy: true,
      },
    });

    this.logger.log(`Document draft created: [${document.reference}] (${document.type})`);
    return document as unknown as DocumentItemDto;
  }

  async findAll(query: QueryDocumentsDto): Promise<PaginatedDocumentsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { reference: { contains: s, mode: 'insensitive' } },
        { contact: { contains: s, mode: 'insensitive' } },
        { partnerRef: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [documents, totalItems] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          lines: { include: { product: true } },
          sourceLocation: true,
          destLocation: true,
          createdBy: true,
          responsibleUser: true,
          validatedBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items: documents as unknown as DocumentItemDto[],
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<DocumentItemDto> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        sourceLocation: true,
        destLocation: true,
        createdBy: true,
        responsibleUser: true,
        validatedBy: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    return document as unknown as DocumentItemDto;
  }

  /**
   * Modifies document lines or metadata while in DRAFT, WAITING, or READY state.
   * Edits are strictly rejected once DONE or CANCELED.
   */
  async update(
    id: string,
    dto: UpdateDocumentDto,
    currentUser: { id: string; role: Role },
  ): Promise<DocumentItemDto> {
    const document = await this.findOne(id);

    // Terminal state invariant
    if (document.status === DocumentStatus.DONE || document.status === DocumentStatus.CANCELED) {
      throw new BadRequestException(
        `Cannot edit document in ${document.status} status. Only DRAFT, WAITING, or READY documents can be edited.`,
      );
    }

    // Role invariant: WAREHOUSE_STAFF cannot edit ADJUSTMENT documents
    if (document.type === DocumentType.ADJUSTMENT && currentUser.role === Role.WAREHOUSE_STAFF) {
      throw new ForbiddenException(
        'Warehouse staff are not authorized to edit inventory adjustment documents. Only INVENTORY_MANAGER can modify adjustments.',
      );
    }

    // Direct transition to DONE is prohibited via PATCH; must go through POST /documents/:id/validate
    if (dto.status === DocumentStatus.DONE) {
      throw new BadRequestException(
        'Cannot transition directly to DONE status via PATCH. Use POST /documents/:id/validate to validate and post inventory.',
      );
    }

    // Validate state machine transitions
    if (dto.status) {
      this.validateStatusTransition(document.status, dto.status);
    }

    return this.prisma.$transaction(async (tx) => {
      // If line updates provided, replace lines atomically
      if (dto.lines) {
        await tx.documentLine.deleteMany({ where: { documentId: id } });
        await tx.documentLine.createMany({
          data: dto.lines.map((l) => ({
            documentId: id,
            productId: l.productId,
            expectedQty: l.expectedQty,
            actualQty: l.actualQty !== undefined ? l.actualQty : null,
          })),
        });
      }

      const updated = await tx.document.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.contact !== undefined ? { contact: dto.contact?.trim() ?? null } : {}),
          ...(dto.partnerRef !== undefined ? { partnerRef: dto.partnerRef?.trim() ?? null } : {}),
          ...(dto.scheduleDate !== undefined
            ? { scheduleDate: dto.scheduleDate ? new Date(dto.scheduleDate) : null }
            : {}),
          ...(dto.sourceLocationId !== undefined ? { sourceLocationId: dto.sourceLocationId } : {}),
          ...(dto.destLocationId !== undefined ? { destLocationId: dto.destLocationId } : {}),
          ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        },
        include: {
          lines: { include: { product: true } },
          sourceLocation: true,
          destLocation: true,
          createdBy: true,
          responsibleUser: true,
          validatedBy: true,
        },
      });

      this.logger.log(`Document updated: [${updated.reference}] status=${updated.status}`);
      return updated as unknown as DocumentItemDto;
    });
  }

  /**
   * THE CRITICAL TRANSACTIONAL ENDPOINT:
   * Validates a document, transitions status to DONE, and writes immutable stock_ledger entries
   * and derived stock_balances rows.
   *
   * Idempotency-Key support guarantees network retries never double-post stock.
   */
  async validate(
    id: string,
    actorId: string,
    idempotencyKey?: string,
  ): Promise<DocumentItemDto> {
    const cleanIdempotencyKey = idempotencyKey?.trim();

    // 1. Idempotency Check: if key already processed, return stored result immediately
    if (cleanIdempotencyKey) {
      const cached = await this.idempotencyService.get(cleanIdempotencyKey);
      if (cached && cached.documentId === id) {
        this.logger.log(
          `Idempotent replay: document [${id}] already validated under key [${cleanIdempotencyKey}]`,
        );
        return cached.response;
      }
    }

    const document = await this.findOne(id);

    // 2. State & validation guards
    if (document.status === DocumentStatus.DONE) {
      if (cleanIdempotencyKey) {
        return document;
      }
      throw new ConflictException(`Document "${document.reference}" has already been validated`);
    }

    if (document.status === DocumentStatus.CANCELED) {
      throw new ConflictException(
        `Cannot validate document "${document.reference}": document is CANCELED`,
      );
    }

    if (!document.lines || document.lines.length === 0) {
      throw new BadRequestException('Cannot validate document with no line items');
    }

    const validatedAt = new Date();
    const affectedStockKeys: Array<{ productId: string; locationId: string }> = [];

    // 3. EXECUTE VALIDATION IN SINGLE DATABASE TRANSACTION
    const validatedDoc = await this.prisma.$transaction(
      async (tx) => {
        for (const line of document.lines!) {
          const qty = line.actualQty !== null && line.actualQty !== undefined
            ? line.actualQty
            : line.expectedQty;

          if (qty < 0) {
            throw new BadRequestException('Line quantity cannot be negative');
          }

          if (document.type === DocumentType.RECEIPT) {
            // RECEIPT: Increase stock at destination location
            const locId = document.destLocationId!;
            await this.ledgerService.append(
              {
                productId: line.productId,
                locationId: locId,
                documentId: document.id,
                qtyDelta: qty,
                actorId,
                postedAt: validatedAt,
              },
              tx,
            );
            affectedStockKeys.push({ productId: line.productId, locationId: locId });
          } else if (document.type === DocumentType.DELIVERY) {
            // DELIVERY: Decrease stock at source location (rejects if negative)
            const locId = document.sourceLocationId!;
            await this.ledgerService.append(
              {
                productId: line.productId,
                locationId: locId,
                documentId: document.id,
                qtyDelta: -qty,
                actorId,
                postedAt: validatedAt,
                allowNegative: false,
              },
              tx,
            );
            affectedStockKeys.push({ productId: line.productId, locationId: locId });
          } else if (document.type === DocumentType.TRANSFER) {
            // TRANSFER: Dual-entry ledger writes in single transaction (net zero)
            const srcLocId = document.sourceLocationId!;
            const dstLocId = document.destLocationId!;

            // Outflow at source
            await this.ledgerService.append(
              {
                productId: line.productId,
                locationId: srcLocId,
                documentId: document.id,
                qtyDelta: -qty,
                actorId,
                postedAt: validatedAt,
                allowNegative: false,
              },
              tx,
            );

            // Inflow at destination
            await this.ledgerService.append(
              {
                productId: line.productId,
                locationId: dstLocId,
                documentId: document.id,
                qtyDelta: qty,
                actorId,
                postedAt: validatedAt,
              },
              tx,
            );

            affectedStockKeys.push({ productId: line.productId, locationId: srcLocId });
            affectedStockKeys.push({ productId: line.productId, locationId: dstLocId });
          } else if (document.type === DocumentType.ADJUSTMENT) {
            // ADJUSTMENT: Counted qty minus system balance = delta
            const locId = (document.sourceLocationId || document.destLocationId)!;
            const systemBalance = await this.ledgerService.getBalance(line.productId, locId, tx);
            const delta = qty - systemBalance;

            await this.ledgerService.append(
              {
                productId: line.productId,
                locationId: locId,
                documentId: document.id,
                qtyDelta: delta,
                actorId,
                postedAt: validatedAt,
                allowNegative: false,
              },
              tx,
            );
            affectedStockKeys.push({ productId: line.productId, locationId: locId });
          }
        }

        // Transition document status to DONE
        const updated = await tx.document.update({
          where: { id },
          data: {
            status: DocumentStatus.DONE,
            validatedById: actorId,
            validatedAt,
          },
          include: {
            lines: { include: { product: true } },
            sourceLocation: true,
            destLocation: true,
            createdBy: true,
            responsibleUser: true,
            validatedBy: true,
          },
        });

        return updated as unknown as DocumentItemDto;
      },
      { timeout: 15000 },
    );

    // 4. AFTER TRANSACTION COMMITS: Cache idempotency & publish events
    if (cleanIdempotencyKey) {
      await this.idempotencyService.set(cleanIdempotencyKey, {
        documentId: id,
        response: validatedDoc,
        timestamp: validatedAt.toISOString(),
      });
    }

    // Publish stock.changed events for all affected locations (non-blocking)
    for (const item of affectedStockKeys) {
      const balance = await this.ledgerService.getBalance(item.productId, item.locationId);
      this.eventPublisherService.publishStockChanged({
        productId: item.productId,
        locationId: item.locationId,
        currentBalance: balance,
        documentId: id,
        timestamp: validatedAt.toISOString(),
      }).catch((err) => {
        this.logger.warn(`Background event publish failed: ${err.message}`);
      });
    }

    this.logger.log(
      `Document validated successfully: [${validatedDoc.reference}] (${validatedDoc.type})`,
    );
    return validatedDoc;
  }

  private validateStatusTransition(current: DocumentStatus, next: DocumentStatus): void {
    if (current === next) return;

    if (current === DocumentStatus.DONE || current === DocumentStatus.CANCELED) {
      throw new BadRequestException(
        `Cannot change status from terminal state ${current} to ${next}`,
      );
    }

    const allowedTransitions: Record<DocumentStatus, DocumentStatus[]> = {
      [DocumentStatus.DRAFT]: [DocumentStatus.WAITING, DocumentStatus.READY, DocumentStatus.CANCELED],
      [DocumentStatus.WAITING]: [DocumentStatus.DRAFT, DocumentStatus.READY, DocumentStatus.CANCELED],
      [DocumentStatus.READY]: [DocumentStatus.DRAFT, DocumentStatus.WAITING, DocumentStatus.CANCELED],
      [DocumentStatus.DONE]: [],
      [DocumentStatus.CANCELED]: [],
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Illegal status transition from ${current} to ${next}`,
      );
    }
  }

  private async generateReference(
    type: DocumentType,
    sourceLocId?: string,
    destLocId?: string,
  ): Promise<string> {
    const locId = type === DocumentType.RECEIPT ? destLocId : (sourceLocId || destLocId);
    let shortCode = 'WH';

    if (locId) {
      const loc = await this.prisma.location.findUnique({ where: { id: locId } });
      if (loc) {
        shortCode = loc.shortCode;
      }
    }

    const direction = type === DocumentType.RECEIPT ? 'IN' : 'OUT';
    const prefix = `${shortCode}/${direction}/`;

    const count = await this.prisma.document.count({
      where: {
        reference: {
          startsWith: prefix,
        },
      },
    });

    let seq = count + 1;
    let candidate = `${prefix}${String(seq).padStart(5, '0')}`;

    while (await this.prisma.document.findUnique({ where: { reference: candidate } })) {
      seq += 1;
      candidate = `${prefix}${String(seq).padStart(5, '0')}`;
    }

    return candidate;
  }
}
