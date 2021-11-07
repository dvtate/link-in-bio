-- Select database
CREATE DATABASE platfrm;
USE platfrm;

--- Users
-- Clients paying for the service
CREATE TABLE Users (
    userId BIGINT UNSIGNED PRIMARY KEY,
    email VARCHAR(128) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashedPassword CHAR(128) NOT NULL,
    createdTs BIGINT UNSIGNED NOT NULL -- when account was created
);

-- Email verification
CREATE TABLE UnverifiedEmails (
    userId BIGINT UNSIGNED REFERENCES Users,
    verificationCode VARCHAR(32) NOT NULL
);

-- Login tokens
CREATE TABLE AuthTokens (
    authToken VARCHAR(64) PRIMARY KEY,
    userId BIGINT UNSIGNED REFERENCES Users,
    authTokenExpiration DATETIME NOT NULL
);