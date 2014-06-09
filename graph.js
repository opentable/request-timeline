(function() {
  var startTime = 0;

  function request(requestId, server) {
    startTime = $.now();
    $.ajax({
      url: server + "logstash-2014.06.09/_search",
      contentType: "application/json",
      // data: JSON.stringify({
      //   query: { match: {'RequestId': track }},
      //   filter:
      //   sort: ["timestamp"],
      //   size: 10000
      // }),
      data: {
        q: '+RequestId:"' + requestId + '"',
        sort: "timestamp:asc",
        size: 10000
      },
      server: server,
      requestId: requestId,
      error: onError,
      success: onSuccess
    });
  }

  function go(event) {
    request($("#track").val(), $("#server").val());
  }

  google.setOnLoadCallback(function() {
    $("#getlogs").click(go);
    $("#getlogs").prop("disabled", false);

    var url = $.url();
    var server = url.param("server");
    var requestId = url.param("requestId");

    if (server) {
      var serverSelect = document.getElementById("server");
      $.each(serverSelect.options, function (idx, option) {
        if (option.value == server) {
          serverSelect.selectedIndex = idx;
        }
      });
    }
    if (requestId) {
      $("#track").val(requestId);
      $("#getlogs").click();
    }
  });

  function onError(jqXHR, textStatus, errorThrown) {
    alert("Error: " + textStatus + " " + errorThrown);
  }

  function onSuccess(data, textStatus, jqXHR) {
    history.replaceState({}, this.requestId, "?server=" + encodeURIComponent(this.server) + "&requestId=" + encodeURIComponent(this.requestId));

    $("#duration").text(data.took + " ms");
    $("#renderduration").text( ($.now() - startTime - data.took) + " ms");

    var chart = [];
    var tdata = [];

    data.hits.hits.forEach(function(doc) {
      var msg = doc['_source'];
      switch (msg.level) {
      case 'request':
        var when = Date.parse(msg.timestamp);
        if (when) {
          var title;
          if (msg.requestServiceName) {
            title = msg.requestServiceName + ":" + msg.requestEndpointName;
          } else{
            title = msg.url;
          }
          var cssClass = "httpSuccess";
          var sc = msg.statusCode
          if (sc >= 300 && sc < 400) {
            cssClass = "httpRedirect";
          }
          if (sc >= 400) {
            cssClass = "httpError";
          }
          chart.push([title, msg.requestServiceName || "unknown", new Date(when), new Date(when + msg.responseTime), msg, cssClass]);
        } else {
          console.log("Refusing " + JSON.stringify(msg));
        }
        break;
      case 'access':
        break;
      default:
        tdata.push(msg);
        break;
      }
    });

    $("#nreqs").text(chart.length);

    var timeline = new links.Timeline(document.getElementById("graph"));
    var timelineData = new google.visualization.DataTable();

    timelineData.addColumn({ type: "string", id: "content" });
    timelineData.addColumn({ type: "string", id: "group" });
    timelineData.addColumn({ type: "date", id: "start" });
    timelineData.addColumn({ type: "date", id: "end" });
    timelineData.addColumn({ type: "string", id: "msg" });
    timelineData.addColumn({ type: "string", id: "className" });

    timelineData.addRows(chart);

    timeline.draw(timelineData);

    google.visualization.events.addListener(timeline, 'select', function() {
      var sel = timeline.getSelection();
      var row = sel && sel.length ? chart[sel[0].row] : undefined;
      timelineSelect(row);
    });

    $("#logs").dynatable({
      dataset: {
        records: tdata
      }
    });
  }

  function timelineSelect(row) {
    if (row) {
      var msg = row[4];
      var text = "";
      Object.keys(msg).forEach(function(key) {
        text += key + ": " + msg[key] + "<br/>";
      });
      $("#selection").show().html(text);
    } else {
      $("#selection").hide();
    }
  }
})();
