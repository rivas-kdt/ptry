<?php
require_once __DIR__ . '/dbconfig.php';
$connams = null;
try {
  $amsHost = getenv('MS_AMS_HOST') ?: 'kdt-admin';
  $amsPort = getenv('MS_AMS_PORT') ?: '3000';
  $amsDb = getenv('MS_AMS_DB') ?: 'pc_login';
  $amsUser = getenv('MS_AMS_USER') ?: 'kdt';
  $amsPass = getenv('MS_AMS_PASS') !== false ? getenv('MS_AMS_PASS') : 'none';
  $dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $amsHost,
    $amsPort,
    $amsDb
  );
  $connams = new PDO($dsn, $amsUser, $amsPass, [
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_TIMEOUT => 2,
  ]);
} catch (PDOException $e) {
  $connams = null;
}
