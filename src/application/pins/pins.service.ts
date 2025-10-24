// src/application/pins/pins.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AppRole, Prisma, VehicleStatus } from '@prisma/client';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';

type ListQuery = { q?: string; page?: number; limit?: number };

/** Selección “owner lite” para el DTO */
const ownerSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  profilePicture: true,
  city: true,
  state: true,
  country: true,
  pinsCount: true,
} as const;

/** Tipo de retorno con includes ya tipados */
type PinWithOwnerPhotos = Prisma.PinGetPayload<{
  include: {
    photos: true;
    owner: { select: typeof ownerSelect };
  };
}>;

@Injectable()
export class PinsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ListQuery): Promise<PinWithOwnerPhotos[]> {
    const page = Math.max(1, Number(query?.page ?? 1));
    const limit = Math.max(1, Math.min(50, Number(query?.limit ?? 20)));

    const where: Prisma.PinWhereInput = {
      status: { in: [VehicleStatus.PUBLISHED, VehicleStatus.PAUSED] },
    };

    if (query?.q && query.q.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.pin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
    });
  }

  async getByIdPublic(id: string): Promise<PinWithOwnerPhotos> {
    const pin = await this.prisma.pin.findUnique({
      where: { id },
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
    });
    if (!pin) throw new NotFoundException('Pin not found');
    return pin;
  }

  async listMine(userId: string, query?: ListQuery): Promise<PinWithOwnerPhotos[]> {
    const page = Math.max(1, Number(query?.page ?? 1));
    const limit = Math.max(1, Math.min(50, Number(query?.limit ?? 20)));

    return this.prisma.pin.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
    });
  }
<<<<<<< HEAD

  async createPin(ownerId: string, dto: CreatePinDto): Promise<PinWithOwnerPhotos> {
=======
  async createPin(
    ownerId: string,
    dto: CreatePinDto,
  ): Promise<PinWithOwnerPhotos> {
>>>>>>> b6f19d1 (fix: ajustes en DTOs y tipado de PinsService)
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');
    if (owner.role !== AppRole.RENTER && owner.role !== AppRole.ADMIN) {
      throw new ForbiddenException('Only renters or admins can create vehicles');
    }

    const created = await this.prisma.pin.create({
      data: {
        ...dto,
        ownerId,
        status: VehicleStatus.DRAFT,
        photos: dto.photos?.length
          ? { create: dto.photos.map((p) => ({ url: p.url, isCover: !!p.isCover })) }
          : undefined,
      },
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
    });

    await this.prisma.user.update({
      where: { id: ownerId },
      data: { pinsCount: { increment: 1 } },
    });

    return created;
  }

  async updatePin(
    requesterId: string,
    pinId: string,
    dto: UpdatePinDto,
  ): Promise<PinWithOwnerPhotos> {
    const pin = await this.prisma.pin.findUnique({
      where: { id: pinId },
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
    });
    if (!pin) throw new NotFoundException('Pin not found');

<<<<<<< HEAD
    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
=======
    const requester: User | null = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

>>>>>>> b6f19d1 (fix: ajustes en DTOs y tipado de PinsService)
    if (!requester) throw new NotFoundException('User not found');
    if (requester.role !== AppRole.ADMIN && pin.ownerId !== requester.id) {
      throw new ForbiddenException('Not allowed to modify this pin');
    }

    const cleanData: Prisma.PinUpdateInput = Object.fromEntries(
      Object.entries(dto).filter(([_, v]) => v !== undefined),
    );

    return this.prisma.$transaction(async (tx) => {
      if (cleanData.photos) {
        const photos = cleanData.photos as { url: string; isCover?: boolean }[];

        await tx.pinPhoto.deleteMany({ where: { pinId } });

        cleanData.photos = {
          createMany: {
            data: photos.map((p) => ({
              url: p.url,
              isCover: !!p.isCover,
            })),
          },
        };
      }

      return tx.pin.update({
        where: { id: pinId },
<<<<<<< HEAD
        data: {
          ...dto,
          photos: dto.photos
            ? { createMany: { data: dto.photos.map((p) => ({ url: p.url, isCover: !!p.isCover })) } }
            : undefined,
        },
=======
        data: cleanData,
>>>>>>> b6f19d1 (fix: ajustes en DTOs y tipado de PinsService)
        include: {
          photos: true,
          owner: { select: ownerSelect },
        },
      });
    });
  }

  async setStatus(
    requesterId: string,
    pinId: string,
    body: { status: VehicleStatus },
  ): Promise<PinWithOwnerPhotos> {
    const { status } = body || {};
    if (!status) throw new BadRequestException('Missing status');

    const pin = await this.prisma.pin.findUnique({
      where: { id: pinId },
    });
    if (!pin) throw new NotFoundException('Pin not found');

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
    if (!requester) throw new NotFoundException('User not found');

    const isOwner = requester.id === pin.ownerId;
    const isAdmin = requester.role === AppRole.ADMIN;

    if (status === VehicleStatus.BLOCKED && !isAdmin) {
      throw new ForbiddenException('Only admin can block a vehicle');
    }

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Not allowed to change status');
    }

    return this.prisma.pin.update({
      where: { id: pinId },
      data: { status },
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
    });
  }

  async deletePin(requesterId: string, pinId: string): Promise<void> {
    const pin = await this.prisma.pin.findUnique({ where: { id: pinId } });
    if (!pin) throw new NotFoundException('Pin not found');

    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester) throw new NotFoundException('User not found');
    if (requester.role !== AppRole.ADMIN && pin.ownerId !== requester.id) {
      throw new ForbiddenException('Not allowed to delete this pin');
    }

    await this.prisma.$transaction([
      this.prisma.pin.delete({ where: { id: pinId } }),
      this.prisma.user.update({
        where: { id: pin.ownerId },
        data: { pinsCount: { decrement: 1 } },
      }),
    ]);
  }

  // Compat con UsersController
  async getPinsByUserService(userId: string, page = 1, limit = 20): Promise<PinWithOwnerPhotos[]> {
    return this.listMine(userId, { page, limit });
  }

  async getUserPinsCountService(userId: string): Promise<number> {
    return this.prisma.pin.count({ where: { ownerId: userId } });
  }

  // Búsqueda legacy (pública)
  async serviceSearch(q: string): PinWithOwnerPhotos[] {
    return this.prisma.pin.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { make: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
        status: VehicleStatus.PUBLISHED,
      },
      include: {
        photos: true,
        owner: { select: ownerSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }