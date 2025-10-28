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

  const TotalPrice =
    totalWeeks * price.pricePerWeek +
    totalDays * price.pricePerDay +
    totalHours * price.pricePerHour;

  return TotalPrice;
}
