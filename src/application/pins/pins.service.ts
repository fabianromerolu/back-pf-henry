import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import {
  AppRole,
  Prisma,
  VehicleStatus,
  User,
  Transmission,
  FuelType,
  BodyType,
  VehicleCategory,
  Drivetrain,
} from '@prisma/client';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';
import { QueryPinsDto } from './dtos/query-pin.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { PinDetailResponseDto } from './dtos/pin-detail-response.dto';

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

    const where: Prisma.PinWhereInput = {
      status: VehicleStatus.PUBLISHED,
      deletedAt: null,
    };

    if (query?.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.category) where.category = query.category;

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
          pricePerDay: true,
          fuel: true,
          seats: true,
          transmission: true,
          description: true,
          photos: {
            where: { isCover: true },
            select: { url: true },
            take: 1,
          },
        },
      }),

      this.prisma.pin.count({ where }),
    ]);

    return {
      data: pins.map(
        (pin: {
          id: string;
          make: string;
          model: string;
          pricePerDay: Decimal;
          fuel: FuelType;
          seats: number | null;
          transmission: Transmission;
          description: string | null;
          photos: { url: string }[];
        }) => ({
          id: pin.id,
          title: `${pin.make} ${pin.model}`,
          pricePerDay: pin.pricePerDay?.toString(),
          fuel: pin.fuel,
          seats: pin.seats ?? 5,
          transmission: pin.transmission,
          description: pin.description
            ? pin.description.length > 100
              ? pin.description.slice(0, 100) + '...'
              : pin.description
            : null,
          thumbnailUrl: pin.photos?.[0]?.url ?? null,
        }),
      ),
      page,
      limit,
      total,
      hasNextPage: total > page * limit,
    };
  }

  async getByIdPublic(id: string): Promise<PinDetailResponseDto> {
    const pin = await this.prisma.pin.findUnique({
      where: { id, deletedAt: null },
      include: {
        photos: {
          orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
          select: { url: true },
        },
      },
    });

    if (!pin) throw new NotFoundException('Pin not found');
    if (pin.status !== VehicleStatus.PUBLISHED)
      throw new NotFoundException('Pin not published');

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
      photos: pin.photos.map((p) => ({ url: p.url })),
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
      where: { status: 'PUBLISHED' },
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

    const pinsData: Prisma.PinUncheckedCreateInput[] = [
      {
        title: 'Toyota Corolla 2020',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        bodyType: BodyType.SEDAN,
        category: VehicleCategory.COMPACT,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.DIESEL,
        drivetrain: Drivetrain.RWD,
        seats: 5,

        pricePerHour: 10,
        pricePerDay: 100,
        pricePerWeek: 600,
        deposit: 200,
        kmIncludedPerDay: 200,
        pricePerExtraKm: 0.5,
        minHours: 1,
        minDriverAge: 21,
        insuranceIncluded: true,

        rules: 'No fumar dentro del vehículo',
        description: 'Confortable y económico para viajes urbanos.',
        status: VehicleStatus.PUBLISHED,

        city: 'Buenos Aires',
        state: 'Buenos Aires',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Honda Civic 2019',
        make: 'Honda',
        model: 'Civic',
        year: 2019,
        bodyType: BodyType.SEDAN,
        category: VehicleCategory.COMPACT,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.DIESEL,
        drivetrain: Drivetrain.AWD,
        seats: 5,

        pricePerHour: 12,
        pricePerDay: 110,
        pricePerWeek: 650,
        deposit: 220,
        kmIncludedPerDay: 250,
        pricePerExtraKm: 0.55,
        minHours: 1,
        minDriverAge: 21,
        insuranceIncluded: true,

        rules: 'Devolver con tanque lleno',
        description: 'Bajo consumo y cómodo, ideal para familias.',
        status: VehicleStatus.PUBLISHED,

        city: 'Córdoba',
        state: 'Córdoba',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Volkswagen Golf 2018',
        make: 'Volkswagen',
        model: 'Golf',
        year: 2018,
        bodyType: BodyType.HATCHBACK,
        category: VehicleCategory.COMPACT,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.GASOLINE,
        drivetrain: Drivetrain.FWD,
        seats: 5,

        pricePerHour: 11,
        pricePerDay: 120,
        pricePerWeek: 700,
        deposit: 250,
        kmIncludedPerDay: 220,
        pricePerExtraKm: 0.6,
        minHours: 1,
        minDriverAge: 21,
        insuranceIncluded: true,

        rules: 'No mascotas',
        description: 'Compacto, ágil y cómodo para la ciudad.',
        status: VehicleStatus.PUBLISHED,

        city: 'Rosario',
        state: 'Santa Fe',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Ford Ranger 2021',
        make: 'Ford',
        model: 'Ranger',
        year: 2021,
        bodyType: BodyType.PICKUP,
        category: VehicleCategory.PICKUP,
        transmission: Transmission.MANUAL,
        fuel: FuelType.DIESEL,
        drivetrain: Drivetrain.RWD,
        seats: 5,

        pricePerHour: 18,
        pricePerDay: 180,
        pricePerWeek: 1000,
        deposit: 400,
        kmIncludedPerDay: 300,
        pricePerExtraKm: 0.75,
        minHours: 2,
        minDriverAge: 23,
        insuranceIncluded: true,

        rules: 'Prohibido uso off-road extremo',
        description: 'Ideal para trabajos y caminos difíciles.',
        status: VehicleStatus.PUBLISHED,

        city: 'Mendoza',
        state: 'Mendoza',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Renault Kangoo 2020',
        make: 'Renault',
        model: 'Kangoo',
        year: 2020,
        bodyType: BodyType.VAN,
        category: VehicleCategory.VAN,
        transmission: Transmission.MANUAL,
        fuel: FuelType.GASOLINE,
        drivetrain: Drivetrain.FWD,
        seats: 2,

        pricePerHour: 14,
        pricePerDay: 130,
        pricePerWeek: 750,
        deposit: 250,
        kmIncludedPerDay: 250,
        pricePerExtraKm: 0.5,
        minHours: 1,
        minDriverAge: 21,
        insuranceIncluded: true,

        rules: 'Carga máxima 750kg',
        description: 'Espacio y rendimiento para transporte liviano.',
        status: VehicleStatus.PUBLISHED,

        city: 'La Plata',
        state: 'Buenos Aires',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Chevrolet Cruze 2019',
        make: 'Chevrolet',
        model: 'Cruze',
        year: 2019,
        bodyType: BodyType.SEDAN,
        category: VehicleCategory.MIDSIZE,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.GASOLINE,
        drivetrain: Drivetrain.FWD,
        seats: 5,

        pricePerHour: 13,
        pricePerDay: 125,
        pricePerWeek: 780,
        deposit: 250,
        kmIncludedPerDay: 230,
        pricePerExtraKm: 0.55,
        minHours: 1,
        minDriverAge: 21,
        insuranceIncluded: true,

        rules: 'No fumar dentro del vehículo',
        description: 'Elegante, seguro y eficiente en ruta.',
        status: VehicleStatus.PUBLISHED,

        city: 'Salta',
        state: 'Salta',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Nissan Kicks 2021',
        make: 'Nissan',
        model: 'Kicks',
        year: 2021,
        bodyType: BodyType.SUV,
        category: VehicleCategory.SUV,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.GASOLINE,
        drivetrain: Drivetrain.FWD,
        seats: 5,

        pricePerHour: 16,
        pricePerDay: 160,
        pricePerWeek: 900,
        deposit: 350,
        kmIncludedPerDay: 300,
        pricePerExtraKm: 0.7,
        minHours: 2,
        minDriverAge: 23,
        insuranceIncluded: true,

        rules: 'Prohibido off-road extremo',
        description: 'SUV moderna, ideal para viajes largos.',
        status: VehicleStatus.PUBLISHED,

        city: 'San Miguel de Tucumán',
        state: 'Tucumán',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Toyota Hilux 2018',
        make: 'Toyota',
        model: 'Hilux',
        year: 2018,
        bodyType: BodyType.PICKUP,
        category: VehicleCategory.PICKUP,
        transmission: Transmission.MANUAL,
        fuel: FuelType.DIESEL,
        drivetrain: Drivetrain.AWD,
        seats: 5,

        pricePerHour: 20,
        pricePerDay: 200,
        pricePerWeek: 1200,
        deposit: 450,
        kmIncludedPerDay: 350,
        pricePerExtraKm: 0.9,
        minHours: 2,
        minDriverAge: 25,
        insuranceIncluded: true,

        rules: 'Evitar caminos excesivamente rocosos',
        description: 'Potencia y confiabilidad para cualquier terreno.',
        status: VehicleStatus.PUBLISHED,

        city: 'San Juan',
        state: 'San Juan',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Tesla Model 3 2022',
        make: 'Tesla',
        model: 'Model 3',
        year: 2022,
        bodyType: BodyType.SEDAN,
        category: VehicleCategory.ELECTRIC,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.ELECTRIC,
        drivetrain: Drivetrain.RWD,
        seats: 5,

        pricePerHour: 22,
        pricePerDay: 220,
        pricePerWeek: 1350,
        deposit: 600,
        kmIncludedPerDay: 300,
        pricePerExtraKm: 0.8,
        minHours: 2,
        minDriverAge: 25,
        insuranceIncluded: true,

        rules: 'Cargar en estaciones aprobadas',
        description: 'Tecnología avanzada, conducción silenciosa.',
        status: VehicleStatus.PUBLISHED,

        city: 'Buenos Aires',
        state: 'Buenos Aires',
        country: 'Argentina',

        ownerId: owner.id,
      },
      {
        title: 'Audi A4 2021',
        make: 'Audi',
        model: 'A4',
        year: 2021,
        bodyType: BodyType.SEDAN,
        category: VehicleCategory.PREMIUM,
        transmission: Transmission.AUTOMATIC,
        fuel: FuelType.GASOLINE,
        drivetrain: Drivetrain.AWD,
        seats: 5,

        pricePerHour: 26,
        pricePerDay: 260,
        pricePerWeek: 1600,
        deposit: 700,
        kmIncludedPerDay: 350,
        pricePerExtraKm: 1.2,
        minHours: 2,
        minDriverAge: 25,
        insuranceIncluded: true,

        rules: 'Solo nafta premium',
        description: 'Lujo, confort y seguridad.',
        status: VehicleStatus.PUBLISHED,

        city: 'CABA',
        state: 'Buenos Aires',
        country: 'Argentina',

        ownerId: owner.id,
      },
    ];
    // ✅ CREA TODOS LOS PINS EN UNA SOLA OPERACIÓN
    await this.prisma.pin.createMany({ data: pinsData });

    // ✅ AHORA TRAEMOS LOS IDs para generar sus fotos
    const createdPins = await this.prisma.pin.findMany({
      where: { ownerId: owner.id },
      select: { id: true },
    });

    // ✅ Crea fotos para cada pin
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
