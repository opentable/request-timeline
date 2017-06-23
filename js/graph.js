(function() {
  var SERVERS = [
    // Legacy.
    "http://es-logging.otenv.com:9200/",
    "http://es-logging-qa.otenv.com:9200/",
    // loglov3.
    "http://loglov3-logging-qa.otenv.com:9200/",
    "http://loglov3-logging-prod.otenv.com:9200/"
  ];
  var MS_PER_DAY = 24*60*60*1000;
  var SEARCH_WINDOW = 2 * MS_PER_DAY;

  var tdata = [];
  var incomingData = [];
  var outgoingData = [];
  var otherData = [];

  var $table = $('#logs').dataTable({
    columns: [
      {
        data: '@timestamp'
      },
      {
        data: 'severity',
        defaultContent: '__missing__'
      },
      {
        data: 'component-id',
        defaultContent: '__missing__'
      },
      {
        data: 'message',
        defaultContent: '__missing__'
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

  $('#toggleLogType #incoming').on('click', function () {
    var incomingState = !$('#toggleLogType #incoming').hasClass('active');
    var outgoingState = $('#toggleLogType #outgoing').hasClass('active');
    var otherState = $('#toggleLogType #other').hasClass('active');
    bindDataToTimeline(incomingState, outgoingState, otherState);
  });
  $('#toggleLogType #outgoing').on('click', function () {
    var incomingState = $('#toggleLogType #incoming').hasClass('active');
    var outgoingState = !$('#toggleLogType #outgoing').hasClass('active');
    var otherState = $('#toggleLogType #other').hasClass('active');
    bindDataToTimeline(incomingState, outgoingState, otherState);
  });
  $('#toggleLogType #other').on('click', function () {
    var incomingState = $('#toggleLogType #incoming').hasClass('active');
    var outgoingState = $('#toggleLogType #outgoing').hasClass('active');
    var otherState = !$('#toggleLogType #other').hasClass('active');
    bindDataToTimeline(incomingState, outgoingState, otherState);
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
          // We search for both the old-style ot-requestid and the
          // loglov3-style request-id.
          q: 'ot-requestid:"' + requestId + '" request-id:"' + requestId + '"',
          sort: "@timestamp:asc",
          size: 10000
        },
      });
    }))
    .always(onFinished)
    .fail(function(jqXHR, textStatus, errorThrown) {
      alert("Error: " + textStatus + " " + errorThrown);
    })
    .then(function() {
      return _.reduce(arguments, function(result, item) { return result.concat(item[0].hits.hits); }, []);
    })
    .then(function (hits) {
      onSuccess(hits, requestId, searchdate, start);
    });
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

  function onSuccess(hits, requestId, searchDate, startTime) {
    history.replaceState({}, requestId, "?requestId=" + encodeURIComponent(requestId) + "&searchdate=" + encodeURIComponent(searchDate));

    var timeSpent = new Date() - startTime;
    $("#duration").text(timeSpent + " ms");

    tdata = [];
    incomingData = [];
    outgoingData = [];
    otherData = [];

    hits.forEach(function(doc) {
      var msg = normalize(doc['_source']);
      // Use 'url', 'duration', and 'incoming' fields from http-v1 OTL.
      var probablyHttpV1 = msg.duration !== undefined && msg.url !== undefined;
      if (probablyHttpV1) {
        var pushList;
        if (msg.incoming == true) {
          pushList = incomingData;
        } else if (msg.incoming == false) {
          pushList = outgoingData;
        } else {
          pushList = otherData;
        }
        pushList.push(populateTimelineRequest(msg));
      }
      // Otherwise, we won't display this log entry graphically.

      tdata.push(msg);
    });

    bindDataToTimeline(true, true, true);
  }

  // Run through all message fields, stringify those that need it,
  // conditionally truncate, massage from legacy to loglov3, put results
  // in out.
  function normalize(msg) {
    var ret = {};
    for (var key in msg) if (msg.hasOwnProperty(key)) {
      var value = msg[key];
      switch (typeof value) {
      case 'object':
        value = JSON.stringify(value);
        break;
      case 'function':
      case 'symbol':
        value = value.toString();
        break;
      }
      if (typeof value == 'string') {
        if (value.length > 512) {
          value = value.substring(0, 512) + '...';
        }
        value = _.escape(value);
      }
      ret[key] = value;
    }

    // Normalize data in V2 "schema" to match V3 (ot-v1, etc.) schema,
    // be most useful for table display.

    var sev = ret.severity;
    if (!sev) sev = ret.method;
    ret.severity = sev;

    var message = ret.message;
    if (!message) message = ret.logmessage;
    // Use url as message for http-v1 entries.
    if (!message) message = ret.url;
    delete ret.logmessage;
    ret.message = message;

    var componentId = ret['component-id'];
    function badcid() { return !componentId || componentId == 'unknown'; }
    if (badcid()) componentId = msg.servicetype;
    if (badcid()) componentId = msg['service-type'];
    delete msg.servicetype;
    delete msg['service-type'];
    ret['component-id'] = componentId;

    return ret;
  }

  function bindDataToTimeline(bindIncoming, bindOutgoing, bindOther) {
    timelineData.clear();
    timelineDataGroups.clear();

    var graphEntries = 0;
    function process(condition, data) {
      if (condition) {
        graphEntries += data.length;
        timelineData.add(data);
      }
    }
    process(bindIncoming, incomingData);
    process(bindOutgoing, outgoingData);
    process(bindOther, otherData);

    $("#ngentries").text(graphEntries);
    $("#ntentries").text(tdata.length);

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

    $(".vis-item").qtip({
      position: {
        my: 'top left',
        at: 'bottom left',
      },
      content: {
        text: function() {
          return _.escape($(this).text());
        }
      }
    });
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
      var cssClass = "httpSuccess " + msg.logname;
      var sc = msg.status;
      if (sc >= 300 && sc < 400) {
        cssClass = "httpRedirect";
      }
      if (sc >= 400 || typeof sc === 'undefined') {
        cssClass = "httpError";
      }
      var duration = Math.max(msg.duration/1000 || msg.durationms, 1); // hack until we all migrate
      timelineRequestItem = {
        "content": _.escape(title),
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
        text += "<span class=\"jk\">\"" + key + "\"</span><span class=\"jc\">: </span><span class=\"jv\">\"" + _.escape(value) + "\"</span><br/>";
      });
      $('#myModal .modal-body').html(text);
      $('#myModal').modal('show');
    }
  }
})();
