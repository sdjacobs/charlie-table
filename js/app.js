var OTP = "http://localhost:8080"
var STOPS = "/otp/routers/default/index/stops"
var PLAN = "/otp/routers/default/profile"

function planUrl(from, to) {
  return OTP + PLAN + "?from=" + from.lat + "," + from.lon + "&to=" + to.lat + "," + to.lon + "&maxWalkTime=5&accessModes=WALK&egressModes=WALK";
}

// TODO: make the interface here better
function timetableUrl(options) {
  var patternIds = [], origs = [], dests = [];
  options.forEach(function(opt) {
    opt.transit[0].segmentPatterns.forEach(function(seg) {
      if (patternIds.indexOf(seg.patternId) == -1) {
        patternIds.push(seg.patternId);
        origs.push(seg.fromIndex);
        dests.push(seg.toIndex);
      }
    });
  });
  return OTP + "/otp/routers/default/index/stoptime/schedules?patternIds=" + patternIds + "&origs=" + origs + "&dests=" + dests + "&startTime=1484352929";
}

function loadStops() {
  d3.json(OTP + STOPS, function(stops) {
    var stations = stops.filter(function(d) { return d.cluster })
    d3.select("#stops").selectAll("option")
      .data(stations)
      .enter().append("option")
        .attr("value", function(d) { return d.name })
  });
}

function plan() {

  var stop = function(sel) {
    var val = d3.select(sel).node().value;
    return val ? d3.select("#stops option[value='" + val + "']").datum() : null;
  }
  var start = stop("#start");
  var end = stop("#end");

  if (!start || !end)
    return

  d3.json(planUrl(start, end), function(resp) {
    var options = [];
    resp.options.forEach(function(opt) {
      if (opt.transit && opt.transit.length == 1) {
        options.push(opt)
      }
    })
  
    d3.json(timetableUrl(options), table);
  })
}

function table(times) {
  var table = d3.select("#content").append("table").attr("class", "table is-striped");
  table.append("thead").html("<th>Route</th><th>Depart</th><th>Arrive</th>");
  var tbody = table.append("tbody");
  
  tbody.selectAll("tr")
    .data(times)
    .enter().append("tr")
      .html(function(d) {
        var route = d.route.longName;
        var st = sec2time(d.orig.realtimeDeparture);
        var en = sec2time(d.dest.realtimeArrival); 
        return "<td>" + route + "</td><td>" + st + "</td><td>" + en + "</td>";
      });
}
      

function sec2time(t) {
  var h = (t - t%3600)/3600;
  t -= h * 3600;
  var m = (t - t%60)/60;
  return h + ":" + m;
}

// main
loadStops();

d3.selectAll("#start, #end").on("change", plan);
