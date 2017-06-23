Request Timeline
================

This application displays log entries representing HTTP requests
visually on a timeline.  It depends on services logging according to the
[common OTLs][1]--specifically, ot-v1, msg-v1, and http-v1.

The service is deployed on the `opengrok` machine, in
`/var/www/request-timeline`.  It automatically updates to the latest
`master` code every 10 minutes via a job in
`/etc/cron.d/request-timeline`.

Development Setup
-----------------

    npm install
    npm run compile
    npm install bower
    node_modules/bower/bin/bower install

[1]: https://github.com/opentable/logging-loglov3-config/tree/master/otls
