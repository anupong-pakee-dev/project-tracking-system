-- A task can have several tags: category (one) → categories (array), keeping each task's tag.
ALTER TABLE "tasks" ADD COLUMN "categories" VARCHAR(40)[] NOT NULL DEFAULT ARRAY['other']::VARCHAR(40)[];
UPDATE "tasks" SET "categories" = ARRAY["category"]::VARCHAR(40)[];
ALTER TABLE "tasks" DROP COLUMN "category";
