-- ==============================================================================
-- DATABASE INITIALIZATION & OPTIMIZATION SCRIPT (UAV DETECTION SYSTEM)
-- Database Name: uav_detection
-- Auto-Purge: Configured for 30 Days Data Retention (via Cascade & Event)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `uav_detection`
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `uav_detection`;

-- ปิดการตรวจสอบชั่วคราวเพื่อความราบรื่นในการสร้างโครงสร้างใหม่
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

-- ------------------------------------------------------------------------------
-- 1. Table structure for table `users`
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` ENUM('admin', 'user', 'banned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `profile_image` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted` TINYINT DEFAULT '0',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `idx_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (
  `username`,
  `password`,
  `role`
) VALUES (
  'IBobo',
  '$2b$10$RzC/JEdFOGjTVp3SuIGGK.mYE.w0Okk7VH6OjoPg02ekALUklYSrK',
  'admin'
);

-- ------------------------------------------------------------------------------
-- 2. Table structure for table `cameras`
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `cameras`;
CREATE TABLE `cameras` (
  `camera_id` INT NOT NULL AUTO_INCREMENT,
  `camera_name` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ชื่อจุดติดตั้ง เช่น ดาดฟ้าตึก A',
  `latitude` DECIMAL(10,8) NOT NULL COMMENT 'พิกัดติดตั้งกล้อง',
  `longitude` DECIMAL(11,8) NOT NULL,
  `status` ENUM('active', 'inactive', 'maintenance') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `heading` INT DEFAULT '0',
  `controllable` TINYINT DEFAULT '0',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_update` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- [ปรับปรุง] อัปเดตเวลาอัตโนมัติเมื่อข้อมูลเปลี่ยน
  `deleted` TINYINT DEFAULT '0',
  PRIMARY KEY (`camera_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table structure for table `camera_assignments`
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `camera_assignments`;
CREATE TABLE `camera_assignments` (
  `user_id` INT NOT NULL,
  `camera_id` INT NOT NULL,
  `permission_level` ENUM('viewer', 'operator', 'admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'viewer',
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `camera_id`),
  CONSTRAINT `fk_assignment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_assignment_camera` FOREIGN KEY (`camera_id`) REFERENCES `cameras` (`camera_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Table structure for table `events`
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
  `event_id` INT NOT NULL AUTO_INCREMENT,
  `camera_id` INT NOT NULL,
  `start_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` DATETIME DEFAULT NULL,
  `note` TEXT COLLATE utf8mb4_unicode_ci COMMENT 'บันทึกเพิ่มเติมจาก User',
  `seen` TINYINT NOT NULL DEFAULT '0',
  PRIMARY KEY (`event_id`),
  KEY `idx_camera_id` (`camera_id`),
  KEY `idx_start_time` (`start_time`), -- [ปรับปรุง] คงไว้สำหรับช่วยความเร็วในการค้นหาช่วงเวลา
  CONSTRAINT `fk_event_camera` FOREIGN KEY (`camera_id`) REFERENCES `cameras` (`camera_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Table structure for table `event_datas`
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `event_datas`;
CREATE TABLE `event_datas` (
  `event_data_id` INT NOT NULL AUTO_INCREMENT,
  `event_id` INT NOT NULL,
  `camera_id` INT NOT NULL,
  `event_data` JSON DEFAULT NULL,
  `image_path` VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_stamp` DATETIME DEFAULT NULL,
  PRIMARY KEY (`event_data_id`),
  KEY `idx_ed_camera_id` (`camera_id`),
  KEY `idx_ed_event_id` (`event_id`),
  KEY `idx_ed_timestamp` (`time_stamp`), -- [ปรับปรุง] เพิ่ม Index ที่ Timestamp ช่วยเพิ่มความเร็วในการสแกนข้อมูลเวลา
  
  -- 🌟 [จุดปรับปรุงสำคัญมาก]: เปลี่ยนเป็น ON DELETE CASCADE 
  -- เมื่อเหตุการณ์ในตารางแม่ (events) ถูกลบ ข้อมูลรูปภาพ/รายละเอียดในตารางนี้จะถูกลบตามทันทีอัตโนมัติ
  CONSTRAINT `fk_event_data_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_event_data_camera` FOREIGN KEY (`camera_id`) REFERENCES `cameras` (`camera_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เปิดคืนการตรวจสอบความสัมพันธ์
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
SET SQL_MODE=@OLD_SQL_MODE;

-- ------------------------------------------------------------------------------
-- 6. AUTOMATION: MySQL Event Scheduler Configuration (30 Days Retention)
-- ------------------------------------------------------------------------------
-- ตรวจสอบให้แน่ใจว่าเปิดใช้งานระบบตั้งเวลาในตัว MySQL
SET GLOBAL event_scheduler = ON;

DELIMITER $$

DROP EVENT IF EXISTS `purge_uav_events_daily`$$

CREATE EVENT `purge_uav_events_daily`
ON SCHEDULE EVERY 1 DAY
STARTS DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 1 DAY), INTERVAL 2 HOUR) -- ตั้งเวลาทำงานทุกวัน ตอนตี 2:00 น.
COMMENT 'ลบประวัติเหตุการณ์ตรวจจับ UAV ที่เก่ากว่า 30 วันอัตโนมัติ'
DO
BEGIN
    -- สั่งลบเพียงตารางเดียว เนื่องจากโครงสร้างใหม่ใช้ ON DELETE CASCADE แล้ว
    -- MySQL จะทำการลบแถวที่เกี่ยวข้องกันในตาราง event_datas ให้ทันทีอย่างปลอดภัยและรวดเร็ว
    DELETE FROM `events` 
    WHERE `start_time` < NOW() - INTERVAL 30 DAY;
END$$

DELIMITER ;