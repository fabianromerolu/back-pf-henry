/* eslint-disable prettier/prettier */
import { BadRequestException } from '@nestjs/common';
import { price } from './ordersInterface';

export function priceCalculator(
  price: price,
  start_date: Date,
  end_date: Date,
): number {
  const duration = end_date.getTime() - start_date.getTime();

  const MS_PER_HOUR = 1000 * 60 * 60;
  const MS_PER_DAY = MS_PER_HOUR * 24;
  const MS_PER_WEEK = MS_PER_DAY * 7;

  const totalWeeks = Math.floor(duration / MS_PER_WEEK);
  const remainingAfterWeeks = duration % MS_PER_WEEK;

  const totalDays = Math.floor(remainingAfterWeeks / MS_PER_DAY);
  const remainingAfterDays = remainingAfterWeeks % MS_PER_DAY;

  const totalHours = Math.floor(remainingAfterDays / MS_PER_HOUR);

  const weekPrice = Number(price.pricePerWeek);
  const dayPrice = Number(price.pricePerDay);
  const hourPrice = Number(price.pricePerHour);

  const TotalPrice =
    totalWeeks * weekPrice + totalDays * dayPrice + totalHours * hourPrice;

  return TotalPrice;
}

export function validateDates(startDate: Date, endDate: Date) {
  const now = new Date();

  if (startDate < now) {
    throw new BadRequestException('La fecha de inicio erronea');
  }

  if (endDate <= startDate) {
    throw new BadRequestException('Periodo incorrecto');
  }

  const minRentalHours = 24;
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < minRentalHours) {
    throw new BadRequestException(
      `El período mínimo de alquiler es ${minRentalHours} horas`,
    );
  }
}
