<?php
#region database connections
require_once __DIR__ . '/../Includes/dbconnectwebjmr.php';
require_once __DIR__ . '/../Includes/dbconnectnew.php';
require_once __DIR__ . '/../Includes/globalFunctions.php';
#endregion

#region timezone
date_default_timezone_set('Asia/Manila');
#endregion

#region variables
$groupSel = $_POST['groupSel'] ?? NULL;
$yearMonth = $_POST['monthSel'] ?? date("Y-04");
$cutOff = $_REQUEST['getHalfSel'] ?? "1";
$firstDay = getFirstday($yearMonth, $cutOff);
$lastDay = getLastday($yearMonth, $cutOff, $firstDay);
$dateRangeStatement = "dr.fldDate >= '$firstDay' AND dr.fldDate < '$lastDay'";

$empStatement = "";
$empNameStatement = "";
if (!empty($_POST['empArray'])) {
    $employeeArray = json_decode($_POST['empArray']);
    $implodeString = implode("','", $employeeArray);
    $empStatement = "AND dr.fldEmployeeNum IN ('$implodeString')";
    $empNameStatement = "'$implodeString'";
}

$location = $_POST['location'] ?? null;
$locStatement = match(true) {
    $location == 0 => "AND dr.fldLocation IN (1,2)",
    $location == -1 => "AND dr.fldLocation IN (1,8)",
    default => "AND dr.fldLocation = '$location'"
};

$includeOGP = isset($_POST['getOGP']) && filter_var($_POST['getOGP'], FILTER_VALIDATE_BOOLEAN);
#endregion

#region employee names
$empNameAssoc = [];
if (!empty($empNameStatement)) {
    $empNameQ = "SELECT fldEmployeeNum emp_num, fldFirstname firstName, fldSurname lastName
        FROM emp_prof
        WHERE fldEmployeeNum IN ($empNameStatement)";
    $empNameStmt = $connkdt->prepare($empNameQ);
    $empNameStmt->execute();
    foreach ($empNameStmt->fetchAll() as $row) {
        $empNameAssoc[(string)$row['emp_num']] = [
            'firstName' => $row['firstName'] ?? '',
            'lastName' => $row['lastName'] ?? '',
        ];
    }
}
#endregion

#region query dailyreport with IOW / JRD names
$start = microtime(true);
$entriesArray = [];

$query = "
    SELECT
        dr.fldEmployeeNum AS eNum,
        dr.fldDate AS eDate,
        dr.fldMHType AS eMHT,
        dr.fldDuration AS projMinute,
        dr.fldItem AS itemID,
        iow.fldItem AS itemName,
        dr.fldJobRequestDescription AS jrdId,
        COALESCE(NULLIF(jrd.fldJob, ''), dr.fldJobRequestDescription) AS jrdName,
        dr.fldGroup AS entryGroup,
        pt.fldID AS projID,
        pt.fldProject AS projName,
        pt.fldGroup AS projGroup,
        pt.fldPriority AS projPriority,
        pt.fldActive AS projActive,
        dr.fldLocation AS projLocation
    FROM dailyreport dr
    JOIN projectstable pt ON dr.fldProject = pt.fldID
    LEFT JOIN itemofworkstable iow ON iow.fldID = dr.fldItem
    LEFT JOIN drawingreference jrd ON jrd.fldID = dr.fldJobRequestDescription
    WHERE $dateRangeStatement $empStatement $locStatement
    ORDER BY pt.fldPriority DESC, pt.fldActive DESC, iow.fldPriority DESC, jrd.fldActive DESC, jrd.fldPriority
";

$stmt = $connwebjmr->prepare($query);
$stmt->execute();

foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $entry) {
    $empNum = $entry['eNum'];
    $projID = $entry['projID'];
    $itemID = $entry['itemID'];
    $projName = $entry['projName'];
    $projGroup = $entry['projGroup'];
    $entryGroup = $entry['entryGroup'];

    $projLocation = match($entry['projLocation']) {
        "1" => "KDT",
        "2" => "WFH",
        "8" => "HWFH",
        default => "Dispatch"
    };

    $hours = $entry['projMinute'] / 60;
    $entryDay = date("d", strtotime($entry['eDate']));
    $isOT = ($entry['eMHT'] == 1);
    $isLeave = ($projID == 6);

    // Determine isHiram (exclude leaves from this check)
    $isHiram = false;
    if (!$isLeave) {
        $isHiram = (
            ($projGroup !== null && $projGroup !== $groupSel) || // project has different group
            ($projGroup === null && $entryGroup !== $groupSel)   // general project, check entryGroup
        );
    }

    // OGP filter logic
    if (!$includeOGP) {
        $shouldInclude = (
            ($projGroup === null && $entryGroup === $groupSel) ||
            ($projGroup !== null && $projGroup === $groupSel)
        );
        if (!$shouldInclude) {
            continue;
        }
    }

    // Build label
    $projectLabel = $projName;
    if ($isHiram) {
        if ($projGroup !== null) {
            $projectLabel .= " ({$projGroup})[ogp]";
        } else {
            $projectLabel .= " [ogp]";
        }
    }

    // Init employee block
    $nameKey = (string)$empNum;
    $entriesArray[$empNum] ??= [
        "firstName" => $empNameAssoc[$nameKey]['firstName'] ?? '',
        "lastName" => $empNameAssoc[$nameKey]['lastName'] ?? '',
        "empId" => $empNum,
        "RegularHourEntries" => [],
        "OTEntries" => [],
        "Leaves" => []
    ];

    // Build date entry with iIndex per entry
    $entryHoursObj = [
        "entryDate" => $entryDay,
        "hours" => $hours,
        "location" => $projLocation,
        "iIndex" => $itemID,
        "itemName" => $entry['itemName'] ?? '',
        "jrdId" => $entry['jrdId'] ?? '',
        "jrdName" => $entry['jrdName'] ?? '',
    ];

    // Insert into appropriate category
    if ($isLeave) {
        $entriesArray[$empNum]["Leaves"][$projID] ??= [
            "pName" => $projectLabel,
            "pIndex" => $projID,
            "dateEntries" => []
        ];
        $entriesArray[$empNum]["Leaves"][$projID]["dateEntries"][] = $entryHoursObj;
    } else {
        // Regular
        $entriesArray[$empNum]["RegularHourEntries"][$projID] ??= [
            "pName" => $projectLabel,
            "pIndex" => $projID,
            "prio" => (int)($entry['projPriority'] ?? 0),
            "active" => (int)($entry['projActive'] ?? 0),
            "dateEntries" => []
        ];
        $entriesArray[$empNum]["RegularHourEntries"][$projID]["dateEntries"][] = $entryHoursObj;

        // If OT, add also to OTEntries
        if ($isOT) {
            $entriesArray[$empNum]["OTEntries"][$projID] ??= [
                "pName" => $projectLabel,
                "pIndex" => $projID,
                "prio" => (int)($entry['projPriority'] ?? 0),
                "active" => (int)($entry['projActive'] ?? 0),
                "dateEntries" => []
            ];
            $entriesArray[$empNum]["OTEntries"][$projID]["dateEntries"][] = $entryHoursObj;
        }
    }
}
$end = microtime(true);
#endregion

ob_start("ob_gzhandler");
echo json_encode($entriesArray);
ob_end_flush();
