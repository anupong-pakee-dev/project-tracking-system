-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('uxui', 'system', 'other');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('must', 'should', 'could');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "category" "TaskCategory" NOT NULL DEFAULT 'other',
ADD COLUMN     "priority" "TaskPriority";
