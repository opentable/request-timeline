(function() {
  var SERVERS = ["http://es-logging.otenv.com:9200/", "http://es-logging-qa.otenv.com:9200/"];
  var MS_PER_DAY = 24*60*60*1000;
  var SEARCH_WINDOW = 2 * MS_PER_DAY;
  var tdata = [];
  var outgoingData = [];
  var requestData = [];

  var $table = $('#logs').dataTable({
    columns: [
      {
        data: 'timestamp'
      },
      {
        data: 'severity',
        defaultContent: 'NONE'
      },
      {
        data: 'logmessage',
        defaultContent: ''
      }
    ]
  });

  $table.on( 'click', 'tr', function () {
    var api = $table.dataTable().api();
    var rowData = api.row(this).data();
    showMessage(rowData);
  });

  var timelineData = new vis.DataSet();
  var timelineDataGroups = new vis.DataSet();
  var timeline = new vis.Timeline(document.getElementById("graph"));

  timeline.on('select', function() {
    var sel = timeline.getSelection();
    var element;
    if (sel && sel.length) {
      element = timelineData.get(sel[0]);
    }
    showMessage(element && element.msg);
  });

  $('#toggleLogType #outgoing').on('click', function () {
    var outgoingState = !$('#toggleLogType #outgoing').hasClass('active');
    var requestState = $('#toggleLogType #request').hasClass('active');

    bindDataToTimeline(outgoingState, requestState);
  });

  $('#toggleLogType #request').on('click', function () {
    var outgoingState = $('#toggleLogType #outgoing').hasClass('active');
    var requestState = !$('#toggleLogType #request').hasClass('active');

    bindDataToTimeline(outgoingState, requestState);
  });

  function request(requestId, searchdate) {
    var around = Date.parse(searchdate);
    var dates = [];
    for (var d = around - SEARCH_WINDOW; d <= around + SEARCH_WINDOW && d < new Date().getTime(); d += MS_PER_DAY) {
      dates.push("logstash-" + new Date(d).toISOString().substring(0, 10).replace("-",".").replace("-","."));
    }

    $("#progress-bar").removeClass('hide');
    $("#timeline-content").addClass('hide');

    var start = new Date();

    $.when.apply($, $.map(SERVERS, function(server) {
      return $.ajax({
        url: server + dates.join(',') + "/_search",
        contentType: "application/json",
        data: {
          q: '+ot-requestid:"' + requestId + '"',
          sort: "@timestamp:asc",
          size: 10000
        },
      });
    })).then(function() {
      return _.reduce(arguments, function(result, item) { return result.concat(item[0].hits.hits); }, []);
    }).then(function (hits) { onSuccess(hits, requestId, searchdate, start); });
  }

  function go(event) {
    if (event) {
      event.preventDefault();
    }
    request($("#requestid").val(), $("#searchdate").val());
  }

  $(document).ready(function() {
    $('#searchdate').datepicker({
      format: 'yyyy-mm-dd',
    });
    $("#requestid").change(go);
    $("#searchdate").change(go);

    var url = $.url();
    var requestId = url.param("requestId");
    var searchdate = url.param("searchdate");

    if (searchdate) {
      $("#searchdate").val(searchdate);
    } else {
      $("#searchdate").val(new Date().toISOString().substring(0, 10));
    }
    if (requestId) {
      $("#requestid").val(requestId);
      go();
    }
  });

  function onFinished() {
    $("#progress-bar").addClass('hide');
    $("#timeline-content").removeClass('hide');
  }

  function onError(jqXHR, textStatus, errorThrown) {
    onFinished();
    alert("Error: " + textStatus + " " + errorThrown);
  }

  function onSuccess(hits, requestId, searchDate, startTime) {
    onFinished();
    history.replaceState({}, requestId, "?requestId=" + encodeURIComponent(requestId) + "&searchdate=" + encodeURIComponent(searchDate));

    var timeSpent = new Date() - startTime;
    $("#duration").text(timeSpent + " ms");

    tdata = [];
    outgoingData = [];
    requestData = [];

    hits.forEach(function(doc) {
      var msg = doc['_source'];
      switch (msg.logname) {
      case 'outgoing':
        outgoingData.push(populateTimelineRequest(msg));
        break;
      case 'request':
        requestData.push(populateTimelineRequest(msg));
      default:
        msg.timestamp = msg['@timestamp'];
        tdata.push(msg);
        break;
      }
    });

    bindDataToTimeline(true, true);
  }

  function bindDataToTimeline(bindOutgoing, bindRequest) {
    timelineData.clear();
    timelineDataGroups.clear();

    var numberOfRequests;
    if (bindOutgoing && !bindRequest) {
      numberOfRequests = outgoingData.length;
      timelineData.add(outgoingData);
    } 
    else if (!bindOutgoing && bindRequest) {
      numberOfRequests = requestData.length;
      timelineData.add(requestData);
    }
    else if (bindOutgoing && bindRequest) {
      numberOfRequests = requestData.length + outgoingData.length;
      timelineData.add(outgoingData);
      timelineData.add(requestData);
    }

    $("#nreqs").text(numberOfRequests);

    timelineData.forEach(function(item) {
      if (!timelineDataGroups.get(item.group)) {
        timelineDataGroups.add([{
          id: item.group,
          content: item.group
        }]);
      }
    });
    timeline.setItems(timelineData);
    timeline.setGroups(timelineDataGroups);
    // timeline.fit() animates to fit new data set.
    timeline.fit();

    var api = $table.dataTable().api();
    api.clear();
    api.rows.add(tdata);
    api.draw();
  }

  function populateTimelineRequest(msg) {
    var timelineRequestItem;
    var when = Date.parse(msg['@timestamp']);
    if (when) {
      var title;
      var referrer = msg.servicetype;
      if (referrer) {
        title = referrer + ":" + msg.url;
      } else{
        title = msg.url;
      }
      var cssClass = "httpSuccess" + " " + msg.logname;
      var sc = msg.status;
      if (sc >= 300 && sc < 400) {
        cssClass = "httpRedirect";
      }
      if (sc >= 400 || typeof sc === 'undefined') {
        cssClass = "httpError";
      }
      var duration = Math.max(msg.duration/1000 || msg.durationms, 1); // hack until we all migrate
      timelineRequestItem = {
        "content": title,
        "group": referrer || "unknown",
        "start": new Date(when - duration),
        "end": new Date(when),
        "msg": msg,
        "className": cssClass
      };
    } 
    else {
      console.log("Refusing " + JSON.stringify(msg));
    }
    return timelineRequestItem;
  }

  function showMessage(msg) {
    if (msg) {
      var text = "";
      Object.keys(msg).forEach(function(key) {
        var value = msg[key];
        if (typeof value === "object") {
          value = JSON.stringify(value);
        }
        text += "<span class=\"jk\">\"" + key + "\"</span><span class=\"jc\">: </span><span class=\"jv\">\"" + value + "\"</span><br/>";
      });
      $('#myModal .modal-body').html(text);
      $('#myModal').modal('show');
    }
  }
})();
