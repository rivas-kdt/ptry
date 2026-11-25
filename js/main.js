//#region GLOBALS
const rootFolder = `//${document.location.hostname}`;

var allEmployees = {};

const Leaves = ["6"];
const oLeaves = { 27: "EL", 28: "ML", 29: "PL", 30: "TbL", 31: "LL" };
let global_holidays = [];
const today = new Date();
$("#monthSel").val(
  `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}`
);

//pang distinct. di ko alam kung may function ba na distinct hehe
const onlyUnique = (value, index, self) => {
  return self.indexOf(value) === index;
};



var _selectedMembers = [];
var empArray = [];
var _unifiedQ = [];
var _grpProj = [];
var _grpOT = [];
var _maxDays = 0;
var _emplist = [];
var _empDetails = [];
var _sundays = [];
var _saturdays = [];
var amsData = {};
var projectModes = {};
var filterActiveId = null;
var projectSortAlpha = false;
const FIXED_PROJECTS = [
  "management",
  "kdt internal activities",
  "training",
  "development, analysis & it",
  "business trip & other",
  "leave",
];
//#endregion
checkLogin()
  .then((emp) => {
    if (emp) {
      _empDetails = emp;
      msAccess();
      $(document).ready(function () {
        if (!$("#monthSel").val()) {
          $("#monthSel").val(
            `${today.getFullYear()}-${(today.getMonth() + 1)
              .toString()
              .padStart(2, "0")}`
          );
        }
        Promise.all([getGroupList(), getLocations(), fetchHolidays()]).then(
          ([grps, locs, hols]) => {
            fillGroups(grps);
            getEmployeeList().then((emplist) => {
              if (emplist) {
                emplist.map(fillMembers);
              }
            });
            global_holidays = hols;
            if (locs) {
              fillLocations(locs);
            }
          }
        );
      });
    } else {
      window.location.href = rootFolder + "/KDTPortalLogin"; //if result is 0, redirect to log in page
    }
  })
  .catch((error) => {
    alert(`${error}`);
  });
//#region BINDS

$(document).on("change", "#monthSel", function () {
  // $($('#members-label').nextAll()).remove()
  _selectedMembers = [];
  hideTable();
  getEmployeeList().then((emps) => {
    if (emps) {
      emps.map(fillMembers);
    }
  });

  $("#selAll").attr("class", "btn btn-primary w-100 mt-4 ");
  $("#selAll").text("Select all");
  $(".memBtn").attr("class", "w-100 btn btn-secondary memBtn");
  fetchHolidays().then(function (holidays) {
    global_holidays = holidays;
  });
});
$(document).on("change", "#buSel", function () {
  // $.ajaxSetup({ async: false });
  // getEmployeeList();
  // $.ajaxSetup({ async: true });
  // createTables($("#monthSel").val());
  getEmployeeList().then((emps) => {
    if (emps) {
      emps.map(fillMembers);
    }
  });
  _selectedMembers = [];
  hideTable();
  $("#selAll").attr("class", "btn btn-primary w-100 mt-4 ");
  $("#selAll").text("Select all");
  $(".memBtn").attr("class", "w-100 btn btn-secondary memBtn");
});

$(document).on("click", "#selAll", function () {
  $(this).toggleClass("btn-primary btn-secondary");
  if ($(this).attr("class").includes("btn-primary")) {
    $(this).text("Select all");
    $(".memBtn").attr("class", "w-100 btn btn-secondary memBtn");
  } else {
    $(this).text("Deselect All");
    $(".memBtn").attr("class", "w-100 btn btn-primary memBtn");
  }
  _selectedMembers = [];
  $(".memBtn.btn-primary").each(function () {
    _selectedMembers.push($(this).attr("emp-num"));
  });
  createTables($("#monthSel").val());
});

$(document).on("click", ".memBtn", function () {
  $(this).toggleClass("btn-primary btn-secondary");
  _selectedMembers = [];
  $(".memBtn.btn-primary").each(function () {
    _selectedMembers.push($(this).attr("emp-num"));
  });
  var allButtonsSelected =
    $(".memBtn").length === $(".memBtn.btn-primary").length;
  var selAllButton = $("#selAll");
  if (allButtonsSelected) {
    selAllButton.text("Deselect All");
    selAllButton.removeClass("btn-primary");
    selAllButton.addClass("btn-secondary");
  } else {
    selAllButton.text("Select all");
    selAllButton.removeClass("btn-secondary");
    selAllButton.addClass("btn-primary");
  }
  createTables($("#monthSel").val());
});
$(document).on("click", "#btnExport", function () {
  exportTable();
});
$(document).on("click", "#btnPrint", function () {
  printTable();
});
$(document).on("change", "#CO", function () {
  createTables($("#monthSel").val());
});
$(document).on("change", ".checkbox", function () {
  createTables($("#monthSel").val());
});
$(document).on("click", ".tog", function () {
  $(".left").toggleClass("hide");
});

$(document).on("change", "#locSel", function () {
  createTables($("#monthSel").val());
});
$(document).on("click", "#btnFilter", function () {
  openFilterModal();
});
$(document).on("click", "#btnSort", function () {
  projectSortAlpha = !projectSortAlpha;
  $(this).toggleClass("is-on", projectSortAlpha).text(projectSortAlpha ? "Sorted A–Z" : "Sort A–Z");
  if (_selectedMembers.length && Object.keys(allEmployees).length) paintReport();
  fillFilterProjectList($("#filterSearch").val());
});
$(document).on("click", "#filterClose", function () {
  closeFilterModal();
});
$(document).on("click", "#filterModal", function (e) {
  if (e.target === this) closeFilterModal();
});
$(document).on("input", "#filterSearch", function () {
  fillFilterProjectList($(this).val());
});
$(document).on("click", ".filter-project-btn", function () {
  setFilterActive($(this).attr("data-pid"));
});
$(document).on("change", "#filterIow, #filterJrd", function () {
  if (!filterActiveId) return;
  projectModes[filterActiveId] = {
    showIow: $("#filterIow").is(":checked"),
    showJrd: $("#filterJrd").is(":checked"),
  };
  updateFilterBadge();
  fillFilterProjectList($("#filterSearch").val());
  if (_selectedMembers.length) paintReport();
  syncFilterBulkButtons();
});
$(document).on("click", "#filterTickIow", function () {
  const next = !allProjectsHaveMode("showIow");
  applyFilterModesToAll({ showIow: next });
});
$(document).on("click", "#filterTickJrd", function () {
  const next = !allProjectsHaveMode("showJrd");
  applyFilterModesToAll({ showJrd: next });
});
$(document).on("click", "#filterClear", function () {
  applyFilterModesToAll({ showIow: false, showJrd: false }, true);
});
$(document).on("keydown", function (e) {
  if (e.key === "Escape") closeFilterModal();
});
//#endregion

//#region FUNCTIONS
function checkLogin() {
  // $.ajaxSetup({ async: false });
  // $.ajax({
  //   url: "Includes/check_login.php",
  //   success: function (data) {
  //     //ajax to check if user is logged in
  //     _empDetails = $.parseJSON(data);

  //     if (Object.keys(_empDetails).length < 1) {
  //       window.location.href = rootFolder + "/KDTPortalLogin"; //if result is 0, redirect to log in page
  //     }
  //     msAccess();
  //   },
  // });
  // $.ajaxSetup({ async: true });
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "GET",
      url: "Includes/check_login.php",
      dataType: "json",
      success: function (data) {
        const empdetails = data;
        resolve(empdetails);
        // //ajax to check if user is logged in
        // _empDetails = $.parseJSON(data);

        // if (Object.keys(_empDetails).length < 1) {
        //   window.location.href = rootFolder + "/KDTPortalLogin"; //if result is 0, redirect to log in page
        // }
        // msAccess();
      },
      error: function (xhr, status, error) {
        if (xhr.status === 404) {
          reject("Not Found Error: The requested resource was not found.");
        } else if (xhr.status === 500) {
          reject("Internal Server Error: There was a server error.");
        } else {
          reject("An unspecified error occurred while checking login details.");
        }
      },
    });
  });
}
function findListedEmployee(id) {
  const raw = String(id ?? "").trim();
  if (!raw) return null;
  return (
    _emplist.find((emp) => {
      const num = String(emp.empNum ?? "").trim();
      return num === raw || Number(num) === Number(raw);
    }) || null
  );
}
function employeeDisplayName(user) {
  const listed = findListedEmployee(user.empId);
  if (listed && listed.empName) {
    return String(listed.empName).replace(/\s+,/g, ",").trim();
  }
  const lastName = String(user.lastName || "").trim();
  const firstName = String(user.firstName || "").trim();
  if (lastName && firstName) return `${lastName}, ${firstName}`;
  return lastName || firstName || "";
}
function applyEmployeeNames(employees) {
  Object.keys(employees || {}).forEach((id) => {
    const listed = findListedEmployee(id) || findListedEmployee(employees[id].empId);
    if (!listed || !listed.empName) return;
    const parts = String(listed.empName).split(",");
    const lastName = (parts[0] || "").trim();
    const firstName = parts.slice(1).join(",").trim();
    employees[id].empId = employees[id].empId || listed.empNum || id;
    if (!String(employees[id].lastName || "").trim()) {
      employees[id].lastName = lastName;
    }
    if (!String(employees[id].firstName || "").trim()) {
      employees[id].firstName = firstName;
    }
  });
}
function fillEmployeeData(empEntries) {
  _selectedMembers.forEach((memberId) => {
    const employee = _emplist.find((emp) => emp["empNum"] === memberId);
    const empName = employee["empName"].split(", ");

    //Creating new Employee
    if (allEmployees[memberId] === undefined) {
      allEmployees[memberId] = {
        firstName: empName[1],
        lastName: empName[0],
        empId: memberId,
        RegularHourEntries: {},
        OTEntries: {},
        Leaves: [],
      };
    }
  });

  empEntries.forEach((entry) => {
    if (allEmployees[entry["empNum"]]["Leaves"] === undefined) {
      allEmployees[entry["empNum"]]["Leaves"] = [];
    }

    if (entry["pName"] === "Leave") {
      allEmployees[entry["empNum"]]["Leaves"].push({ ...entry });
    }

    const newEntry = {
      entryDate: entry["entryDate"],
      hours: entry["hours"],
    };
    if (entry["OT"] === true) {
      if (
        allEmployees[entry["empNum"]]["OTEntries"][entry["pIndex"]] ===
        undefined
      ) {
        //Create new project
        const newProjectEntry = {
          pName: entry["pName"],
          dateEntries: [],
          iIndex: entry["iIndex"],
          pIndex: entry["pIndex"],
        };
        allEmployees[entry["empNum"]]["OTEntries"][entry["pIndex"]] =
          newProjectEntry;
      }
      allEmployees[entry["empNum"]]["OTEntries"][entry["pIndex"]][
        "dateEntries"
      ].push(newEntry);
    } else if (entry["OT"] === false) {
      if (
        allEmployees[entry["empNum"]]["RegularHourEntries"][entry["pIndex"]] ===
        undefined
      ) {
        //Create new project
        const newProjectEntry = {
          pName: entry["pName"],
          dateEntries: [],
          iIndex: entry["iIndex"],
          pIndex: entry["pIndex"],
        };
        allEmployees[entry["empNum"]]["RegularHourEntries"][entry["pIndex"]] =
          newProjectEntry;
      }
      allEmployees[entry["empNum"]]["RegularHourEntries"][entry["pIndex"]][
        "dateEntries"
      ].push(newEntry);
    }
  });
}
function msAccess() {
  $.post(
    "ajax/ms_access.php",
    {
      empNum: _empDetails["empNum"],
    },
    function (data) {
      var access = $.parseJSON(data);
      if (!access) {
        alert("Access denied");
        window.location.href = "../";
      }
    }
  );
}
function getGroupList() {
  $("#buSel").empty();
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: "ajax/get_group_list.php",
      data: {
        empNum: _empDetails["empNum"],
      },
      dataType: "json",
      success: function (response) {
        const grplist = response;
        resolve(grplist);
      },
      error: function (xhr, status, error) {
        if (xhr.status === 404) {
          reject("Not Found Error: The requested resource was not found.");
        } else if (xhr.status === 500) {
          reject("Internal Server Error: There was a server error.");
        } else {
          reject("An unspecified error occurred while fetching group list.");
        }
      },
    });
  });
}
function fillGroups(grplist) {
  grplist.forEach((grp) => {
    $("#buSel").append(`<option>${grp}</option>`);
    $("#buSel").val(_empDetails["empGroup"]);
  });
}
function getEmployeeList() {
  const selDate = $("#monthSel").val();
  const grpSel = $("#buSel").val();
  const cutOff = $(`#CO`).val();
  $("#members-list").empty();
  // $.post(
  //   "ajax/get_emplist.php",
  //   {
  //     monthSel: selDate,
  //     groupSel: grpSel,
  //     getHalfSel: cutOff,
  //   },
  //   function (data) {
  //     _emplist = $.parseJSON(data);
  //     _emplist.map(fillMembers);
  //     _selectedMembers = _selectedMembers.filter((item) =>
  //       _emplist.some((myItem) => myItem.empNum === item)
  //     );
  //   }
  // );
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: "ajax/get_emplist.php",
      data: {
        monthSel: selDate,
        groupSel: grpSel,
        getHalfSel: cutOff,
      },
      dataType: "json",
      success: function (response) {
        const emplist = response;
        resolve(emplist);
      },
      error: function (xhr, status, error) {
        if (xhr.status === 404) {
          reject("Not Found Error: The requested resource was not found.");
        } else if (xhr.status === 500) {
          reject("Internal Server Error: There was a server error.");
        } else {
          reject("An unspecified error occurred while fetching employee list.");
        }
      },
    });
  });
}
function getLocations() {
  // $("#locSel").html(`<option loc-id=0>KDT/WFH</option>`);
  // var addString = ``;
  // $.ajax({
  //   url: "ajax/get_locations.php",
  //   success: function (data) {
  //     var locs = $.parseJSON(data);
  //     const locIDs = Object.keys(locs);
  //     locIDs.forEach((locID) => {
  //       const locName = locs[locID];
  //       addString += `<option loc-id=${locID}>${locName}</option>`;
  //     });
  //   },
  // });
  // $("#locSel").append(addString);
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "GET",
      url: "ajax/get_locations.php",
      dataType: "json",
      success: function (response) {
        const loc = response;
        resolve(loc);
      },
      error: function (xhr, status, error) {
        if (xhr.status === 404) {
          reject("Not Found Error: The requested resource was not found.");
        } else if (xhr.status === 500) {
          reject("Internal Server Error: There was a server error.");
        } else {
          reject("An unspecified error occurred while fetching locations.");
        }
      },
    });
  });
}
function fillLocations(locs) {
  $("#locSel").html(
    `<option loc-id=0>KDT/WFH</option><option loc-id='-1'>KDT/HWFH</option>`
  );
  $.each(locs, function (key, value) {
    var option = $("<option>").attr("loc-id", key).text(value);
    $("#locSel").append(option);
  });
}
//#region table creation

function createTables(ymVal, useAmsCache = false) {
  // console.time("createTables duration");
  _grpProj = [];
  _grpOT = [];
  allEmployees = {};
  var groupSel = $(`#buSel`).val();
  var halfSel = $(`#CO`).val();
  var getOGP = $(`.checkbox`).is(":checked"); //eto papalitan pag may checkbox na
  var location = $($(`#locSel`).find("option:selected")).attr("loc-id");
  if (_selectedMembers.length < 1) {
    hideTable();
    return;
  }

  if (useAmsCache === false || Object.entries(amsData).length < 1) {
    getAMS()
      .then((res) => {
        if (res.isSuccess) {
          amsData = res.data;
          $(".noShow").addClass("d-none");
          $(".lower .right").removeClass("d-none");
          $("#mainThead,#mainTbody,#subThead,#subTbody").empty();
          $.post(
            "php/get_entries.php",
            {
              monthSel: ymVal,
              empArray: JSON.stringify(_selectedMembers),
              groupSel: groupSel,
              getHalfSel: halfSel,
              getOGP: getOGP,
              location: location,
            },
            function (data) {
              var empEntries = $.parseJSON(data);
              allEmployees = empEntries;
              applyEmployeeNames(allEmployees);
              _maxDays = new Date(
                ymVal.split("-")[0],
                ymVal.split("-")[1],
                0
              ).getDate();
              paintReport();
            }
          );
        } else {
          alert(`${res.message}`);
        }
      })
      .catch((error) => {
        alert(`${error}`);
      });
  }

  // console.log(_selectedMembers);
}
function hideTable() {
  $(".noShow").removeClass("d-none");
  $(".lower .right").addClass("d-none");
}
function paintReport() {
  var ymVal = $("#monthSel").val();
  var getOGP = $(`.checkbox`).is(":checked");
  $(".noShow").addClass("d-none");
  $(".lower .right").removeClass("d-none");
  $("#mainThead,#mainTbody,#subThead,#subTbody").empty();
  createHeader();
  generateMainTable(allEmployees, getOGP);
  generateSubTable(allEmployees);
  if (_selectedMembers.length < 2) {
    $("#lowerT").addClass("d-none");
  } else {
    $("#lowerT").removeClass("d-none");
  }
  colorYellow();
  colorHolidays(global_holidays);
  colorWeekends(ymVal.split("-")[0], ymVal.split("-")[1]);
  arrangeProjectRows(document.getElementById("mainTbody"));
  arrangeProjectRows(document.getElementById("subTbody"));
  addWidthtoGroupTable();
  pinLeadColumns();
}
function normalizeProjectName(name) {
  return String(name || "")
    .replace(/\[ogp\]$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function fixedProjectIndex(name) {
  const cleaned = normalizeProjectName(String(name || "").replace(/^ot-\s*/i, ""));
  return FIXED_PROJECTS.indexOf(cleaned);
}
function orderProjectList(projects, nameOf) {
  const fixed = [];
  const regular = [];
  projects.forEach((project) => {
    const rank = fixedProjectIndex(nameOf(project));
    if (rank >= 0) fixed.push({ rank, project });
    else regular.push(project);
  });
  if (projectSortAlpha) {
    regular.sort((a, b) =>
      nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" })
    );
  } else {
    regular.sort(compareJmcProject);
  }
  fixed.sort((a, b) => a.rank - b.rank);
  return [...regular, ...fixed.map((item) => item.project)];
}
function compareJmcProject(a, b) {
  const prioA = Number(a.prio || 0);
  const prioB = Number(b.prio || 0);
  if (prioA !== prioB) return prioB - prioA;
  const activeA = Number(a.active || 0);
  const activeB = Number(b.active || 0);
  if (activeA !== activeB) return activeB - activeA;
  return String(a.pName || a.name || "").localeCompare(
    String(b.pName || b.name || ""),
    undefined,
    { sensitivity: "base" }
  );
}
function sortProjectRecords(projects) {
  return orderProjectList(projects, (project) => project.name);
}
function rowProjectName(row) {
  const named = row.querySelector(".name-text");
  return named ? named.textContent : row.cells[1] ? row.cells[1].textContent : "";
}
function isTopProjectRow(row) {
  return (
    row.classList.contains("pRow") &&
    !row.classList.contains("iowRow") &&
    !row.classList.contains("jrdRow") &&
    !row.classList.contains("otRow")
  );
}
function arrangeProjectRows(tbody) {
  if (!tbody) return;
  const rows = [...tbody.children];
  let cursor = 0;
  while (cursor < rows.length) {
    if (!isTopProjectRow(rows[cursor])) {
      cursor += 1;
      continue;
    }
    const blocks = [];
    while (cursor < rows.length && isTopProjectRow(rows[cursor])) {
      const block = [rows[cursor]];
      cursor += 1;
      while (
        cursor < rows.length &&
        (rows[cursor].classList.contains("iowRow") ||
          rows[cursor].classList.contains("jrdRow"))
      ) {
        block.push(rows[cursor]);
        cursor += 1;
      }
      blocks.push(block);
    }
    const last = blocks[blocks.length - 1];
    const after = last[last.length - 1].nextSibling;
    const parent = last[0].parentNode;
    const fixed = [];
    const regular = [];
    blocks.forEach((block) => {
      const rank = fixedProjectIndex(rowProjectName(block[0]));
      if (rank >= 0) fixed.push({ rank, block });
      else regular.push(block);
    });
    if (projectSortAlpha) {
      regular.sort((a, b) =>
        rowProjectName(a[0]).localeCompare(rowProjectName(b[0]), undefined, {
          sensitivity: "base",
        })
      );
    }
    fixed.sort((a, b) => a.rank - b.rank);
    [...regular, ...fixed.map((item) => item.block)].forEach((block) => {
      block.forEach((row) => parent.insertBefore(row, after));
    });
  }
}
function projectModeLabel(mode) {
  if (!mode) return "";
  if (mode.showIow && mode.showJrd) return "IOW + JRD";
  if (mode.showIow) return "IOW";
  if (mode.showJrd) return "JRD";
  return "";
}
function getProjectMode(pIndex) {
  return (
    projectModes[String(pIndex)] || { showIow: false, showJrd: false }
  );
}
const TEAMS_AVATAR_COLORS = [
  "#13A10E",
  "#00B7C3",
  "#0078D4",
  "#5B5FC7",
  "#8764B8",
  "#C239B3",
  "#E3008C",
  "#D13438",
  "#CA5010",
  "#8E562E",
  "#038387",
  "#4F6BED",
];
function memberInitials(firstName, lastName) {
  const first = String(firstName || "").replace(/[^A-Za-z]/g, "");
  const last = String(lastName || "").replace(/[^A-Za-z]/g, "");
  if (first && last) return (first[0] + last[0]).toUpperCase();
  const word = first || last || "?";
  return word.slice(0, 2).toUpperCase() || "?";
}
function avatarColor(key) {
  const text = String(key || "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAMS_AVATAR_COLORS[Math.abs(hash) % TEAMS_AVATAR_COLORS.length];
}
function filterAvatarsHtml(members) {
  if (!members || !members.length) return "";
  return `<span class="filter-avatars">${members
    .map((member) => {
      const initials = memberInitials(member.firstName, member.lastName);
      const title = `${member.lastName}, ${member.firstName}`.replace(
        /"/g,
        "&quot;"
      );
      return `<span class="ms-avatar" style="background-color:${avatarColor(
        member.empId || initials
      )}" title="${title}">${initials}</span>`;
    })
    .join("")}</span>`;
}
function collectedFilterProjects() {
  const seen = {};
  const addProject = (user, project) => {
    const id = String(project.pIndex || "");
    if (!id) return;
    if (!seen[id]) {
      seen[id] = {
        id,
        name: String(project.pName || "")
          .replace(/\[ogp\]$/, "")
          .trim(),
        prio: Number(project.prio || 0),
        active: Number(project.active || 0),
        members: [],
      };
    }
    const empId = String(user.empId || "");
    if (empId && !seen[id].members.some((member) => member.empId === empId)) {
      seen[id].members.push({
        empId,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  };
  Object.values(allEmployees).forEach((user) => {
    Object.values(user.RegularHourEntries || {}).forEach((project) => {
      addProject(user, project);
    });
    Object.values(user.OTEntries || {}).forEach((project) => {
      addProject(user, project);
    });
  });
  return sortProjectRecords(
    Object.values(seen).map((project) => {
      project.members.sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        )
      );
      return project;
    })
  );
}
function fillFilterProjectList(query) {
  const q = String(query || "").toLowerCase();
  const projects = collectedFilterProjects().filter((project) =>
    project.name.toLowerCase().includes(q)
  );
  const html = projects
    .map((project) => {
      const badge = projectModeLabel(getProjectMode(project.id));
      const active = String(filterActiveId) === project.id ? " active" : "";
      return `<button type="button" class="filter-project-btn${active}" data-pid="${project.id}">
        <span class="filter-project-top">
          <span>${project.name}</span>
          ${badge ? `<span class="filter-badge">${badge}</span>` : ""}
        </span>
        ${filterAvatarsHtml(project.members)}
      </button>`;
    })
    .join("");
  $("#filterProjectList").html(
    html || `<p class="filter-hint">Select employees to load projects.</p>`
  );
}
function updateFilterBadge() {
  fillFilterProjectList($("#filterSearch").val());
}
function setFilterActive(pid) {
  filterActiveId = pid;
  const mode = getProjectMode(pid);
  const project = collectedFilterProjects().find(
    (item) => item.id === String(pid)
  );
  $("#filterActiveName").text(project ? project.name : "Select a project");
  $("#filterActiveAvatars").html(
    project ? filterAvatarsHtml(project.members) : ""
  );
  $("#filterIow").prop("checked", mode.showIow);
  $("#filterJrd").prop("checked", mode.showJrd);
  updateFilterBadge();
  fillFilterProjectList($("#filterSearch").val());
}
function openFilterModal() {
  $("#filterModal").removeClass("d-none").attr("aria-hidden", "false");
  fillFilterProjectList($("#filterSearch").val());
  const projects = collectedFilterProjects();
  if (!filterActiveId && projects.length) setFilterActive(projects[0].id);
  else if (filterActiveId) setFilterActive(filterActiveId);
  syncFilterBulkButtons();
}
function closeFilterModal() {
  $("#filterModal").addClass("d-none").attr("aria-hidden", "true");
}
function applyFilterModesToAll(patch, replace = false) {
  collectedFilterProjects().forEach((project) => {
    const current = getProjectMode(project.id);
    projectModes[project.id] = replace
      ? { showIow: !!patch.showIow, showJrd: !!patch.showJrd }
      : {
          showIow: patch.showIow !== undefined ? patch.showIow : current.showIow,
          showJrd: patch.showJrd !== undefined ? patch.showJrd : current.showJrd,
        };
  });
  if (filterActiveId) {
    const mode = getProjectMode(filterActiveId);
    $("#filterIow").prop("checked", mode.showIow);
    $("#filterJrd").prop("checked", mode.showJrd);
  }
  updateFilterBadge();
  fillFilterProjectList($("#filterSearch").val());
  if (_selectedMembers.length) paintReport();
  syncFilterBulkButtons();
}
function allProjectsHaveMode(...keys) {
  const projects = collectedFilterProjects();
  if (!projects.length) return false;
  return projects.every((project) => {
    const mode = getProjectMode(project.id);
    return keys.every((key) => mode[key]);
  });
}
function syncFilterBulkButtons() {
  $("#filterTickIow").toggleClass("is-on", allProjectsHaveMode("showIow"));
  $("#filterTickJrd").toggleClass("is-on", allProjectsHaveMode("showJrd"));
}
function hoursByDay(details) {
  return details.reduce((map, curr) => {
    const day = String(curr.entryDate).padStart(2, "0");
    map[day] = (map[day] || 0) + Number(curr.hours || 0);
    return map;
  }, {});
}
function hourCellsFromMap(dateMap) {
  let cells = "";
  let total = 0;
  for (let x = 1; x <= _maxDays; x++) {
    const value = dateMap[padZero(x)] || dateMap[String(x)] || 0;
    total += Number(value) || 0;
    cells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      value ? value : ""
    }</td>`;
  }
  return { cells, total };
}
function namedHourRow(
  employeeId,
  pIndex,
  name,
  dateMap,
  extraClass,
  tree = { depth: 0, isLast: true, ancestorContinues: [] }
) {
  const { cells, total } = hourCellsFromMap(dateMap);
  if (!total) return "";
  return `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="pRow ${extraClass}" employee-number="${employeeId}" p-index="${pIndex}">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left" class="name-cell">${treeGutterHtml(tree)}<span class="name-text">${name}</span></td>
    ${totalThenDays(total, cells)}
  </tr>`;
}
function treeGutterHtml({ depth = 0, isLast = true, ancestorContinues = [] }) {
  if (depth <= 0) return "";
  let html = `<span class="tree-wrap">`;
  for (let index = 0; index < depth; index++) {
    const isConnector = index === depth - 1;
    const continueLine = isConnector ? !isLast : ancestorContinues[index];
    html += `<span class="tree-col">`;
    if (continueLine) html += `<span class="tree-v tree-v-full"></span>`;
    if (isConnector) {
      html += `<span class="tree-v tree-v-half"></span><span class="tree-h"></span>`;
    }
    html += `</span>`;
  }
  html += `</span>`;
  return html;
}
function groupDetails(details, keyFn) {
  const groups = {};
  const order = [];
  details.forEach((entry) => {
    const key = keyFn(entry);
    if (key === undefined || key === null || key === "") return;
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(entry);
  });
  return { groups, order };
}
function expandProjectChildren(projectEntry, employeeId) {
  const mode = getProjectMode(projectEntry.pIndex);
  const details = projectEntry.detailEntries || [];
  if (!details.length || (!mode.showIow && !mode.showJrd)) return "";
  let html = "";
  if (mode.showIow) {
    const items = groupDetails(
      details,
      (entry) => entry.iIndex || entry.itemName
    );
    items.order.forEach((itemKey, itemIndex) => {
      const rows = items.groups[itemKey];
      const itemName = rows[0].itemName || `IOW ${itemKey}`;
      const lastIow = itemIndex === items.order.length - 1;
      html += namedHourRow(
        employeeId,
        projectEntry.pIndex,
        itemName,
        hoursByDay(rows),
        `iowRow${lastIow && !mode.showJrd ? " tree-last" : ""}`,
        { depth: 1, isLast: lastIow, ancestorContinues: [] }
      );
      if (mode.showJrd) {
        const jrds = groupDetails(
          rows,
          (entry) => entry.jrdName || entry.jrdId
        );
        jrds.order.forEach((jrdKey, jrdIndex) => {
          const lastJrd = jrdIndex === jrds.order.length - 1;
          html += namedHourRow(
            employeeId,
            projectEntry.pIndex,
            jrdKey,
            hoursByDay(jrds.groups[jrdKey]),
            `jrdRow${lastIow && lastJrd ? " tree-last" : ""}`,
            {
              depth: 2,
              isLast: lastJrd,
              ancestorContinues: [!lastIow],
            }
          );
        });
      }
    });
    return html;
  }
  const jrds = groupDetails(details, (entry) => entry.jrdName || entry.jrdId);
  jrds.order.forEach((jrdKey, jrdIndex) => {
    html += namedHourRow(
      employeeId,
      projectEntry.pIndex,
      jrdKey,
      hoursByDay(jrds.groups[jrdKey]),
      `jrdRow${jrdIndex === jrds.order.length - 1 ? " tree-last" : ""}`,
      {
        depth: 1,
        isLast: jrdIndex === jrds.order.length - 1,
        ancestorContinues: [],
      }
    );
  });
  return html;
}
function fetchHolidays() {
  let ymVal = $("#monthSel").val();
  let location = $("#locSel option:selected").attr("loc-id");

  // return $.post("php/get_holidays.php", {
  //   monthSel: ymVal,
  //   location: location,
  // }).then(function (data) {
  //   return JSON.parse(data); // Return parsed JSON array
  // });
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: "php/get_holidays.php",
      data: {
        monthSel: ymVal,
        location: location,
      },
      dataType: "json",
      success: function (response) {
        const hols = response;
        resolve(hols);
      },
      error: function (xhr, status, error) {
        if (xhr.status === 404) {
          reject("Not Found Error: The requested resource was not found.");
        } else if (xhr.status === 500) {
          reject("Internal Server Error: There was a server error.");
        } else {
          reject("An unspecified error occurred while fetching holidays.");
        }
      },
    });
  });
}
function getAMS() {
  const monthSel = $("#monthSel").val();
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: "ajax/get_ams.php",
      data: {
        yearMonth: monthSel,
        empArray: JSON.stringify(_selectedMembers),
      },
      dataType: "json",
      success: function (response) {
        const ams = response;
        resolve(ams);
      },
      error: function (xhr, status, error) {
        if (xhr.status === 404) {
          reject("Not Found Error: The requested resource was not found.");
        } else if (xhr.status === 500) {
          reject("Internal Server Error: There was a server error.");
        } else {
          reject("An unspecified error occurred while fetching ams data.");
        }
      },
    });
  });
}

function padZero(num) {
  return String(num).padStart(2, "0");
}
function totalThenDays(total, dayCells) {
  const shown = total || total === 0 ? total : "";
  return `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="col-total">${shown}</td>${dayCells}`;
}

function getRegularHoursData(projects, otProjects, includeOgp = false) {
  const totalHours = {};

  const monthTotalHours = { totalHours: 0 };
  const projectEntries = projects
    .map((rhEntry) => {
      const isOGPProject =
        rhEntry["pName"].substr(rhEntry["pName"].length - 5) === "[ogp]";
      if (includeOgp === false && isOGPProject) {
        return;
      }
      const dateEntries = rhEntry["dateEntries"].reduce((map, curr) => {
        const hours = Number(curr["hours"] || 0);
        const day = String(curr["entryDate"]).padStart(2, "0");
        if (map[day]) {
          map[day] += hours;
        } else {
          map[day] = hours;
        }

        if (totalHours[day] === undefined) {
          totalHours[day] = hours;
        } else {
          totalHours[day] += hours;
        }
        if (monthTotalHours[rhEntry["pName"]] === undefined) {
          monthTotalHours[rhEntry["pName"]] = hours;
        } else {
          monthTotalHours[rhEntry["pName"]] += hours;
        }
        monthTotalHours["totalHours"] += hours;
        return map;
      }, {});
      return {
        ...rhEntry,
        dateEntries: dateEntries,
        detailEntries: rhEntry["dateEntries"],
      };
    })
    .filter((x) => x !== undefined);

  return {
    monthTotalHours,
    totalHours,
    projectEntries: orderProjectList(projectEntries, (project) => project.pName),
  };
}
function getOTHoursData(OTprojects, includeOgp) {
  const totalHours = {};
  const monthTotalHours = { totalHours: 0 };

  const projectEntries = OTprojects.map((rhEntry) => {
    const isOGPProject =
      rhEntry["pName"].substr(rhEntry["pName"].length - 5) === "[ogp]";
    if (includeOgp === false && isOGPProject) {
      return;
    }
    const dateEntries = rhEntry["dateEntries"].reduce((map, curr) => {
      const hours = Number(curr["hours"] || 0);
      const day = String(curr["entryDate"]).padStart(2, "0");
      if (map[day]) {
        map[day] += hours;
      } else {
        map[day] = hours;
      }

      if (totalHours[day] === undefined) {
        totalHours[day] = hours;
      } else {
        totalHours[day] += hours;
      }
      if (monthTotalHours[rhEntry["pName"]] === undefined) {
        monthTotalHours[rhEntry["pName"]] = hours;
      } else {
        monthTotalHours[rhEntry["pName"]] += hours;
      }
      monthTotalHours["totalHours"] += hours;
      return map;
    }, {});
    return {
      ...rhEntry,
      dateEntries: dateEntries,
      detailEntries: rhEntry["dateEntries"],
    };
  }).filter((x) => x !== undefined);
  return {
    otMonthTotalHours: monthTotalHours,
    otTotalHours: totalHours,
    otProjectEntries: orderProjectList(projectEntries, (project) => project.pName),
  };
}
function generateRegularHours(
  totalHours,
  monthTotalHours,
  projectEntries,
  employeeId = 0,
  shouldIncludeOgp = false,
  ams = {},
  includeColor = {
    totalHours: false,
  },
  totalOtHours
) {
  let htmlString = "";
  let totalHourCells = "";
  projectEntries.forEach((projectEntry) => {
    const dateEntries = projectEntry["dateEntries"];
    const isOGPProject =
      projectEntry["pName"].substr(projectEntry["pName"].length - 5) ===
      "[ogp]";
    if (isOGPProject && !shouldIncludeOgp) {
      return;
    }
    const projectName = isOGPProject
      ? projectEntry["pName"].slice(0, -5)
      : projectEntry["pName"];
    let regularHourCells = "";
    for (let x = 1; x <= _maxDays; x++) {
      regularHourCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
        dateEntries[padZero(x)] ? dateEntries[padZero(x)] : ""
      }</td>`;
    }
    htmlString += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="pRow" employee-number="${employeeId}" p-index="${
      projectEntry["pIndex"]
    }">
                  <td data-a-v="middle"  data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
                  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left" class="name-cell"><span class="name-text">${projectName}</span></td>
                  ${totalThenDays(monthTotalHours[projectEntry["pName"]], regularHourCells)}
                  </tr>`;
    htmlString += expandProjectChildren(projectEntry, employeeId);
  });
  for (let x = 1; x <= _maxDays; x++) {
    totalHourCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      totalHours[padZero(x)] ? totalHours[padZero(x)] : ""
    }</td>`;
  }
  htmlString += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="tTot" employee-number="${employeeId}" >
  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">Total Hours</td>
  ${totalThenDays(monthTotalHours["totalHours"] ? monthTotalHours["totalHours"] : "0", totalHourCells)}
  </tr>`;
  // htmlString += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="tTot"employee-number="${employeeId}" >
  // <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"</td>
  // <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" style="">Total Hours</td>
  // ${totalHourCells}
  // <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">${
  //   monthTotalHours["totalHours"] ? monthTotalHours["totalHours"] : "0"
  // }</td>

  // </tr>
  // </tr>`;
  return { regularHourCells: htmlString, totalHours };
}
function generateOtHours(
  OtHours,
  monthTotalHours,
  totalOtHours,
  employeeId = 0,
  shouldIncludeOgp
) {
  let overTimeTotal = "";
  let totalOtCells = "";
  let addHtml = "";

  for (let x = 1; x <= _maxDays; x++) {
    totalOtCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      totalOtHours[padZero(x)] ? totalOtHours[padZero(x)] : ""
    }</td>`;
  }
  overTimeTotal += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="oTot" employee-number="${employeeId}" >
  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">Overtime</td>
  ${totalThenDays(monthTotalHours["totalHours"] ? monthTotalHours["totalHours"] : "0", totalOtCells)}
  </tr>`;
  //Setup data for ot cells with projectname
  let projectOtCellsWithProjectName = "";

  OtHours.forEach((otEntry) => {
    //Setup data
    const otDateEntries = otEntry["dateEntries"];
    //Render UI
    const isOGPProject =
      otEntry["pName"].substr(otEntry["pName"].length - 5) === "[ogp]";
    if (isOGPProject && !shouldIncludeOgp) {
      return;
    }
    const projectName = isOGPProject
      ? otEntry["pName"].slice(0, -5)
      : otEntry["pName"];
    let otHoursCells = "";
    for (let x = 1; x <= _maxDays; x++) {
      otHoursCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
        otDateEntries[padZero(x)] ? otDateEntries[padZero(x)] : ""
      }</td>`;
    }
    projectOtCellsWithProjectName += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="pRow otRow" employee-number="${employeeId}" p-index="${
      otEntry["pIndex"]
    }">
                  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
                  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">${
                    "OT-" + projectName
                  }</td>
                  ${totalThenDays(
                    monthTotalHours[otEntry["pName"]]
                      ? monthTotalHours[otEntry["pName"]]
                      : "0",
                    otHoursCells
                  )}
                  </tr>`;
  });
  return { projectOtCellsWithProjectName, overTimeTotal, totalOtHours };
}
function generateLeaves(leaves, employeeId = 0) {
  let vlCells = "";
  let slCells = "";
  let otherLeaveCells = "";
  let totalLeaveCells = "";
  const leavesMap = {};
  monthTotalHours = {};
  let addHtml = "";
  //Setup data
  // leaves.forEach((leaveEntry) => {
  //   console.log(leaveEntry)
  //   if (leaveEntry["iIndex"] == 25) {
  //     leaveEntry["dateEntries"].forEach((entry) => {
  //       if (leavesMap[`vl-${entry["entryDate"]}`] !== undefined) {
  //         leavesMap[`vl-${entry["entryDate"]}`] += entry["hours"];
  //       } else {
  //         leavesMap[`vl-${entry["entryDate"]}`] = entry["hours"];
  //       }
  //       if (monthTotalHours["totalVl"] === undefined) {
  //         monthTotalHours["totalVl"] = entry["hours"];
  //       } else {
  //         monthTotalHours["totalVl"] += entry["hours"];
  //       }
  //       if (leavesMap[`total-${entry["entryDate"]}`] === undefined) {
  //         leavesMap[`total-${entry["entryDate"]}`] = entry["hours"];
  //       } else {
  //         leavesMap[`total-${entry["entryDate"]}`] += entry["hours"];
  //       }
  //       if (monthTotalHours["totalLeave"] === undefined) {
  //         monthTotalHours["totalLeave"] = entry["hours"];
  //       } else {
  //         monthTotalHours["totalLeave"] += entry["hours"];
  //       }
  //     });
  //   } else if (leaveEntry["iIndex"] == 26) {
  //     leaveEntry["dateEntries"].forEach((entry) => {
  //       if (leavesMap[`sl-${entry["entryDate"]}`] !== undefined) {
  //         leavesMap[`sl-${entry["entryDate"]}`] += entry["hours"];
  //       } else {
  //         leavesMap[`sl-${entry["entryDate"]}`] = entry["hours"];
  //       }
  //       if (monthTotalHours["totalSl"] === undefined) {
  //         monthTotalHours["totalSl"] = entry["hours"];
  //       } else {
  //         monthTotalHours["totalSl"] += entry["hours"];
  //       }
  //       if (leavesMap[`total-${entry["entryDate"]}`] === undefined) {
  //         leavesMap[`total-${entry["entryDate"]}`] = entry["hours"];
  //       } else {
  //         leavesMap[`total-${entry["entryDate"]}`] += entry["hours"];
  //       }
  //       if (monthTotalHours["totalLeave"] === undefined) {
  //         monthTotalHours["totalLeave"] = entry["hours"];
  //       } else {
  //         monthTotalHours["totalLeave"] += entry["hours"];
  //       }
  //     });
  //   } else {
  //     leaveEntry["dateEntries"].forEach((entry) => {
  //       if (leavesMap[`other-${entry["entryDate"]}`] !== undefined) {
  //         leavesMap[`other-${entry["entryDate"]}`] += entry["hours"];
  //       } else {
  //         leavesMap[`other-${entry["entryDate"]}`] = entry["hours"];
  //       }
  //       if (monthTotalHours["totalOtherLeave"] === undefined) {
  //         monthTotalHours["totalOtherLeave"] = entry["hours"];
  //       } else {
  //         monthTotalHours["totalOtherLeave"] += entry["hours"];
  //       }

  //       if (leavesMap[`total-${entry["entryDate"]}`] === undefined) {
  //         leavesMap[`total-${entry["entryDate"]}`] = entry["hours"];
  //       } else {
  //         leavesMap[`total-${entry["entryDate"]}`] += entry["hours"];
  //       }
  //       if (monthTotalHours["totalLeave"] === undefined) {
  //         monthTotalHours["totalLeave"] = entry["hours"];
  //       } else {
  //         monthTotalHours["totalLeave"] += entry["hours"];
  //       }
  //     });
  //   }

  // });
leaves.forEach((leaveEntry) => {
  leaveEntry["dateEntries"].forEach((entry) => {
    const iIndex = entry["iIndex"];
    const entryDate = entry["entryDate"];
    const hours = entry["hours"];

    if (iIndex == 25) {
      leavesMap[`vl-${entryDate}`] = (leavesMap[`vl-${entryDate}`] || 0) + hours;
      monthTotalHours["totalVl"] = (monthTotalHours["totalVl"] || 0) + hours;
    } else if (iIndex == 26) {
      leavesMap[`sl-${entryDate}`] = (leavesMap[`sl-${entryDate}`] || 0) + hours;
      monthTotalHours["totalSl"] = (monthTotalHours["totalSl"] || 0) + hours;
    } else {
      leavesMap[`other-${entryDate}`] = (leavesMap[`other-${entryDate}`] || 0) + hours;
      monthTotalHours["totalOtherLeave"] = (monthTotalHours["totalOtherLeave"] || 0) + hours;
    }

    // Common total accumulation for any type
    leavesMap[`total-${entryDate}`] = (leavesMap[`total-${entryDate}`] || 0) + hours;
    monthTotalHours["totalLeave"] = (monthTotalHours["totalLeave"] || 0) + hours;
  });
  
});

  //Render UI
  for (let x = 1; x <= _maxDays; x++) {
    vlCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      leavesMap[`vl-${padZero(x)}`] ? leavesMap[`vl-${padZero(x)}`] : ""
    }</td>`;
    slCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      leavesMap[`sl-${padZero(x)}`] ? leavesMap[`sl-${padZero(x)}`] : ""
    }</td>`;
    otherLeaveCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      leavesMap[`other-${padZero(x)}`] ? leavesMap[`other-${padZero(x)}`] : ""
    }</td>`;
    totalLeaveCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}">${
      leavesMap[`total-${padZero(x)}`] ? leavesMap[`total-${padZero(x)}`] : ""
    }</td>`;
  }
  addHtml += `
  <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glRow" i-index="25">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">VL</td>
    ${totalThenDays(monthTotalHours["totalVl"] ? monthTotalHours["totalVl"] : "0", vlCells)}
  </tr>
  <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glRow" i-index="26">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">SL</td>
    ${totalThenDays(monthTotalHours["totalSl"] ? monthTotalHours["totalSl"] : "0", slCells)}
  </tr>
  <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glRow" p-index="others">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">EL,PL,ML,Others</td>
    ${totalThenDays(
      monthTotalHours["totalOtherLeave"] ? monthTotalHours["totalOtherLeave"] : "0",
      otherLeaveCells
    )}
  </tr>
  <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glTot">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">Leave</td>
    ${totalThenDays(monthTotalHours["totalLeave"] ? monthTotalHours["totalLeave"] : "0", totalLeaveCells)}
  </tr>
  `;
  return { leavesUI: addHtml, leavesData: leavesMap };
}
const AM_BREAK_START = "09:00";

function isHolidayDay(dayNum) {
  return (global_holidays || []).some((dateStr) => {
    return parseInt(String(dateStr).split("-")[2], 10) === Number(dayNum);
  });
}

function markAmsCell({
  leaveHours,
  amsToken,
  amsHours,
  jmrValue,
  inTime,
  isWeekend,
  isHoliday,
  isFuture,
}) {
  if (leaveHours && leaveHours > 0 && !isWeekend) {
    if (leaveHours < 8) {
      return {
        cellClass: "ams-halfday",
        excelColor: "FFB86A",
        title: "Halfday",
        display: "-",
      };
    }
    return {
      cellClass: "ams-wholeday",
      excelColor: "FF8904",
      title: "Whole day leave",
      display: "-",
    };
  }

  if (isFuture) {
    return { cellClass: "", excelColor: "", title: "", display: amsToken === "-" ? "" : amsHours };
  }

  if ((amsToken === "0" || amsToken === "-") && Number(jmrValue) !== 0) {
    return {
      cellClass: "ams-invalid",
      excelColor: "FF0000",
      title: "Invalid due to no AMSLogs",
      display: amsToken === "-" ? "-" : amsHours,
    };
  }
  if (amsToken === "-" && Number(jmrValue) === 0 && !isHoliday && !isWeekend) {
    return {
      cellClass: "ams-invalid",
      excelColor: "FF0000",
      title: "Invalid due to no filed leave",
      display: "-",
    };
  }
  if (inTime && String(inTime) > String(AM_BREAK_START) && !isWeekend && !isHoliday) {
    return {
      cellClass: "ams-invalid",
      excelColor: "FF0000",
      title: "Invalid due to past AMBreak (9:00)",
      display: amsHours,
    };
  }
  if (amsToken !== "-" && Number(amsHours) < Number(jmrValue)) {
    return {
      cellClass: "ams-invalid",
      excelColor: "FF0000",
      title: "Invalid due to AMS and JMR doesn't match up",
      display: amsHours,
    };
  }

  return {
    cellClass: "",
    excelColor: "",
    title: "",
    display: amsToken === "-" ? "" : amsHours,
  };
}

function amsLocationMark(locationName) {
  const loc = String(locationName || "").trim().toUpperCase();
  if (loc === "WFH" || loc === "HWFH") {
    return { cellClass: "ams-wfh", excelColor: "FFC0CB", title: loc };
  }
  if (loc === "DISPATCH") {
    return { cellClass: "ams-dispatch", excelColor: "C4A484", title: "Dispatch" };
  }
  return null;
}

function generateAMS(
  amsLogs,
  employeeId = 0,
  regularHourEntries,
  leavesData,
  otEntries
) {
  let amsLogsSection = "";
  let amsLogsCells = "";
  let totalAmsMonth = 0;

  const ymVal = $("#monthSel").val() || "";
  const [year, month] = ymVal.split("-");
  const sundays = year && month ? getSundays(year, month) : [];
  const saturdays = year && month ? getSaturdays(year, month) : [];

  for (let x = 1; x <= _maxDays; x++) {
    const dayKey = padZero(x);
    const amsEntry = amsLogs[dayKey] || amsLogs[x] || amsLogs[String(x)];
    const jmrValue = Number(
      regularHourEntries[dayKey] || regularHourEntries[x] || 0
    );
    const leaveHours = Number(
      leavesData[`total-${dayKey}`] || leavesData[`total-${x}`] || 0
    );
    const hasAms = amsEntry && amsEntry["hours"] !== undefined;
    const amsHours = hasAms ? Number(amsEntry["hours"]) : 0;
    const amsToken = !hasAms ? "-" : String(amsHours);
    const inTime = hasAms ? String(amsEntry["in"] || "").trim() : "";
    const isWeekend = sundays.includes(x) || saturdays.includes(x);
    const isHoliday = isHolidayDay(x);
    const cellDate = new Date(Number(year), Number(month) - 1, x);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    cellDate.setHours(0, 0, 0, 0);
    const isFuture = cellDate > todayStart;

    if (hasAms) {
      totalAmsMonth += amsHours;
    }

    const locationName = hasAms ? String(amsEntry["locationName"] || "") : "";
    const marked = markAmsCell({
      leaveHours,
      amsToken,
      amsHours,
      jmrValue,
      inTime,
      isWeekend,
      isHoliday,
      isFuture,
    });
    const locationMark = marked.cellClass ? null : amsLocationMark(locationName);
    const cellClass = locationMark ? locationMark.cellClass : marked.cellClass;
    const excelColor = locationMark ? locationMark.excelColor : marked.excelColor;
    const title = locationMark ? locationMark.title : marked.title;

    amsLogsCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9"
      data-b-a-s="thin" data-a-h="center" data-fill-color="${excelColor}"
      class="${cellClass}" dayVal="${x}" title="${title}">${
      marked.display === 0 ? 0 : marked.display || ""
    }</td>`;
  }

  amsLogsSection += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="amsRow" employee-number="${employeeId}">
    <td></td>  
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left">AMS</td>
    ${totalThenDays(totalAmsMonth, amsLogsCells)}
  </tr>`;

  return amsLogsSection;
}

function generateMainTable(allEmployees, includeOgp = false) {
  $("#mainTbody").empty();
  Object.values(allEmployees).forEach((user) => {
    createMemberHours(user);
  });
}
function generateSubTable(allUsers) {
  let addHtml = "";
  const includeOgp = $(`.checkbox`).is(":checked");

  let Leaves = [];
  const OTEntries = {};
  const RegularHourEntries = {};
  Object.values(allUsers).forEach((user) => {
    //Regular hour merge
    for (let key in user["RegularHourEntries"]) {
      const source = user["RegularHourEntries"][key];
      if (RegularHourEntries[key] === undefined) {
        RegularHourEntries[key] = {
          ...source,
          dateEntries: [...source["dateEntries"]],
        };
      } else {
        RegularHourEntries[key]["dateEntries"] = [
          ...RegularHourEntries[key]["dateEntries"],
          ...source["dateEntries"],
        ];
      }
    }

    //OT Hour Merge
    for (let key in user["OTEntries"]) {
      const source = user["OTEntries"][key];
      if (OTEntries[key] === undefined) {
        OTEntries[key] = {
          ...source,
          dateEntries: [...source["dateEntries"]],
        };
      } else {
        OTEntries[key]["dateEntries"] = [
          ...OTEntries[key]["dateEntries"],
          ...source["dateEntries"],
        ];
      }
    }
    //Leaves merge
    Leaves.push(...Object.values(user["Leaves"]));
  });

  const { otMonthTotalHours, otProjectEntries, otTotalHours } = getOTHoursData(
    Object.values(OTEntries)
  );
  const { monthTotalHours, totalHours, projectEntries } = getRegularHoursData(
    Object.values(RegularHourEntries),
    otTotalHours,
    includeOgp
  );
  const { regularHourCells } = generateRegularHours(
    totalHours,
    monthTotalHours,
    projectEntries,
    0,
    includeOgp,
    otTotalHours
  );
  const { projectOtCellsWithProjectName, overTimeTotal, totalOtHours } =
    generateOtHours(
      otProjectEntries,
      otMonthTotalHours,
      otTotalHours,
      0,
      includeOgp
    );
  addHtml += regularHourCells;
  addHtml += overTimeTotal;
  addHtml += projectOtCellsWithProjectName;

  const { leavesUI } = generateLeaves(Leaves, 0);
  addHtml += leavesUI;

  $("#subTbody").append(addHtml);
}

function createMemberHours(user) {
  const includeOgp = $(`.checkbox`).is(":checked");
  let addHtml = "";


  //Get Required Data

  const { otMonthTotalHours, otTotalHours, otProjectEntries } = getOTHoursData(
    Object.values(user["OTEntries"]),
    includeOgp
  );

  const { monthTotalHours, totalHours, projectEntries } = getRegularHoursData(
    Object.values(user["RegularHourEntries"]),
    otTotalHours,
    includeOgp
  );
  const { regularHourCells } = generateRegularHours(
    totalHours,
    monthTotalHours,
    projectEntries,
    user["empId"],
    includeOgp,
    amsData[user["empId"]],
    { totalHours: true },
    otTotalHours
  );

  //End Regular Hour Section
  //#region OT Section
  const { projectOtCellsWithProjectName, overTimeTotal, totalOtHours } =
    generateOtHours(
      otProjectEntries,
      otMonthTotalHours,
      otTotalHours,
      user["empId"],
      includeOgp
    );
  //#endregion Ot Section
  const { leavesData, leavesUI } = generateLeaves(
    Object.values(user["Leaves"]),
    user["empId"]
  );
  const amsLogs = generateAMS(
    amsData[user["empId"]] ? amsData[user["empId"]] : {},
    user["empId"],
    totalHours,
    leavesData
  );
  //Start Leave Section

  let memberDayCells = "";
  for (let x = 1; x <= _maxDays; x++) {
    memberDayCells += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}"></td>`;
  }
  const memberRow = `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="emprow" employee-number="${
    user["empId"]
  }">
  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left" class="member-cell">${employeeDisplayName(
    user
  )}</td>
  <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="left"></td>
  ${totalThenDays(monthTotalHours["totalHours"] || "", memberDayCells)}
  </tr>`;

  $("#mainTbody")
    .append(`
  ${memberRow}
  ${regularHourCells}
  ${amsLogs}
  ${overTimeTotal}
  ${projectOtCellsWithProjectName}
  ${leavesUI}
  `);
}

function createHeader() {
  var addDates = "";
  for (let x = 1; x <= _maxDays; x++) {
    addDates += `<th data-fill-color="00ffff" data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">${x
      .toString()
      .padStart(2, "0")}</th>`;
  }
  const leadCols = `<th class="lagyan tot-head" data-fill-color="00ffff" data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Total Hours</th>`;
  $("#mainThead").html(`
    <th class="lagyan" data-fill-color="00ffff"  data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Members</th>
    <th class="lagyan2" data-fill-color="00ffff"  data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Project</th>
    ${leadCols}
    ${addDates}
    `);
  $("#subThead").html(`
    <th data-f-bold="true" data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" id="grpTotTitle">GROUP's TOTAL</th>
    <th data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="grpPrjTitle">Project</th>
    <th data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Total Hours</th>
    ${addDates}
    `);
}

function adjustWidth() {
  var memh = $("#mainTable th:first-child").outerWidth();
  var projh = $("#mainTable th:nth-child(2)").outerWidth();
  $("#subTable th:first-child").css("min-width", memh);
  $("#subTable th:nth-child(2)").css("min-width", projh);
}

function pinLeadColumns() {
  document.querySelectorAll(".lead-freeze").forEach((node) => node.remove());
  ["#mainTable", "#subTable"].forEach((sel) => {
    const table = document.querySelector(sel);
    if (!table || !table.rows.length) return;
    const host = table.parentElement;
    if (!host) return;
    const freeze = table.cloneNode(true);
    freeze.removeAttribute("id");
    freeze.classList.add("lead-freeze");
    freeze.setAttribute("aria-hidden", "true");
    freeze.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    [...freeze.rows].forEach((tr) => {
      [...tr.cells].forEach((cell, index) => {
        if (index >= 3) cell.remove();
      });
    });
    host.insertBefore(freeze, table);
    const srcRows = table.rows;
    const dstRows = freeze.rows;
    for (let i = 0; i < srcRows.length && i < dstRows.length; i++) {
      dstRows[i].style.height = `${srcRows[i].getBoundingClientRect().height}px`;
    }
    const firstRow = srcRows[0];
    if (firstRow && firstRow.cells.length >= 3) {
      const width =
        firstRow.cells[0].getBoundingClientRect().width +
        firstRow.cells[1].getBoundingClientRect().width +
        firstRow.cells[2].getBoundingClientRect().width;
      freeze.style.width = `${Math.round(width)}px`;
    }
  });
}

function extractData(entry) {
  if (!Leaves.includes(entry["pIndex"])) {
    if (entry["OT"]) {
      _grpOT.push({
        pIndex: entry["pIndex"],
        pName: entry["pName"],
      });
      _grpOT = [...new Map(_grpOT.map((x) => [x["pIndex"], x])).values()];
    }
    _grpProj.push({
      pIndex: entry["pIndex"],
      pName: entry["pName"],
    });
    _grpProj = [...new Map(_grpProj.map((x) => [x["pIndex"], x])).values()];
  }
}

function getEmpProjects(empDetails) {
  var uniqueProjects = pGet(empDetails, false);
  var uniqueOT = pGet(empDetails, true);
  var addHtml = "";

  //Regular Projects
  uniqueProjects.forEach((element) => {
    addHtml += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="pRow" employee-number="${empDetails}" p-index="${element["pIndex"]}">
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">${element["pName"]}</td>
      </tr>`;
  });

  //Total Hours
  addHtml += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="tTot"employee-number="${empDetails}" >
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Total Hours</td>
    </tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="oTot"employee-number="${empDetails}" >
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Overtime</td>
    </tr>`;

  //OT Projects
  uniqueOT.forEach((element) => {
    addHtml += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="oRow" employee-number="${empDetails}" p-index="${element["pIndex"]}">
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td>
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">OT - ${element["pName"]}</td>
      </tr>`;
  });

  //Leaves
  addHtml += `
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="lRow" i-index="25" employee-number="${empDetails}"><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">VL</td></tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="lRow" i-index="26" employee-number="${empDetails}"><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">SL</td></tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="lRow" p-index="others" employee-number="${empDetails}"><td data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">EL,PL,ML,Others</td></tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="lTot" employee-number="${empDetails}"><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Leave</td></tr>
    `;

  var empName = _emplist.find((employee) => employee.empNum == empDetails)[
    "empName"
  ];
  $("#mainTbody")
    .append(`<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="emprow" employee-number="${empDetails}">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">${empName}</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Project and Job Name</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" colspan="${
      _maxDays + 1
    }"></td>
    </tr>
    ${addHtml}`);
}

function pGet(empNum, ifOT) {
  var returnObject = [];
  if (ifOT) {
    //is OT
    _unifiedQ.forEach((element) => {
      if (element["empNum"] == empNum && !Leaves.includes(element["pIndex"])) {
        if (element["OT"]) {
          returnObject.push(element);
        }
      }
    });
  } else {
    //regular hours
    _unifiedQ.forEach((element) => {
      if (element["empNum"] == empNum && !Leaves.includes(element["pIndex"])) {
        // if (!element["OT"]) {
        returnObject.push(element);
        // }
      }
    });
  }
  returnObject = [
    ...new Map(returnObject.map((x) => [x["pIndex"], x])).values(),
  ];
  return returnObject;
}

function addGrpData(regular, ot) {
  var addHtml = "";
  regular.forEach((element) => {
    addHtml += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="gpRow" p-index="${element["pIndex"]}">
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">${element["pName"]}</td>
      </tr>`;
  });

  addHtml += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="gtTot">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Total Hours</td>
    </tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="goTot">
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
    <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Overtime</td>
    </tr>`;

  ot.forEach((element) => {
    addHtml += `<tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="goRow" p-index="${element["pIndex"]}">
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td>
      <td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">OT - ${element["pName"]}</td>
      </tr>`;
  });

  addHtml += `
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glRow" i-index="25"><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">VL</td></tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glRow" i-index="26"><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">SL</td></tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glRow" p-index="others"><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">EL,PL,ML,Others</td></tr>
    <tr data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="glTot" ><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">&nbsp;</td><td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center">Leave</td></tr>
    `;

  $("#subTbody").append(addHtml);
}

function addCells() {
  var addHtml = "";
  for (let x = 1; x <= _maxDays; x++) {
    addHtml += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" dayVal="${x}"></td>`;
  }
  addHtml += `<td data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center" class="tCell"></td>`;
  $(
    ".pRow,.oRow,.tRow,.lRow,.lTot,.tTot,.lTot,.oTot,.gpRow,.goRow,.goTot,.gtTot,.glRow,.glTot"
  ).append(addHtml);
}
//#endregion

//#region latag

function fillTable(entry) {
  //ETOBAGUHIN MO NEXT WEEK
  var currentHours = 0;
  if (!Leaves.includes(entry["pIndex"])) {
    currentHours =
      parseFloat(
        $(
          $(
            `.pRow[p-index="${entry["pIndex"]}"][employee-number="${entry["empNum"]}"]`
          ).children()[entry["entryDate"] + 1]
        ).text()
      ) || 0;
    currentHours += parseFloat(entry["hours"]);
    $(
      $(
        `.pRow[p-index="${entry["pIndex"]}"][employee-number="${entry["empNum"]}"]`
      ).children()[entry["entryDate"] + 1]
    ).text(`${currentHours}`);
    if (entry["OT"]) {
      $(
        $(
          `.oRow[p-index="${entry["pIndex"]}"][employee-number="${entry["empNum"]}"]`
        ).children()[entry["entryDate"] + 1]
      ).text(entry["hours"]);
    }
  } else {
    if (oLeaves.hasOwnProperty(entry["iIndex"])) {
      //EL PL
      $(
        $(
          `.lRow[p-index="others"][employee-number="${entry["empNum"]}"]`
        ).children()[entry["entryDate"] + 1]
      ).text(1233);
    }
    // iIndex === 25 = VL
    // iIndex === 26 = SL
    $(
      $(
        `.lRow[i-index="${entry["iIndex"]}"][employee-number="${entry["empNum"]}"]`
      ).children()[entry["entryDate"] + 1]
    ).text(entry["hours"]);
  }
}

//totals
function getTotals() {
  //  OT > Reg + OT > Leave

  // OT
  $(".oTot").each(function () {
    var getEmpOts = $(
      `.oRow[employee-number="${$(this).attr("employee-number")}"]`
    );
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var totalOT = 0;
      $(getEmpOts).each(function () {
        totalOT += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(totalOT == 0 ? "" : totalOT);
      // $($(this).children()[x]).attr('data-fill-color','FFFF00');
    }
  });

  // Reg + OT
  $(".tTot").each(function () {
    var getEmpTots = $(
      `.pRow[employee-number="${$(this).attr("employee-number")}"]`
    );
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var totaltime = 0;
      $(getEmpTots).each(function () {
        totaltime += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      // totaltime += parseFloat( //ETO BAGUHIN MO NEXT WEEK
      //   $(
      //     $(
      //       `.oTot[employee-number="${$(this).attr("employee-number")}"]`
      //     ).children()[x]
      //   ).text() == ""
      //     ? 0
      //     : $(
      //         $(
      //           `.oTot[employee-number="${$(this).attr("employee-number")}"]`
      //         ).children()[x]
      //       ).text()
      // );
      $($(this).children()[x]).text(totaltime == 0 ? "" : totaltime);
      // $($(this).children()[x]).attr('data-fill-color','FFFF00');
    }
  });

  // Leaves
  $(".lTot").each(function () {
    var getEmpLeaves = $(
      `.lRow[employee-number="${$(this).attr("employee-number")}"]`
    );
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var totalLeaves = 0;
      $(getEmpLeaves).each(function () {
        totalLeaves += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(totalLeaves == 0 ? "" : totalLeaves);
      // $($(this).children()[x]).attr('data-fill-color','FFFF00');
    }
  });

  //fill sub table
  $(".gpRow").each(function () {
    var getpRows = $(`.pRow[p-index="${$(this).attr("p-index")}"]`);

    for (let x = 2; x < $(this).children().length - 1; x++) {
      var gpTotal = 0;
      $(getpRows).each(function () {
        gpTotal += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(gpTotal == 0 ? "" : gpTotal);
    }
  });

  $(".goRow").each(function () {
    var getoRows = $(`.oRow[p-index="${$(this).attr("p-index")}"]`);

    for (let x = 2; x < $(this).children().length - 1; x++) {
      var goTotal = 0;
      $(getoRows).each(function () {
        goTotal += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(goTotal == 0 ? "" : goTotal);
    }
  });

  $(".glRow").each(function () {
    var getlRows = ``;
    if ($(this).attr("i-index")) {
      getlRows = $(`.lRow[i-index="${$(this).attr("i-index")}"]`);
    } else {
      getlRows = $(`.lRow[p-index="${$(this).attr("p-index")}"]`);
    }
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var glTotal = 0;
      $(getlRows).each(function () {
        glTotal += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(glTotal == 0 ? "" : glTotal);
    }
  });

  // gOT
  $(".goTot").each(function () {
    var getGrpOts = $(`.goRow`);
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var totalOT = 0;
      $(getGrpOts).each(function () {
        totalOT += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(totalOT == 0 ? "" : totalOT);
    }
  });

  // gReg + OT
  $(".gtTot").each(function () {
    var getGrpTots = $(`.gpRow`);
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var totaltime = 0;
      $(getGrpTots).each(function () {
        totaltime += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      // totaltime += parseFloat( //ETO BAGUHIN MO NEXT WEEK
      //   $($(`.goTot`).children()[x]).text() == ""
      //     ? 0
      //     : $($(`.goTot`).children()[x]).text()
      // );
      $($(this).children()[x]).text(totaltime == 0 ? "" : totaltime);
    }
  });

  // gLeaves
  $(".glTot").each(function () {
    var getGrpLeaves = $(`.glRow`);
    for (let x = 2; x < $(this).children().length - 1; x++) {
      var totalLeaves = 0;
      $(getGrpLeaves).each(function () {
        totalLeaves += parseFloat(
          $($(this).children()[x]).text() == ""
            ? 0
            : $($(this).children()[x]).text()
        );
      });
      $($(this).children()[x]).text(totalLeaves == 0 ? "" : totalLeaves);
    }
  });

  // right Totals
  $(".tCell").each(function () {
    var getLeft = $(this).prevAll();
    var rightTot = 0;
    for (let x = 0; x < _maxDays; x++) {
      rightTot += parseFloat(
        $(getLeft[x]).text() == "" ? 0 : $(getLeft[x]).text()
      );
    }
    $(this).text(rightTot);
  });
}

function getTotalHourColor(totalHour, amsHour, otHour) {
  if (totalHour > 8 && otHour !== undefined) {
    return "#ff0000";
  }
  if (totalHour !== amsHour) {
    if (totalHour > amsHour || !amsHour) {
      return "#ff0000";
    }
    if (totalHour < amsHour) {
      return "#00ffff";
    }
  }
  return "rgb(255, 255, 0)";
}
function colorYellow() {
  // var myClass = [
  //   `oTot`,
  //   `lRow`,
  //   `lTot`,
  //   `gtTot`,
  //   `goTot`,
  //   `glRow`,
  //   `glTot`,
  //   "amsRowLabel",
  // ];
  // var myClass = [`tTot`];
    var myClass = [
    `tTot`,
    `gtTot`,
    `oTot`,
    `lRow`,
    `lTot`,
    `goTot`,
    `glRow`,
    `glTot`,
  ];
  myClass.forEach((element) => {
    $(`.${element}`).each(function () {
      for (let x = 1; x < $(this).children().length; x++) {
        $($(this).children()[x])
          .attr("data-fill-color", "E9F844")
          .css("background-color", "#E9F844");
      }
    });
  });
}
function colorHolidays(filteredHolidayArray) {
  // Extract the day numbers from the holiday dates
  const holidayDays = filteredHolidayArray.map((dateStr) =>
    parseInt(dateStr.split("-")[2], 10)
  );

  const mySelectors = [
    `#mainThead`,
    `#subThead`,
    `.pRow`,
    `.gpRow`,
    `.oRow`,
    `.goRow`,
    `.tTot`,
    `.oTot`,
    `.lRow`,
    `.lTot`,
    `.gtTot`,
    `.goTot`,
    `.glRow`,
    `.glTot`,
    `.iowRow`,
    `.jrdRow`,
    `.otRow`,
    `.amsRow`,
  ];

  mySelectors.forEach((selector) => {
    $(selector).each(function () {
      for (let x = 3; x < $(this).children().length; x++) {
        const dayNum = parseInt($($("#mainThead").children()[x]).text(), 10);
        if (holidayDays.includes(dayNum)) {
          $($(this).children()[x])
            .addClass("holiday-cell")
            .attr("data-fill-color", "00FF00");
        }
      }
    });
  });
}

function colorWeekends(year, month) {
  _sundays = getSundays(year, month);
  _saturdays = getSaturdays(year, month);
  for (let x = 3; x < $(`#mainThead`).children().length; x++) {
    const $cell = $($(`#mainThead`).children()[x]);
    if (_sundays.includes(x - 2)) {
      $cell.attr("data-fill-color", "00FF00").addClass("wknd-sun");
    } else if (_saturdays.includes(x - 2)) {
      $cell.attr("data-fill-color", "CCFF99").addClass("wknd-sat");
    }
  }
  var mySelectors = [
    `#mainThead`,
    `#subThead`,
    `.pRow`,
    `.gpRow`,
    `.oRow`,
    `.goRow`,
    `.tTot`,
    `.oTot`,
    `.lRow`,
    `.lTot`,
    `.gtTot`,
    `.goTot`,
    `.glRow`,
    `.glTot`,
    `.iowRow`,
    `.jrdRow`,
    `.otRow`,
    `.amsRow`,
  ];
  mySelectors.forEach((element) => {
    $(`${element}`).each(function () {
      for (let x = 3; x < $(this).children().length; x++) {
        const $cell = $($(this).children()[x]);
        if (_sundays.includes(x - 2)) {
          $cell.attr("data-fill-color", "00FF00").addClass("wknd-sun");
        } else if (_saturdays.includes(x - 2)) {
          $cell.attr("data-fill-color", "CCFF99").addClass("wknd-sat");
        }
      }
    });
  });
}
function getSundays(year, month) {
  var firstDayOfMonth = new Date(year, month - 1, 1);
  var lastDayOfMonth = new Date(year, month, 0);
  var sundays = [];

  for (
    let day = firstDayOfMonth.getDate();
    day <= lastDayOfMonth.getDate();
    day++
  ) {
    var currentDate = new Date(year, month - 1, day);
    var dayOfWeek = currentDate.getDay(); // Sunday (0) to Saturday (6)

    if (dayOfWeek === 0) {
      sundays.push(day);
    }
  }
  return sundays;
}
function getSaturdays(year, month) {
  var firstDayOfMonth = new Date(year, month - 1, 1);
  var lastDayOfMonth = new Date(year, month, 0);
  var saturdays = [];

  for (
    let day = firstDayOfMonth.getDate();
    day <= lastDayOfMonth.getDate();
    day++
  ) {
    var currentDate = new Date(year, month - 1, day);
    var dayOfWeek = currentDate.getDay(); // Sunday (0) to Saturday (6)

    if (dayOfWeek === 6) {
      saturdays.push(day);
    }
  }

  return saturdays;
}
//#endregion

//#region basa ng members

function fillMembers(memDetails) {
  var selectType = `secondary`;
  if (_selectedMembers.includes(memDetails.empNum)) {
    selectType = `primary`;
  }
  $("#members-list").append(`
  <div class=" mt-3">
      <button emp-num="${memDetails.empNum}" class="btn btn-${selectType} w-100 memBtn">${String(memDetails.empName || "").replace(/\s+,/g, ",").trim()}</button>
  </div>`);
}

//#endregion

//#region Export
function printTable() {
  window.print();
}

function cssColorToExcel(color) {
  const hexMatch = String(color || "").trim().match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) return hexMatch[1].toUpperCase();
  const rgb = String(color || "").match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (!rgb) return "FFFFFF";
  if (rgb[4] !== undefined && Number(rgb[4]) === 0) return "FFFFFF";
  return [rgb[1], rgb[2], rgb[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function syncExcelFromScreen() {
  ["#mainTable", "#subTable"].forEach((selector) => {
    document.querySelectorAll(`${selector} th, ${selector} td`).forEach((cell) => {
      const style = window.getComputedStyle(cell);
      cell.setAttribute("data-fill-color", cssColorToExcel(style.backgroundColor));
      if (style.textAlign === "left" || style.textAlign === "center" || style.textAlign === "right") {
        cell.setAttribute("data-a-h", style.textAlign);
      }
      const weight = Number(style.fontWeight);
      if (weight >= 600 || style.fontWeight === "bold") {
        cell.setAttribute("data-f-bold", "true");
      }
    });
  });
  const dayWidths = Array.from({ length: _maxDays || 0 }, () => "4").join(",");
  $("#mainTable,#subTable").attr(
    "data-cols-width",
    ["22", "40", "12", dayWidths].filter(Boolean).join(",")
  );
}

function exportTable() {
  syncExcelFromScreen();
  var locVal = $($(`#locSel`).find("option:selected")).text();
  var colsP = _maxDays + 3;
  $("#mainTable").append(
    `<tr id='fromHereAdd' class='w3-gray'><td colspan="${colsP}" data-fill-color="808080" data-a-v="middle" data-f-name="Arial" data-f-sz="9" data-b-a-s="thin" data-a-h="center"></td></tr>`,
    $("#subTable").html()
  );
  $(`#grpTotTitle`).text(`GROUP's TOTAL`);

  var cOff;
  // $("#mainTable").removeClass("ayos");
  switch ($("#CO").val()) {
    case "1":
      cOff = "First Half";
      break;
    case "3":
      cOff = "Monthly";
      break;
  }
  TableToExcel.convert(document.getElementById("mainTable"), {
    name: `MonthlyStandard_${$("#buSel").val()}_${$(
      "#monthSel"
    ).val()}_${locVal}.xlsx`,
    sheet: {
      name: `${$("#buSel").val()}_${$("#monthSel").val()}`,
    },
  });
  $($("#fromHereAdd").nextAll()).remove();
  $("#fromHereAdd").remove();
  $(`#grpTotTitle`).text(``);
  // $(".fx").remove();
  // $("#mainTable").addClass("ayos");
}

function addWidthtoGroupTable() {
  var first = $(".lagyan").outerWidth();
  var second = $(".lagyan2").outerWidth();
  $("#grpTotTitle").css("min-width", first + "px");
  $(".grpPrjTitle").css("min-width", second + "px");
}
//#endregion
//#endregion
