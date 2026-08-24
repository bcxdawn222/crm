DROP INDEX `ContractArchive_customerId_contractName_version_key` ON `ContractArchive`;
DROP INDEX `ContractArchive_requestId_key` ON `ContractArchive`;
DROP INDEX `Payment_requestId_key` ON `Payment`;
DROP INDEX `Order_requestId_key` ON `Order`;

ALTER TABLE `ContractArchive`
  DROP COLUMN `fileHash`,
  DROP COLUMN `requestId`;

ALTER TABLE `Payment` DROP COLUMN `requestId`;
ALTER TABLE `Order` DROP COLUMN `requestId`;
