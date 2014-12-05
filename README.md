Request Timeline
================

This application displays log entries representing HTTP requests visually on a timeline.
It depends on services logging according to the [Standard Log Format](https://wiki:8443/display/CP/Log+Attribute+Standards).

The service is deployed on the `opengrok` machine, in `/var/www/request-timeline`.  It automatically updates to the latest `master` code
every 10 minutes via a job in `/etc/cron.d/request-timeline`.
