<?php
require_once __DIR__ . '/dbconfig.php';
try {
  $connwebjmr = ms_pdo('webjmrdb');
  $defaultProjID = array();
  $dProjQ = "SELECT * FROM projectstable WHERE fldDirect=0 AND fldDelete=0";
  $dProjStmt = $connwebjmr->query($dProjQ);
  if ($dProjStmt->rowCount() > 0) {
    $dProjArr = $dProjStmt->fetchAll();
    foreach ($dProjArr as $dProj) {
      array_push($defaultProjID, $dProj['fldID']);
    }
  }
  $leaveQ = "SELECT fldID FROM projectstable WHERE fldProject='Leave'";
  $leaveStmt = $connwebjmr->query($leaveQ);
  $leaveID = $leaveStmt->fetchColumn();
  $mngProjQ = "SELECT fldID FROM projectstable WHERE fldProject='Management'";
  $mngProjStmt = $connwebjmr->query($mngProjQ);
  $mngProjID = $mngProjStmt->fetchColumn();
  $trainProjQ = "SELECT fldID FROM projectstable WHERE fldProject='Training'";
  $trainProjStmt = $connwebjmr->query($trainProjQ);
  $trainProjID = $trainProjStmt->fetchColumn();
  $solProjQ = "SELECT fldID FROM projectstable WHERE fldProject='Development, Analysis & IT'";
  $solProjStmt = $connwebjmr->query($solProjQ);
  $solProjID = $solProjStmt->fetchColumn();
  $wfhQ = "SELECT fldID FROM dispatch_locations WHERE fldLocation = 'WFH'";
  $wfhStmt = $connwebjmr->query($wfhQ);
  $wfhID = $wfhStmt->fetchColumn();
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(["error" => "webjmrdb connection failed"]);
  exit;
}
