/**
 * Standalone mock for WEB JMR Monthly Standard PHP endpoints.
 * Intercepts jQuery ajax so the original HTML/JS can run without a database.
 */
(function ($) {
  const originalAjax = $.ajax;

  const LOGIN = {
    empNum: "1",
    empGroup: "ENV",
    empFName: "Juan Miguel",
    empSName: "Dela Cruz",
    empNName: "Juan",
    empDateHired: "2018-04-01",
    empPos: "SE",
  };

  const GROUPS = ["ENV", "SYS", "IT"];

  const LOCATIONS = {
    1: "KDT",
    2: "WFH",
    8: "HWFH",
    3: "Kobe",
  };

  const EMPLOYEES = {
    ENV: [
      { empNum: "1", empName: "Dela Cruz, Juan Miguel B." },
      { empNum: "2", empName: "Delos Santos, Jose Luis T." },
      { empNum: "3", empName: "Reyes, Marlon B." },
      { empNum: "4", empName: "Santiago, Ian E." },
      { empNum: "5", empName: "Uy, Jeraldine C." },
    ],
    SYS: [{ empNum: "6", empName: "Santos, Ana L." }],
    IT: [{ empNum: "7", empName: "Garcia, Paolo R." }],
  };

  function pad(num) {
    return String(num).padStart(2, "0");
  }

  function pathOf(url) {
    return String(url || "")
      .split("?")[0]
      .replace(/\\/g, "/");
  }

  function isEndpoint(url, suffix) {
    return pathOf(url).endsWith(suffix);
  }

  function parsePosted(data) {
    if (!data) return {};
    if (typeof data === "string") {
      const out = {};
      data.split("&").forEach(function (pair) {
        const parts = pair.split("=");
        out[decodeURIComponent(parts[0])] = decodeURIComponent(
          (parts[1] || "").replace(/\+/g, " ")
        );
      });
      return out;
    }
    return data;
  }

  function parseEmpArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String);
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function workdays(year, month, lastDay) {
    const days = [];
    for (let day = 1; day <= lastDay; day++) {
      const weekday = new Date(year, month - 1, day).getDay();
      if (weekday !== 0 && weekday !== 6) days.push(day);
    }
    return days;
  }

  function holidayDate(yearMonth) {
    const month = Number(String(yearMonth).split("-")[1]);
    const year = String(yearMonth).split("-")[0];
    if (month === 1) return year + "-01-01";
    if (month === 4) return year + "-04-09";
    if (month === 12) return year + "-12-25";
    return year + "-" + pad(month) + "-11";
  }

  function dateEntry(day, hours, location, iIndex) {
    return {
      entryDate: pad(day),
      hours: hours,
      location: location,
      iIndex: iIndex,
    };
  }

  function emptyEmployee(empNum, firstName, lastName) {
    return {
      firstName: firstName,
      lastName: lastName,
      empId: empNum,
      RegularHourEntries: {},
      OTEntries: {},
      Leaves: {},
    };
  }

  function buildEntries(yearMonth, empIds, includeOgp, cutoff, location) {
    const parts = String(yearMonth || "2026-09").split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const lastOfMonth = new Date(year, month, 0).getDate();
    const lastDay = String(cutoff) === "1" ? Math.min(15, lastOfMonth) : lastOfMonth;
    const days = workdays(year, month, lastDay);
    const holidayDay = Number(holidayDate(yearMonth).split("-")[2]);
    const vlDay = days.find(function (day) {
      return day !== holidayDay && day >= 8 && day <= 14;
    }) || days[Math.max(0, days.length - 2)];
    const otDay = days.find(function (day) {
      return day !== vlDay && day !== holidayDay;
    }) || days[0];
    const wfhDays = days.filter(function (day) {
      return day !== vlDay && day !== holidayDay;
    }).slice(0, 2);

    function inLocation(entryLoc) {
      if (location === "0") return entryLoc === "KDT" || entryLoc === "WFH";
      if (location === "-1") return entryLoc === "KDT" || entryLoc === "HWFH";
      if (location === "1") return entryLoc === "KDT";
      if (location === "2") return entryLoc === "WFH";
      if (location === "8") return entryLoc === "HWFH";
      if (location === "3") return entryLoc === "Kobe";
      return true;
    }

    function locForDay(day) {
      return wfhDays.indexOf(day) !== -1 ? "WFH" : "KDT";
    }

    const catalog = {
      "1": (function () {
        const emp = emptyEmployee("1", "Juan Miguel B.", "Dela Cruz");
        emp.RegularHourEntries["184"] = {
          pName: "KSSI 0184: ITime(IT)",
          dateEntries: days
            .filter(function (day) {
              return day !== vlDay && day !== holidayDay;
            })
            .map(function (day) {
              return dateEntry(day, 4, locForDay(day), 101);
            }),
        };
        emp.RegularHourEntries["10"] = {
          pName: "KHI Small Start General Activities(IT)",
          dateEntries: days
            .filter(function (day) {
              return day !== vlDay && day !== holidayDay;
            })
            .map(function (day) {
              return dateEntry(day, 4, locForDay(day), 102);
            }),
        };
        emp.RegularHourEntries["900"] = {
          pName: "TaguruKit (SYS)[ogp]",
          dateEntries: [dateEntry(otDay, 2, "KDT", 201)],
        };
        emp.OTEntries["184"] = {
          pName: "KSSI 0184: ITime(IT)",
          dateEntries: [dateEntry(otDay, 2, "KDT", 101)],
        };
        emp.Leaves["6"] = {
          pName: "Leave",
          dateEntries: [dateEntry(vlDay, 8, "KDT", 25)],
        };
        return emp;
      })(),
      "2": (function () {
        const emp = emptyEmployee("2", "Jose Luis T.", "Delos Santos");
        emp.RegularHourEntries["12"] = {
          pName: "KDT Internal Activities",
          dateEntries: days
            .filter(function (day) {
              return day !== holidayDay;
            })
            .slice(0, 8)
            .map(function (day) {
              return dateEntry(day, 8, "KDT", 110);
            }),
        };
        return emp;
      })(),
      "3": emptyEmployee("3", "Marlon B.", "Reyes"),
      "4": emptyEmployee("4", "Ian E.", "Santiago"),
      "5": emptyEmployee("5", "Jeraldine C.", "Uy"),
      "6": emptyEmployee("6", "Ana L.", "Santos"),
      "7": emptyEmployee("7", "Paolo R.", "Garcia"),
    };

    const out = {};
    empIds.forEach(function (id) {
      const source = catalog[id];
      if (!source) return;
      const emp = JSON.parse(JSON.stringify(source));

      function filterBlock(block, keepOgp) {
        const next = {};
        Object.keys(block).forEach(function (key) {
          const project = block[key];
          const isOgp =
            project.pName.slice(project.pName.length - 5) === "[ogp]";
          if (isOgp && !keepOgp) return;
          project.dateEntries = project.dateEntries.filter(function (entry) {
            const day = Number(entry.entryDate);
            return day <= lastDay && inLocation(entry.location);
          });
          if (project.dateEntries.length) next[key] = project;
        });
        return next;
      }

      emp.RegularHourEntries = filterBlock(emp.RegularHourEntries, includeOgp);
      emp.OTEntries = filterBlock(emp.OTEntries, includeOgp);
      emp.Leaves = filterBlock(emp.Leaves, true);

      const hasRows =
        Object.keys(emp.RegularHourEntries).length ||
        Object.keys(emp.OTEntries).length ||
        Object.keys(emp.Leaves).length;
      if (hasRows) out[id] = emp;
    });
    return out;
  }

  function buildAms(yearMonth, empIds) {
    const parts = String(yearMonth || "2026-09").split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const lastDay = new Date(year, month, 0).getDate();
    const days = workdays(year, month, lastDay);
    const holidayDay = Number(holidayDate(yearMonth).split("-")[2]);
    const vlDay = days.find(function (day) {
      return day !== holidayDay && day >= 8 && day <= 14;
    }) || days[Math.max(0, days.length - 2)];
    const missingAmsDay = days.find(function (day) {
      return day !== vlDay && day !== holidayDay;
    });
    const wfhDays = days.filter(function (day) {
      return day !== vlDay && day !== holidayDay && day !== missingAmsDay;
    }).slice(0, 2);

    const data = {};
    empIds.forEach(function (id) {
      if (id !== "1" && id !== "2") return;
      data[id] = {};
      days.forEach(function (day) {
        if (day === holidayDay) return;
        if (id === "1" && day === vlDay) return;
        if (id === "1" && day === missingAmsDay) return;
        data[id][pad(day)] = {
          hours: 8,
          locationName: wfhDays.indexOf(day) !== -1 && id === "1" ? "WFH" : "KDT",
        };
      });
    });
    return { isSuccess: true, data: data };
  }

  function mock(url, data) {
    const posted = parsePosted(data);

    if (isEndpoint(url, "check_login.php")) {
      return { json: true, body: LOGIN };
    }
    if (isEndpoint(url, "ms_access.php")) {
      return { json: false, body: JSON.stringify(true) };
    }
    if (isEndpoint(url, "get_group_list.php")) {
      return { json: true, body: GROUPS };
    }
    if (isEndpoint(url, "get_locations.php")) {
      return { json: true, body: LOCATIONS };
    }
    if (isEndpoint(url, "get_emplist.php")) {
      const group = posted.groupSel || LOGIN.empGroup;
      return { json: true, body: EMPLOYEES[group] || EMPLOYEES.ENV };
    }
    if (isEndpoint(url, "get_holidays.php")) {
      return { json: true, body: [holidayDate(posted.monthSel)] };
    }
    if (isEndpoint(url, "get_ams.php")) {
      return {
        json: true,
        body: buildAms(posted.yearMonth, parseEmpArray(posted.empArray)),
      };
    }
    if (isEndpoint(url, "get_entries.php")) {
      const includeOgp =
        posted.getOGP === true ||
        posted.getOGP === "true" ||
        posted.getOGP === "1";
      const entries = buildEntries(
        posted.monthSel,
        parseEmpArray(posted.empArray),
        includeOgp,
        posted.getHalfSel,
        String(posted.location)
      );
      return { json: false, body: JSON.stringify(entries) };
    }
    return null;
  }

  $.ajax = function (url, options) {
    if (typeof url === "object") {
      options = url;
    } else {
      options = $.extend({}, options || {}, { url: url });
    }
    const result = mock(options.url, options.data);
    if (!result) {
      return originalAjax.call(this, options);
    }
    const deferred = $.Deferred();
    const wantsJson = String(options.dataType || "").toLowerCase() === "json";
    const payload = wantsJson && !result.json ? JSON.parse(result.body) : result.body;
    setTimeout(function () {
      if (typeof options.success === "function") {
        options.success(payload, "success", {});
      }
      deferred.resolve(payload);
      if (typeof options.complete === "function") {
        options.complete({}, "success");
      }
    }, 0);
    return deferred.promise();
  };
})(jQuery);
