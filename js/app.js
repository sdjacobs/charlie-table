var OTP = ""; // local
var STOPS = "/otp/routers/default/index/stops/autocomplete/"
var PLAN = "/otp/routers/default/profile"

function planUrl(from, to, date) {
  return OTP + PLAN + "?from=" + from.lat + "," + from.lon + "&to=" + to.lat + "," + to.lon + "&maxWalkTime=5&accessModes=WALK&egressModes=WALK&date=" + date +"&startTime=00:00:00&endTime=23:00:00&orderBy=AVG";
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
    resp.schedules.forEach(function(s) {
      schedObjFromList(sched, s);
    });
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


function schedObjFromList(sched, schedule) {
  var d = {"routes":[], "schedule":[], "start":0, "end":0}
  
  schedule.forEach(function(o) {
    d.routes.push(o.route);
    var sch = [o.orig.realtimeDeparture, o.dest.realtimeArrival];
    d.schedule.push(sch);
  });
  
  d.start = d.schedule[0][0];
  d.end = d.schedule[d.schedule.length-1][1];
  sched.push(d);
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
  var head = table.append("thead").html("<th>Route<div id='anchors'/></th><th>Schedule</th>");
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
  
  // anchors
  var anchors = [{label:"morning", key: 7*3600}, {label:"afternoon", key: 14*3600}, {label:"evening", key: 18*3600} ]
  anchors.forEach(function(anchor) {
    rows.filter(function(d) { return d.start >= anchor.key })
      .each(function(d, i) {
        if (i == 0)
          this.id = anchor.label;
      })
  });
  d3.select('#anchors').selectAll(".tag")
    .data(anchors).enter()
    .append("span").classed("anchor tag is-unselectable is-dark", true)
    //.attr("href", function(d) { return "#"+d.label })
    .text(function(d) { return d.label })
    .on("click", function(d) {
      var top = d3.select('#' + d.label).node().getBoundingClientRect().top;
      d3.transition().duration("400").tween("scroll", scrollTween(top));
    })
  
  makeFixedHeader(head, tbody);
}

// from https://bl.ocks.org/mbostock/1649463
function scrollTween(offset) {
  return function() {
    var top = window.scrollY || document.documentElement.scrollTop;
    offset += top;
    var i = d3.interpolateNumber(top, offset);
    return function(t) { scrollTo(0, i(t)); };
  };
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

function makeFixedHeader(head, body) {
  var node = head.node();
  var fixed = false;
  var initTop = -1;

  var th1 = head.select("th:first-child").node();
  var th2 = head.select("th:last-child").node();
  
  var row = body.insert("tr", ":first-child")
    .style("opacity","0").style("display", "none")
    .html(head.html());
  
  function width(sel) {
    return body.select(sel).node().clientWidth + "px";
  }
  
  function toggle() {
    var header = d3.select("thead").node()
    var rect = header.getBoundingClientRect();
    if (rect.top <= 0 && !fixed) {
      row.style("display", null);
      header.style.position = "fixed";
      header.style.top = "-1em";
      fixed = true;
      th1.style.width = width("tr td:first-child");
      th2.style.width = width("tr td:last-child");
      initTop = node.parentNode.getBoundingClientRect().top;
    }
    else if (node.parentNode.getBoundingClientRect().top >= initTop) {
      row.style("display", "none");
      header.style.position = null;
      header.style.top = null;
      th1.style.width = null;
      th2.style.width = null;
      fixed = false;
    }
  }
  
  window.onscroll = toggle;
  
  return toggle;
}

