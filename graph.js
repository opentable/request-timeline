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
          chart.push([title, new Date(when), new Date(when + msg.responseTime)]);
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

    var timeline = new google.visualization.Timeline(document.getElementById("graph"));
    var timelineData = new google.visualization.DataTable();

    timelineData.addColumn({ type: "string", id: "URL" });
    timelineData.addColumn({ type: "date", id: "Start" });
    timelineData.addColumn({ type: "date", id: "End" });

    timelineData.addRows(chart);

    timeline.draw(timelineData, {
      height: 700
    });

    $("#logs").dynatable({
      dataset: {
        records: tdata
      }
    });
  }
})();
