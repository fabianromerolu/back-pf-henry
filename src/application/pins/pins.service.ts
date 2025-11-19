//src/application/pins/pins.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AppRole, Prisma, VehicleStatus, User } from '@prisma/client';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';
import { QueryPinsDto } from './dtos/query-pin.dto';
import { PinDetailResponseDto } from './dtos/pin-detail-response.dto';
import { makePinsData } from './makePinsData';

type ListQuery = { q?: string; page?: number; limit?: number };

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

type PinWithOwnerPhotos = Prisma.PinGetPayload<{
  include: {
    photos: true;
    owner: { select: typeof ownerSelect };
  };
}>;

@Injectable()
export class PinsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: QueryPinsDto) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const limit = Math.max(1, Math.min(50, Number(query?.limit ?? 12)));

    // 🔍 Construcción dinámica del filtro (where)
    const where: Prisma.PinWhereInput = {
      deletedAt: null,
      status: query.status ?? VehicleStatus.PUBLISHED,
      ...(query.category && { category: query.category }),
      ...(query.city && {
        city: { contains: query.city.trim(), mode: 'insensitive' },
      }),
       ...(query.state && {
      state: { contains: query.state.trim(), mode: 'insensitive' },
      }),
    };

    // 🔎 Búsqueda general (texto libre)
    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
      ];
    }

    // 💰 Filtros por rango de precios
    if (query.priceMin || query.priceMax) {
      where.pricePerDay = {
        ...(query.priceMin && { gte: Number(query.priceMin) }),
        ...(query.priceMax && { lte: Number(query.priceMax) }),
      };
    }

    // 🚗 Filtros por año de fabricación
    if (query.yearMin || query.yearMax) {
      where.year = {
        ...(query.yearMin && { gte: Number(query.yearMin) }),
        ...(query.yearMax && { lte: Number(query.yearMax) }),
      };
    }

    // 👤 Filtro por propietario
    if (query.ownerId) where.ownerId = query.ownerId;

    // 🔄 Ejecución en transacción: list + count
    const [pins, total] = await this.prisma.$transaction([
      this.prisma.pin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          pricePerDay: true,
          fuel: true,
          seats: true,
          transmission: true,
          averageRating: true,
          state: true,
          photos: {
            where: { isCover: true },
            select: { url: true },
            take: 1,
          },
        },
      }),
      this.prisma.pin.count({ where }),
    ]);

    // 🧾 Formato de respuesta
    return {
      data: pins.map((pin) => ({
        id: pin.id,
        make: pin.make,
        model: pin.model,
        year: pin.year,
        pricePerDay: pin.pricePerDay?.toString(),
        fuel: pin.fuel,
        seats: pin.seats ?? 5,
        transmission: pin.transmission,
        averageRating: pin.averageRating ?? 0,
        thumbnailUrl: pin.photos?.[0]?.url ?? null,
        state: pin.state,
      })),
      page,
      limit,
      total,
      hasNextPage: total > page * limit,
    };
  }

  async getByIdPublic(id: string): Promise<PinDetailResponseDto> {
    const pin = await this.prisma.pin.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        make: true,
        model: true,
        bodyType: true,
        category: true,
        transmission: true,
        fuel: true,
        seats: true,
        pricePerDay: true,
        city: true,
        state: true,
        country: true,
        rules: true,
        description: true,
        status: true,
        averageRating: true,
        photos: {
          orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
          select: { url: true },
        },
      },
    });

    if (!pin) throw new NotFoundException('Pin not found');
    if (pin.status !== VehicleStatus.PUBLISHED)
      throw new NotFoundException('Pin not published');
    const coverImage = pin.photos.length ? pin.photos[0].url : null;

    return {
      id: pin.id,
      make: pin.make,
      model: pin.model,
      bodyType: pin.bodyType,
      category: pin.category,
      transmission: pin.transmission,
      fuel: pin.fuel,
      seats: pin.seats ?? 5,
      pricePerDay: pin.pricePerDay.toString(),
      city: pin.city,
      state: pin.state,
      country: pin.country,
      rules: pin.rules ?? null,
      description: pin.description ?? null,
      status: pin.status,
      averageRating: Number(pin.averageRating ?? 0),
      photos: pin.photos.map((p) => ({ url: p.url })),
      coverImage,
    };
  }

  async listMine(
    userId: string,
    query?: ListQuery,
  ): Promise<PinWithOwnerPhotos[]> {
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
  async createPin(
    ownerId: string,
    dto: CreatePinDto,
  ): Promise<PinWithOwnerPhotos> {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');
    if (owner.role !== AppRole.RENTER && owner.role !== AppRole.ADMIN) {
      throw new ForbiddenException(
        'Only renters or admins can create vehicles',
      );
    }

    // Si te gusta tener un "título", generalo y guardalo en otro campo opcional de negocio,
    // pero Prisma hoy NO tiene 'title', así que no lo mandamos al create.
    // const fallbackTitle = `${dto.make} ${dto.model} ${dto.year}`;

    const created = await this.prisma.pin.create({
      data: {
        ...dto,
        ownerId,
        status: VehicleStatus.DRAFT,
        photos: dto.photos?.length
          ? {
              create: dto.photos.map((p) => ({
                url: p.url,
                isCover: !!p.isCover,
              })),
            }
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

    const requester: User | null = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) throw new NotFoundException('User not found');
    if (requester.role !== AppRole.ADMIN && pin.ownerId !== requester.id) {
      throw new ForbiddenException('Not allowed to modify this pin');
    }

    const cleanData: Prisma.PinUpdateInput = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        data: cleanData,
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

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
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
  async getPinsByUserService(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PinWithOwnerPhotos[]> {
    return this.listMine(userId, { page, limit });
  }

  async getUserPinsCountService(userId: string): Promise<number> {
    return this.prisma.pin.count({ where: { ownerId: userId } });
  }

  async seedPins() {
    const existing = await this.prisma.pin.findFirst({
      where: { status: VehicleStatus.PUBLISHED }, // 👈 mejor enum que string
    });

    if (existing) {
      return { message: '⛔ Seeder ya ejecutado anteriormente ❌' };
    }

    const owner = await this.prisma.user.upsert({
      where: { email: 'seed-owner@example.com' },
      update: {},
      create: {
        email: 'seed-owner@example.com',
        username: 'seedowner',
        name: 'Seed Owner',
        password: 'hashed_placeholder',
        role: 'USER',
      },
    });

    // ✅ genera los datos con el ownerId correcto
    const pinsData = makePinsData(owner.id);

    // ✅ crea todos los pins (sin nested writes)
    await this.prisma.pin.createMany({ data: pinsData });

    // ✅ trae los IDs (opcional: puedes filtrar por email del owner)
    const createdPins = await this.prisma.pin.findMany({
      where: { ownerId: owner.id },
      select: { id: true },
    });

    // ✅ crea las fotos por cada pin
    for (let i = 0; i < createdPins.length; i++) {
      await this.prisma.pinPhoto.createMany({
        data: [
          {
            pinId: createdPins[i].id,
            url: `https://via.placeholder.com/600x400?text=Car${i + 1}+Cover`,
            isCover: true,
          },
          {
            pinId: createdPins[i].id,
            url: `https://via.placeholder.com/600x400?text=Car${i + 1}+Photo2`,
            isCover: false,
          },
        ],
      });
    }

    return {
      message: `✅ Seeder ejecutado correctamente → ${createdPins.length} Pins creados 🚗`,
    };
  }
}
