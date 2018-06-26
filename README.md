Request Timeline
================

This application displays log entries representing HTTP requests
visually on a timeline.  It depends on services logging according to the
[common OTLs][1]--specifically, ot-v1, msg-v1, and http-v1.

TODO: Wrap in Node express
TODO: announce discovery


Development Setup
-----------------

    npm install bower
    node_modules/bower/bin/bower install

[1]: https://github.com/opentable/logging-loglov3-config/tree/master/otls
