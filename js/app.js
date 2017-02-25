var OTP = "http://localhost:8080"
var STOPS = "/otp/routers/default/index/stops/autocomplete/"
var PLAN = "/otp/routers/default/profile"

function planUrl(from, to, date) {
  return OTP + PLAN + "?from=" + from.lat + "," + from.lon + "&to=" + to.lat + "," + to.lon + "&maxWalkTime=10&accessModes=WALK&egressModes=WALK&date=" + date +"&startTime=00:00:00&endTime=23:00:00&limit=4&orderBy=DIFFERENCE";
}

function plan() {

  var stop = function(sel) {
    var name = d3.select(sel).node().value;
    return stopByName.get(name);
  }
  var start = stop("#start");
  var end = stop("#end");
  var date = d3.select("#datetime").node().value;

  if (!start || !end || !date)
    return

  loader.show()
  d3.json(planUrl(start, end, date), function(resp) {
    loader.hide()
    notification.hide();
    var sched = [];
    resp.options.forEach(function(opt) {
      if (opt.transit) {
        createAllSchedules(sched, opt.transit);
      }
    })
    if (sched.length == 0) {
      notification.notify("No results found. Perhaps there is no data for this date.")
    }
    sched.sort(function(a, b) { return a.start - b.start });
    sched.forEach(function(s) {
      s.routes.forEach(function(d) {
        d.name = d.longName || d.shortName;
      })
    })
    table(sched);
  })
}

function findBestTransitObj(time, transit) {
  var best = null;
  var bestTime=0;
  transit.schedule.forEach(function(t) {
    var thisTime = t.orig.realtimeDeparture;
    if (thisTime > time + 5) {
      if (best == null || thisTime < bestTime) {
        best = t;
        bestTime = thisTime;
      }
    }
  })
  return best;
}

// data object: {"routes": [], "schedule": [[]], "start":_, "end":_}
function createAllSchedules(sched, transit) {
  var first = transit[0];
  first.schedule.forEach(function(o) {
    var d = {"routes": [], "schedule": [], "start":0, "end":0};
    d.routes.push(o.route);
    var sch = [o.orig.realtimeDeparture, o.dest.realtimeArrival];
    d.schedule.push(sch);
    
    for (var i = 1; i < transit.length; i++) {
      var time = d.schedule[d.schedule.length-1][1];
      var p = findBestTransitObj(time, transit[i]); // next schedule
      if (p == null)
        return; // skip to next object.
      d.routes.push(p.route);
      var sch = [p.orig.realtimeDeparture, p.dest.realtimeArrival];
      d.schedule.push(sch);
    }
    
    d.start = d.schedule[0][0];
    d.end = d.schedule[d.schedule.length-1][1];
    sched.push(d)
  })
}

function addColors(times) {
  times.forEach(function(d) {
    var length = -1;
    var color = null;
    d.routes.forEach(function(r, i) {
      var x = d.schedule[i][1] - d.schedule[i][0];
      if (x > length) {
        length = x;
        color = r["color"];
      }
    })
    d.col = d3.color(color ? "#"+color : "grey");
    d.col.opacity = 0.2;
  });
}

function table(times) {
  addColors(times)
  d3.select("#content").html("");
  var table = d3.select("#content").append("table").attr("class", "table is-striped");
  table.append("thead").html("<th>Route</th><th>Schedule</th>");
  var tbody = table.append("tbody");

  var rows = tbody.selectAll("tr")
    .data(times)
    .enter().append("tr")
    .style("background", function(d) { return d.col });
  
  rows.on("mouseover", function(d) {
    d3.select(this).style("background", function(d) { return d.col.darker(); })
  }).on("mouseout", function(d) { 
    d3.select(this).style("background", function(d) { return d.col; })
  })
  
  var labels = rows.append("td").classed("primary routename", true).html(function(d) { 
    return d.routes.map(function(d) { 
      return d.name;
    }).join(", ")
  });
  
  var schedules = rows.append("td").classed("primary", true)
    .html(function(d) {
      return sec2time(d.start) + " " + sec2time(d.end);
    });
      
  var extraFilter = function(d) { return d.routes.length > 1 }
  
  labels.filter(extraFilter).append("div").classed("secondary routename hidden", true).html(function(d) { 
    return d.routes.map(function(d) { return d.name }).join("<br>")
  })
  
  schedules.filter(extraFilter).append("div").classed("secondary hidden", true).html(function(d) {
    return d.schedule.map(function(d) { return sec2time(d[0]) + " " + sec2time(d[1]) }).join("<br>")
  })  
  
  rows.filter(extraFilter).each(function(d) {
    var visible = false;
    var prim = d3.select(this).selectAll(".primary");
    var sec = d3.select(this).selectAll(".secondary");
    prim.on("click", function() {
      sec.style("max-height", visible ? null : sec.property("scrollHeight") + "px")
      visible = !visible;
    })
  });
}

function makeToggle(sel) {
  var node = d3.select(sel);
  return {
    show: function() { node.style("display", "block"); },
    hide: function() { node.style("display", "none"); },
    notify: function(msg) { node.style("display", "block").select(".text").text(msg) }
  }
}

var loader = makeToggle(".overlay");
      
var notification = makeToggle(".notification");
  
var sec2time = (function() {
  var time = d3.utcFormat("%I:%M") // for AM/PM add "%p"
  return function(x) { return time(new Date(x * 1000)); }
})()

// main
d3.selectAll("#start, #end, #datetime").on("change", plan);
flatpickr(".datetime", {});
d3.selectAll(".notification .delete").on("click", notification.hide);

var stopByName = null;

d3.json(OTP + STOPS + "*", function(stops) {
  stopByName = d3.map(stops, function(d) { return d.name })
  
  var list = stops.map(function(d) { return d.name } );
  new Awesomplete(d3.select("#start").node(), {list: list});
  new Awesomplete(d3.select("#end").node(), {list: list});
});

