var OTP = "http://localhost:8080"
var STOPS = "/otp/routers/default/index/stops/autocomplete/"
var PLAN = "/otp/routers/default/profile"

function planUrl(from, to, date) {
  return OTP + PLAN + "?from=" + from.lat + "," + from.lon + "&to=" + to.lat + "," + to.lon + "&maxWalkTime=5&accessModes=WALK&egressModes=WALK&date=" + date;
}

// TODO: make the interface here better
function timetableUrl(options, date) {
  var epoch = new Date(date).getTime()/1000;
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
  return OTP + "/otp/routers/default/index/stoptime/schedules?patternIds=" + patternIds + "&origs=" + origs + "&dests=" + dests + "&startTime=" + epoch;
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
    var options = [];
    resp.options.forEach(function(opt) {
      if (opt.transit && opt.transit.length == 1) {
        options.push(opt)
      }
    })
  
    d3.json(timetableUrl(options, date), table);
  })
}

function table(times) {
  d3.select("#content").html("");
  var table = d3.select("#content").append("table").attr("class", "table is-striped");
  table.append("thead").html("<th>Route</th><th>Depart</th><th>Arrive</th>");
  var tbody = table.append("tbody");
  
  tbody.selectAll("tr")
    .data(times)
    .enter().append("tr")
      .html(function(d) {
        var route = d.route.longName || d.route.shortName;
        var st = sec2time(d.orig.realtimeDeparture);
        var en = sec2time(d.dest.realtimeArrival); 
        return "<td>" + route + "</td><td>" + st + "</td><td>" + en + "</td>";
      });
}
      
var sec2time = (function() {
  var time = d3.utcFormat("%I:%M %p")
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