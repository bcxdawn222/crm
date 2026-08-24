ALTER TABLE `Order`
  ADD COLUMN `requestId` VARCHAR(100) NULL;

ALTER TABLE `Payment`
  ADD COLUMN `requestId` VARCHAR(100) NULL;

ALTER TABLE `ContractArchive`
  ADD COLUMN `requestId` VARCHAR(100) NULL,
  ADD COLUMN `fileHash` VARCHAR(64) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX `Order_requestId_key` ON `Order`(`requestId`);
CREATE UNIQUE INDEX `Payment_requestId_key` ON `Payment`(`requestId`);
CREATE UNIQUE INDEX `ContractArchive_requestId_key` ON `ContractArchive`(`requestId`);
CREATE UNIQUE INDEX `ContractArchive_customerId_contractName_version_key`
  ON `ContractArchive`(`customerId`, `contractName`, `version`);
