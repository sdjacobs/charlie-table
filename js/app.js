var OTP = "http://localhost:8080"
var STOPS = "/otp/routers/default/index/stops/autocomplete/"
var PLAN = "/otp/routers/default/profile"

function planUrl(from, to, date) {
  return OTP + PLAN + "?from=" + from.lat + "," + from.lon + "&to=" + to.lat + "," + to.lon + "&maxWalkTime=10&accessModes=WALK&egressModes=WALK&date=" + date +"&startTime=00:00:00&endTime=23:00:00";
}

function loadStops(datalist, auto) {
  d3.json(OTP + STOPS + auto, function(stops) {
    datalist.html("");
    datalist.selectAll("option")
      .data(stops)
      .enter().append("option")
        .attr("value", function(d) { return d.name })
  });
}

function plan() {

  var stop = function(sel) {
    var list = d3.select(sel).attr("list")
    var val = d3.select(sel).node().value;
    var opt = d3.select("#" + list + " option[value='" + val + "']");
    return val && opt.size() ? opt.datum() : null;
  }
  var start = stop("#start");
  var end = stop("#end");
  var date = d3.select("#datetime").node().value;

  if (!start || !end || !date)
    return

  d3.json(planUrl(start, end, date), function(resp) {
    var sched = [];
    resp.options.forEach(function(opt) {
      if (opt.transit) {
        createAllSchedules(sched, opt.transit);
      }
    })
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

function table(times) {
  d3.select("#content").html("");
  var table = d3.select("#content").append("table").attr("class", "table is-striped");
  table.append("thead").html("<th>Route</th><th>Schedule</th>");
  var tbody = table.append("tbody");
  
  var rows = tbody.selectAll("tr")
    .data(times)
    .enter().append("tr");
    
  var labels = rows.append("td").classed("primary", true).html(function(d) { 
    return d.routes.map(function(d) { 
      return "<span style='color:#" + d.color + "'>" + d.name + "</span>";
    }).join(", ")
  });
  
  var schedules = rows.append("td").classed("primary", true)
    .html(function(d) {
      return sec2time(d.start) + " " + sec2time(d.end);
    });
      
  var extraFilter = function(d) { return d.routes.length > 1 }
  
  labels.filter(extraFilter).append("div").classed("secondary routename", true).style("display", "none").html(function(d) { 
    return d.routes.map(function(d) { return d.name }).join("<br>")
  })
  
  schedules.filter(extraFilter).append("div").classed("secondary", true).style("display", "none").html(function(d) {
    return d.schedule.map(function(d) { return sec2time(d[0]) + " " + sec2time(d[1]) }).join("<br>")
  })  
  
  rows.filter(extraFilter).each(function(d) {
    var visible = false;
    var prim = d3.select(this).selectAll(".primary");
    var sec = d3.select(this).selectAll(".secondary");
    prim.on("click", function() { 
      sec.style("display", visible ? "none" : null);
      visible = !visible;
    })
  });
}
      
var sec2time = (function() {
  var time = d3.utcFormat("%I:%M") // for AM/PM add "%p"
  return function(x) { return time(new Date(x * 1000)); }
})()

// main
d3.selectAll("#start, #end").each(function() {
  var thiz = d3.select(this)
  thiz.on("keypress", function() {
    if (d3.event.charCode == 0)
      return;
    var val = this.value + d3.event.key;
    if (val.length > 2)
      loadStops(d3.select("#" + thiz.attr("list")), val);
  })  
})

d3.selectAll("#start, #end, #datetime").on("change", plan);

flatpickr(".datetime", {});
