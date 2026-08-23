-- Add fields and contract archive model that were present in the Prisma schema
-- but missing from the existing production migration history.
ALTER TABLE `Customer` ADD COLUMN `operationManagerId` VARCHAR(191) NULL,
    ADD COLUMN `originalSalesId` VARCHAR(191) NULL,
    ADD COLUMN `publicPoolEnteredAt` DATETIME(3) NULL,
    ADD COLUMN `publicPoolHistory` JSON NULL,
    ADD COLUMN `publicPoolReason` VARCHAR(200) NULL,
    ADD COLUMN `reminderDisabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reminderDisabledAt` DATETIME(3) NULL,
    ADD COLUMN `reminderDisabledReason` VARCHAR(500) NULL;

ALTER TABLE `User` ADD COLUMN `claimHoldDays` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `maxActiveCustomers` INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN `maxDailyClaims` INTEGER NOT NULL DEFAULT 5;

CREATE TABLE `ContractArchive` (
    `id` VARCHAR(191) NOT NULL,
    `archiveNo` VARCHAR(50) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isLatest` BOOLEAN NOT NULL DEFAULT true,
    `parentArchiveId` VARCHAR(191) NULL,
    `contractName` VARCHAR(200) NOT NULL,
    `contractType` VARCHAR(50) NULL,
    `signDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `contractAmount` DECIMAL(12, 2) NULL,
    `fileName` VARCHAR(200) NOT NULL,
    `ossUrl` VARCHAR(500) NOT NULL,
    `ossKey` VARCHAR(300) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `fileType` VARCHAR(20) NOT NULL,
    `archivedBy` VARCHAR(191) NOT NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContractArchive_archiveNo_key`(`archiveNo`),
    INDEX `ContractArchive_customerId_idx`(`customerId`),
    INDEX `ContractArchive_archivedBy_idx`(`archivedBy`),
    INDEX `ContractArchive_isLatest_idx`(`isLatest`),
    INDEX `ContractArchive_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Customer_publicPoolEnteredAt_idx` ON `Customer`(`publicPoolEnteredAt`);

ALTER TABLE `Customer` ADD CONSTRAINT `Customer_operationManagerId_fkey`
    FOREIGN KEY (`operationManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractArchive` ADD CONSTRAINT `ContractArchive_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ContractArchive` ADD CONSTRAINT `ContractArchive_archivedBy_fkey`
    FOREIGN KEY (`archivedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContractArchive` ADD CONSTRAINT `ContractArchive_parentArchiveId_fkey`
    FOREIGN KEY (`parentArchiveId`) REFERENCES `ContractArchive`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
