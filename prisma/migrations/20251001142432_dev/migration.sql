-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `status` ENUM('approved', 'blocked') NOT NULL DEFAULT 'blocked',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `email_to` VARCHAR(255) NOT NULL,
    `email_title` VARCHAR(255) NOT NULL,
    `status` JSON NOT NULL,
    `email_header_title` LONGTEXT NOT NULL,
    `email_content` LONGTEXT NOT NULL,
    `email_footer_content` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `number` VARCHAR(255) NOT NULL,
    `message` LONGTEXT NOT NULL,
    `status` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `number` VARCHAR(255) NOT NULL,
    `zapi_client_instance` VARCHAR(191) NOT NULL,
    `message` LONGTEXT NOT NULL,
    `status` JSON NOT NULL,
    `received` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `smtp_options_for_customers` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `mail_from_address` VARCHAR(255) NOT NULL,
    `mail_from_name` VARCHAR(255) NOT NULL,
    `smtp_host` VARCHAR(255) NOT NULL,
    `smtp_pass` VARCHAR(255) NOT NULL,
    `smtp_port` INTEGER NOT NULL,
    `smtp_user` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_options_for_customers` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `nvoip_api_key` VARCHAR(255) NOT NULL,
    `nvoip_api_url` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_options_for_customers` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `zapi_client_token` VARCHAR(255) NOT NULL,
    `zapi_client_instance` VARCHAR(255) NOT NULL,
    `zapi_client_url` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
