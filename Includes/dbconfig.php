<?php
$dbconfig = [
  'host' => getenv('MS_DB_HOST') ?: 'localhost',
  'port' => getenv('MS_DB_PORT') ?: '3306',
  'user' => getenv('MS_DB_USER') ?: 'root',
  'pass' => getenv('MS_DB_PASS') !== false ? getenv('MS_DB_PASS') : '',
  'charset' => 'utf8mb4',
];

function ms_pdo(string $dbname): PDO
{
  global $dbconfig;
  $dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
    $dbconfig['host'],
    $dbconfig['port'],
    $dbname,
    $dbconfig['charset']
  );
  return new PDO($dsn, $dbconfig['user'], $dbconfig['pass'], [
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);
}
