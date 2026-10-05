/* SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"; */
/* SET AUTOCOMMIT = 0; */
/* START TRANSACTION; */
/* SET time_zone = "+00:00"; */

-- --------------------------------------------------------

--
-- Table structure for table `Admin` generated from model 'Admin'
--

CREATE TABLE IF NOT EXISTS `admin` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `username` TEXT NOT NULL,
  `password` TEXT NOT NULL,
  `sessions` JSON,
  `role` TEXT NOT NULL DEFAULT 'viewer',
  `created_at` BIGINT NOT NULL
);

--
-- Table structure for table `Session` generated from model 'Session'
--

CREATE TABLE IF NOT EXISTS `session` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `admin_id` TEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `expires_at` BIGINT
);

--
-- Table structure for table `Booking` generated from model 'Booking'
--

CREATE TABLE IF NOT EXISTS `booking` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `phone` TEXT NOT NULL,
  `email` TEXT NOT NULL,
  `session_type` TEXT NOT NULL,
  `session_date` DATE NOT NULL,
  `comment` TEXT NOT NULL,
  `notes` JSON,
  `created_at` BIGINT NOT NULL,
  `viewed_at` BIGINT,
  `deleted_at` BIGINT
);

--
-- Table structure for table `Album` generated from model 'Album'
--

CREATE TABLE IF NOT EXISTS `album` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `image_ids` JSON,
  `created_at` BIGINT NOT NULL,
  `viewed_at` BIGINT,
  `deleted_at` BIGINT
);

--
-- Table structure for table `Image` generated from model 'Image'
--

CREATE TABLE IF NOT EXISTS `image` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `album_id` TEXT NOT NULL,
  `created_at` BIGINT NOT NULL,
  `viewed_at` BIGINT,
  `deleted_at` BIGINT
);
