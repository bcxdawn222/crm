-- CreateTable
CREATE TABLE `TelemarketingList` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `company` VARCHAR(200) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `position` VARCHAR(50) NULL,
    `industry` VARCHAR(50) NULL,
    `source` VARCHAR(100) NULL,
    `callTimes` INTEGER NOT NULL DEFAULT 0,
    `lastCallAt` DATETIME(3) NULL,
    `callDuration` INTEGER NULL,
    `status` ENUM('PENDING', 'CONNECTED', 'NOT_ANSWERED', 'BUSY', 'INVALID', 'CALLBACK', 'FOLLOW_UP', 'CONVERTED') NOT NULL DEFAULT 'PENDING',
    `result` ENUM('INTERESTED', 'NOT_INTERESTED', 'NEED_FOLLOWUP', 'WRONG_NUMBER', 'EMPTY_NUMBER', 'OTHER') NULL,
    `notes` TEXT NULL,
    `isEffective` BOOLEAN NOT NULL DEFAULT false,
    `customerId` VARCHAR(191) NULL,
    `salesId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TelemarketingList_customerId_key`(`customerId`),
    INDEX `TelemarketingList_salesId_idx`(`salesId`),
    INDEX `TelemarketingList_status_idx`(`status`),
    INDEX `TelemarketingList_isEffective_idx`(`isEffective`),
    INDEX `TelemarketingList_createdAt_idx`(`createdAt`),
    INDEX `TelemarketingList_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TelemarketingList` ADD CONSTRAINT `TelemarketingList_salesId_fkey` FOREIGN KEY (`salesId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TelemarketingList` ADD CONSTRAINT `TelemarketingList_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
