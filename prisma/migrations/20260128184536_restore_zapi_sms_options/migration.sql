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
