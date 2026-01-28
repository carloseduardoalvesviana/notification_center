/*
  Warnings:

  - You are about to drop the `sms_options_for_customers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `whatsapp_options_for_customers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `sms_options_for_customers`;

-- DropTable
DROP TABLE `whatsapp_options_for_customers`;

-- CreateTable
CREATE TABLE `whatsapp_evolution_options_for_customers` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
