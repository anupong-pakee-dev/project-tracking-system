-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'paused', 'done');

-- CreateEnum
CREATE TYPE "LogKind" AS ENUM ('update', 'scope');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" VARCHAR(16) NOT NULL,
    "start_date" DATE NOT NULL,
    "target_date" DATE NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "skip_weekends" BOOLEAN NOT NULL DEFAULT false,
    "manual_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed_at" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_logs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "kind" "LogKind" NOT NULL DEFAULT 'update',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_project_id_sort_order_idx" ON "tasks"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "progress_logs_project_id_date_idx" ON "progress_logs"("project_id", "date");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
