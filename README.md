Request Timeline
================

This application displays log entries representing HTTP requests
visually on a timeline.  It depends on services logging according to the
[common OTLs][1]--specifically, ot-v1, msg-v1, and http-v1.

On discovery it advertises as `timeline`,
and the singularity request is `timeline` as well.


To build a docker image using currently installed components
------------------------------------------------------------

	build

To deploy
---------

	Run deploy.sh from deploy subdirectory


To update modules (rarely needed)
--------------------------------

    npm install bower
    node_modules/bower/bin/bower install

#### Urls
[http://timeline.otenv.com/][2]


[1]: https://github.com/opentable/logging-loglov3-config/tree/master/otls
[2]: http://timeline.otenv.com/
