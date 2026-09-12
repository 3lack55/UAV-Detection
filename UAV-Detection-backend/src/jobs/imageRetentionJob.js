import fs from "fs";
import path from "path";
import cron from "node-cron";

const IMAGES_DIR = path.join("uploads", "event_images");
const RETENTION_DAYS = parseInt(process.env.IMAGE_RETENTION_DAYS, 10) || 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

async function purgeOldImages() {
    let files;
    try {
        files = await fs.promises.readdir(IMAGES_DIR);
    } catch (error) {
        if (error.code === "ENOENT") return;
        console.error("Image retention job: failed to read directory:", error);
        return;
    }

    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
        const filePath = path.join(IMAGES_DIR, file);
        try {
            const stats = await fs.promises.stat(filePath);
            if (now - stats.mtimeMs > RETENTION_MS) {
                await fs.promises.unlink(filePath);
                deletedCount++;
            }
        } catch (error) {
            console.error(`Image retention job: failed to process ${filePath}:`, error);
        }
    }

    if (deletedCount > 0) {
        console.log(`Image retention job: deleted ${deletedCount} image(s) older than ${RETENTION_DAYS} days.`);
    }
}

function startImageRetentionJob() {
    // Runs daily at 02:00, matching the MySQL 30-day event-data purge schedule.
    cron.schedule("0 2 * * *", purgeOldImages);
    purgeOldImages().catch((error) => console.error("Image retention job: initial run failed:", error));
}

export { startImageRetentionJob, purgeOldImages };
