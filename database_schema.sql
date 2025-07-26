-- Create the main database
CREATE DATABASE IF NOT EXISTS greenfuel_db;

-- Use the created database
USE greenfuel_db;

-- Table structure for admin users
-- This table stores the credentials for logging into the system.
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin user for initial login.
-- In a real-world application, passwords should be hashed.
-- For this example, we are storing it as plain text for simplicity.
INSERT INTO `admins` (`username`, `password`) VALUES ('admin', 'password123');


-- Table structure for asset issues
-- This table stores all the data from the asset handover form.
CREATE TABLE IF NOT EXISTS `asset_issues` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_name` VARCHAR(100) NOT NULL,
  `employee_code` VARCHAR(50) NOT NULL,
  `department` VARCHAR(100),
  `designation` VARCHAR(100),
  `location` VARCHAR(100),
  `phone_number` VARCHAR(20),
  `email_id` VARCHAR(100),
  `hod_name` VARCHAR(100),
  `asset_type` VARCHAR(50),
  `asset_code` VARCHAR(100),
  `make_model` VARCHAR(100),
  `serial_number` VARCHAR(100) NOT NULL UNIQUE,
  `hostname` VARCHAR(100),
  `ip_address` VARCHAR(50),
  `operating_system` VARCHAR(100),
  `ms_office_version` VARCHAR(50),
  `antivirus` VARCHAR(50),
  `sap_configured` VARCHAR(10),
  `backup_configured` VARCHAR(10),
  `printer_configured` VARCHAR(10),
  `other_software` TEXT,
  `remarks` TEXT,
  `old_laptop_serial` VARCHAR(100),
  `issue_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `engineer_name` VARCHAR(100),
  `hod_signature` VARCHAR(100),
  `user_signature` VARCHAR(100)
);
