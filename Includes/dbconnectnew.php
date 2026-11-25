<?php
require_once __DIR__ . '/dbconfig.php';
try {
  $connnew = ms_pdo('kdtphdb_new');
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(["error" => "kdtphdb_new connection failed"]);
  exit;
}
