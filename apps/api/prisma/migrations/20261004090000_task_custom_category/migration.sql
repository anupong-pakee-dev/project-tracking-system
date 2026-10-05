-- Category: enum → free text (preset keys keep their values; users can type their own).
ALTER TABLE "tasks" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "category" TYPE VARCHAR(40) USING "category"::text;
ALTER TABLE "tasks" ALTER COLUMN "category" SET DEFAULT 'other';
DROP TYPE "TaskCategory";

-- Priority: required, COULD by default. Tasks without one become COULD.
UPDATE "tasks" SET "priority" = 'could' WHERE "priority" IS NULL;
ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'could';
ALTER TABLE "tasks" ALTER COLUMN "priority" SET NOT NULL;
