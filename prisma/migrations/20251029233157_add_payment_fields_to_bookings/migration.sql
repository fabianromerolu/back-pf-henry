-- AlterTable
ALTER TABLE "Bookings" ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'UNPAID';
