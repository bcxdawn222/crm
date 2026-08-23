-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `contractAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `contractEndDate` DATETIME(3) NULL,
    ADD COLUMN `contractStartDate` DATETIME(3) NULL,
    ADD COLUMN `cooperationNotes` TEXT NULL,
    ADD COLUMN `lastVisitAt` DATETIME(3) NULL,
    ADD COLUMN `nextVisitAt` DATETIME(3) NULL,
    ADD COLUMN `renewalReminderDays` INTEGER NULL DEFAULT 30,
    ADD COLUMN `visitFrequency` VARCHAR(50) NULL,
    MODIFY `status` ENUM('ACTIVE', 'INACTIVE', 'FOLLOWING', 'CONVERTED', 'LOST', 'COOPERATING') NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX `Customer_contractEndDate_idx` ON `Customer`(`contractEndDate`);

-- CreateIndex
CREATE INDEX `Customer_nextVisitAt_idx` ON `Customer`(`nextVisitAt`);
