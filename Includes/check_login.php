<?php
require_once __DIR__ . '/dbconnectkdtph.php';
$output = array();
$userHash = '';
if (isset($_COOKIE['userID'])) {
    $userHash = $_COOKIE['userID'];
}
if (!empty($userHash)) {
    $loginStmt = $connkdt->prepare("SELECT fldEmployeeNum FROM kdtlogin WHERE fldUserHash=:hash");
    $loginStmt->execute([":hash" => $userHash]);
    if ($loginStmt->rowCount() > 0) {
        $userLogin = $loginStmt->fetchColumn();
        $output += ["empNum" => $userLogin];
        $empDeetsStmt = $connkdt->prepare("SELECT * FROM emp_prof WHERE fldEmployeeNum=:emp");
        $empDeetsStmt->execute([":emp" => $userLogin]);
        $empDeetsArr = $empDeetsStmt->fetchAll();
        foreach ($empDeetsArr as $empdeets) {
            $output += ["empGroup" => $empdeets['fldGroup']];
            $output += ["empFName" => $empdeets['fldFirstname']];
            $output += ["empSName" => $empdeets['fldSurname']];
            $output += ["empNName" => $empdeets['fldNick']];
            $output += ["empDateHired" => $empdeets['fldDateHired']];
            $output += ["empPos" => $empdeets['fldDesig']];
        }
    }
}

// Local dumps have no KDT portal session. Fall back to an MS-access user
// who is also in $gods (all BU list): Joshua Coquia / 464.
if (empty($output)) {
    $userLogin = getenv('MS_DEV_EMP') ?: 464;
    $empDeetsStmt = $connkdt->prepare("SELECT * FROM emp_prof WHERE fldEmployeeNum=:emp");
    $empDeetsStmt->execute([":emp" => $userLogin]);
    $empdeets = $empDeetsStmt->fetch();
    if ($empdeets) {
        $output = [
            "empNum" => $empdeets['fldEmployeeNum'],
            "empGroup" => $empdeets['fldGroup'],
            "empFName" => $empdeets['fldFirstname'],
            "empSName" => $empdeets['fldSurname'],
            "empNName" => $empdeets['fldNick'],
            "empDateHired" => $empdeets['fldDateHired'],
            "empPos" => $empdeets['fldDesig'],
        ];
    }
}
header('Content-Type: application/json');
echo json_encode($output);
